/**
 * Educational service-dependency ("blast radius") simulator.
 * Relationships are hypothetical, not a map of actual IRCTC infrastructure.
 * This module is side-effect free: no incident updates, SLA changes, or database writes.
 */
export interface ServiceNode {
  id: string;
  label: string;
  owner: string;
  criticality: 1 | 2 | 3;
  dependents: readonly string[];
}

export interface AffectedService {
  id: string;
  label: string;
  owner: string;
  criticality: 1 | 2 | 3;
  depth: number;
  path: readonly string[];
}

export interface ImpactReport {
  failed: ServiceNode;
  affected: readonly AffectedService[];
  directCount: number;
  indirectCount: number;
  advisoryPriority: 'P1' | 'P2' | 'P3' | 'P4';
  recommendations: readonly string[];
}

export const SERVICE_TOPOLOGY: readonly ServiceNode[] = [
  { id: 'NGET_CORE_DATABASE', label: 'Booking Database', owner: 'Database & Infrastructure', criticality: 3,
    dependents: ['TATKAL_BOOKING_ENGINE', 'GENERAL_BOOKING', 'PNR_ENQUIRY_API', 'UPI_PAYMENT_GATEWAY'] },
  { id: 'UPI_PAYMENT_GATEWAY', label: 'UPI Payment Gateway', owner: 'Payment Integrations', criticality: 3,
    dependents: ['TATKAL_BOOKING_ENGINE', 'GENERAL_BOOKING', 'TICKET_CONFIRMATION', 'REFUND_PROCESSING'] },
  { id: 'TATKAL_BOOKING_ENGINE', label: 'Tatkal Booking', owner: 'Booking Systems', criticality: 3,
    dependents: ['TICKET_CONFIRMATION'] },
  { id: 'GENERAL_BOOKING', label: 'General Ticket Booking', owner: 'Booking Systems', criticality: 3,
    dependents: ['TICKET_CONFIRMATION'] },
  { id: 'PNR_ENQUIRY_API', label: 'PNR Enquiry API', owner: 'Railway Integrations', criticality: 2,
    dependents: ['PASSENGER_NOTIFICATIONS'] },
  { id: 'AUTHENTICATION', label: 'Authentication', owner: 'Identity & Access', criticality: 3,
    dependents: ['PASSENGER_LOGIN', 'TATKAL_BOOKING_ENGINE', 'GENERAL_BOOKING'] },
  { id: 'SMS_GATEWAY', label: 'SMS Gateway', owner: 'Messaging', criticality: 2,
    dependents: ['OTP_DELIVERY', 'PASSENGER_NOTIFICATIONS'] },
  { id: 'OTP_DELIVERY', label: 'OTP Delivery', owner: 'Messaging', criticality: 2,
    dependents: ['PASSENGER_LOGIN'] },
  { id: 'PASSENGER_LOGIN', label: 'Passenger Login', owner: 'Identity & Access', criticality: 2, dependents: [] },
  { id: 'TICKET_CONFIRMATION', label: 'Ticket Confirmation', owner: 'Booking Systems', criticality: 3,
    dependents: ['PASSENGER_NOTIFICATIONS'] },
  { id: 'REFUND_PROCESSING', label: 'Refund Processing', owner: 'Payments & Reconciliation', criticality: 2, dependents: [] },
  { id: 'PASSENGER_NOTIFICATIONS', label: 'Passenger Notifications', owner: 'Messaging', criticality: 1, dependents: [] },
  { id: 'E_CATERING_PORTAL', label: 'E-Catering Portal', owner: 'Catering Platforms', criticality: 2,
    dependents: ['CATERING_ORDERS'] },
  { id: 'CATERING_ORDERS', label: 'Catering Orders', owner: 'Catering Platforms', criticality: 1, dependents: [] }
];

/** Matches names from the team's real seeded services, plus human-readable aliases. */
const ALIASES: Readonly<Record<string, string>> = {
  TATKAL_BOOKING: 'TATKAL_BOOKING_ENGINE',
  TATKAL_BOOKING_ENGINE: 'TATKAL_BOOKING_ENGINE',
  PAYMENT_GATEWAY: 'UPI_PAYMENT_GATEWAY',
  UPI_PAYMENTS: 'UPI_PAYMENT_GATEWAY',
  UPI_PAYMENT_GATEWAY: 'UPI_PAYMENT_GATEWAY',
  BOOKING_DATABASE: 'NGET_CORE_DATABASE',
  NGET_CORE_DATABASE: 'NGET_CORE_DATABASE',
  PNR_STATUS: 'PNR_ENQUIRY_API',
  PNR_ENQUIRY: 'PNR_ENQUIRY_API',
  PNR_ENQUIRY_API: 'PNR_ENQUIRY_API',
  E_CATERING: 'E_CATERING_PORTAL',
  E_CATERING_PORTAL: 'E_CATERING_PORTAL'
};

/** Unknown DB names deliberately return null; never pretend a mapping was found. */
export function identifyService(name: string): string | null {
  const key = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (SERVICE_TOPOLOGY.some(node => node.id === key)) return key;
  return ALIASES[key] ?? null;
}

/** BFS finds the shortest dependency path and avoids infinite loops on cycles. */
export function analyzeFailure(rootId: string, topology: readonly ServiceNode[] = SERVICE_TOPOLOGY): ImpactReport {
  const lookup = new Map<string, ServiceNode>();
  for (const node of topology) {
    if (!node.id.trim() || lookup.has(node.id)) throw new Error('Invalid or duplicate service ID: ' + node.id);
    lookup.set(node.id, node);
  }
  for (const node of topology) {
    for (const dependent of node.dependents) {
      if (!lookup.has(dependent)) throw new Error('Unknown dependency: ' + dependent + ' (from ' + node.id + ')');
    }
  }
  const failed = lookup.get(rootId);
  if (!failed) throw new RangeError('Service not found in simulation topology: ' + rootId);

  const visited = new Set<string>([rootId]);
  const queue: { id: string; path: string[] }[] = [{ id: rootId, path: [rootId] }];
  const affected: AffectedService[] = [];

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    const node = lookup.get(current.id)!;
    for (const childId of node.dependents) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      const child = lookup.get(childId)!;
      const path = [...current.path, childId];
      affected.push({ id: child.id, label: child.label, owner: child.owner,
        criticality: child.criticality, depth: path.length - 1, path });
      queue.push({ id: childId, path });
    }
  }
  const directCount = affected.filter(item => item.depth === 1).length;
  const indirectCount = affected.length - directCount;
  const criticalDependents = affected.filter(item => item.criticality === 3).length;
  // Illustrative management recommendation, NOT the actual incident priority engine.
  const advisoryPriority: ImpactReport['advisoryPriority'] =
    failed.criticality === 3 && (affected.length >= 3 || criticalDependents >= 2) ? 'P1'
      : failed.criticality === 3 || affected.length >= 3 ? 'P2'
      : affected.length > 0 ? 'P3' : 'P4';
  const recommendations = [
    'Escalate to ' + failed.owner + ' and validate the failing service before taking action.',
    directCount > 0
      ? 'Check ' + directCount + ' direct dependent service(s) and confirm whether the predicted disruption occurred.'
      : 'Check service health and logs; no downstream services are modelled.',
    'Record confirmed impact in the incident audit trail and notify the incident manager using the normal workflow.'
  ];

  return { failed, affected, directCount, indirectCount, advisoryPriority, recommendations };
}
