import { calculatePriority, type Category, type IncidentInput, type Priority, type Service } from './domain.ts';

/** Match the Java service's local-time rule: 10:00–10:29 and 11:00–11:29 IST. */
export function isPeakTatkalTime(at: Date): boolean {
  if (Number.isNaN(at.getTime())) return false;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(at);
  const hour = Number(parts.find(p => p.type === 'hour')?.value);
  const minute = Number(parts.find(p => p.type === 'minute')?.value);
  return (hour === 10 || hour === 11) && minute >= 0 && minute < 30;
}

export interface StaffPriorityPreview {
  priority: Priority;
  securityOverride: boolean;
  peakTatkalOverride: boolean;
  autoTatkalWindow: boolean;
}

/**
 * Advisory form preview matching the current Java workflow's rule inputs.
 * The Java backend remains authoritative at submission time.
 */
export function previewStaffIncidentPriority(
  input: Pick<IncidentInput, 'category' | 'impact' | 'urgency' | 'tatkalWindow'>,
  service: Pick<Service, 'criticalityScore' | 'tatkalBookingPath'> | undefined,
  category: Pick<Category, 'code' | 'team'> | undefined,
  at: Date = new Date()
): StaffPriorityPreview | null {
  if (!service || !category || input.category !== category.code) return null;
  const autoTatkalWindow = isPeakTatkalTime(at);
  const securityOverride = category.team === 'SECURITY';
  const peakTatkalOverride = service.tatkalBookingPath && (input.tatkalWindow || autoTatkalWindow)
    && input.impact === 3 && input.urgency === 3;
  const priority = calculatePriority({
    impact: input.impact,
    urgency: input.urgency,
    criticality: service.criticalityScore,
    securityIncident: securityOverride,
    tatkalWindow: service.tatkalBookingPath && (input.tatkalWindow || autoTatkalWindow)
  });
  return { priority, securityOverride, peakTatkalOverride, autoTatkalWindow };
}
