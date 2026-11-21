package com.railway.itsm.domain.impact;

import java.util.*;

/**
 * Read-only, explainable blast-radius simulator. Graph edges point from a failed service
 * to a service potentially dependent on it. All topology is hypothetical and educational.
 *
 * The graph does not change incident priority or read real railway telemetry.
 */
public final class ServiceDependencyGraph {
    public record ServiceNode(String id, String label, String owner, int criticality, List<String> dependents) {
        public ServiceNode {
            if (id == null || id.isBlank() || label == null || label.isBlank()
                    || owner == null || owner.isBlank() || criticality < 1 || criticality > 3)
                throw new IllegalArgumentException("Invalid service node");
            dependents = List.copyOf(Objects.requireNonNull(dependents));
        }
    }

    public record AffectedService(String id, String label, String owner,
                                  int criticality, int depth, List<String> path) {
        public AffectedService {
            path = List.copyOf(path);
        }
    }

    public record ImpactReport(ServiceNode failed, List<AffectedService> affected,
                               int directCount, int indirectCount, String advisoryPriority,
                               List<String> recommendations) {
        public ImpactReport {
            affected = List.copyOf(affected);
            recommendations = List.copyOf(recommendations);
        }
    }

    private record Visit(String id, List<String> path) {}

    private final Map<String, ServiceNode> nodes;

    public ServiceDependencyGraph(Collection<ServiceNode> services) {
        Objects.requireNonNull(services);
        LinkedHashMap<String, ServiceNode> entries = new LinkedHashMap<>();
        for (ServiceNode service : services) {
            Objects.requireNonNull(service);
            if (entries.putIfAbsent(service.id(), service) != null)
                throw new IllegalArgumentException("Duplicate service: " + service.id());
        }
        for (ServiceNode service : entries.values()) {
            for (String dependent : service.dependents()) {
                if (!entries.containsKey(dependent))
                    throw new IllegalArgumentException("Unknown dependent: " + dependent);
            }
        }
        this.nodes = Collections.unmodifiableMap(entries);
    }

    public ImpactReport analyze(String failedId) {
        ServiceNode failed = nodes.get(failedId);
        if (failed == null) throw new IllegalArgumentException("Unknown failing service: " + failedId);
        Set<String> visited = new HashSet<>();
        visited.add(failedId);
        ArrayDeque<Visit> queue = new ArrayDeque<>();
        queue.add(new Visit(failedId, List.of(failedId)));
        List<AffectedService> affected = new ArrayList<>();

        while (!queue.isEmpty()) {
            Visit visit = queue.removeFirst();
            ServiceNode current = nodes.get(visit.id());
            for (String dependentId : current.dependents()) {
                if (!visited.add(dependentId)) continue;
                ServiceNode dependent = nodes.get(dependentId);
                List<String> path = new ArrayList<>(visit.path());
                path.add(dependentId);
                affected.add(new AffectedService(dependent.id(), dependent.label(),
                    dependent.owner(), dependent.criticality(), path.size() - 1, path));
                queue.addLast(new Visit(dependentId, path));
            }
        }

        int directCount = (int) affected.stream().filter(item -> item.depth() == 1).count();
        long critical = affected.stream().filter(item -> item.criticality() == 3).count();
        String advisoryPriority = failed.criticality() == 3
                && (affected.size() >= 3 || critical >= 2) ? "P1"
                : failed.criticality() == 3 || affected.size() >= 3 ? "P2"
                : !affected.isEmpty() ? "P3" : "P4";
        List<String> recommendations = List.of(
            "Escalate to " + failed.owner() + " and validate the affected service.",
            "Verify downstream impact in " + directCount + " immediate dependent service(s).",
            "Record confirmed effects in the normal incident audit trail.");
        return new ImpactReport(failed, affected, directCount,
                affected.size() - directCount, advisoryPriority, recommendations);
    }

    private static ServiceNode node(String id, String label, String owner, int criticality, String... dependents) {
        return new ServiceNode(id, label, owner, criticality, List.of(dependents));
    }

    /** Mirrors the TypeScript demonstration topology; all links are illustrative. */
    public static ServiceDependencyGraph railwayExample() {
        return new ServiceDependencyGraph(List.of(
            node("NGET_CORE_DATABASE", "Booking Database", "Database & Infrastructure", 3,
                "TATKAL_BOOKING_ENGINE", "GENERAL_BOOKING", "PNR_ENQUIRY_API", "UPI_PAYMENT_GATEWAY"),
            node("UPI_PAYMENT_GATEWAY", "UPI Payment Gateway", "Payment Integrations", 3,
                "TATKAL_BOOKING_ENGINE", "GENERAL_BOOKING", "TICKET_CONFIRMATION", "REFUND_PROCESSING"),
            node("TATKAL_BOOKING_ENGINE", "Tatkal Booking", "Booking Systems", 3, "TICKET_CONFIRMATION"),
            node("GENERAL_BOOKING", "General Ticket Booking", "Booking Systems", 3, "TICKET_CONFIRMATION"),
            node("PNR_ENQUIRY_API", "PNR Enquiry API", "Railway Integrations", 2, "PASSENGER_NOTIFICATIONS"),
            node("AUTHENTICATION", "Authentication", "Identity & Access", 3,
                "PASSENGER_LOGIN", "TATKAL_BOOKING_ENGINE", "GENERAL_BOOKING"),
            node("SMS_GATEWAY", "SMS Gateway", "Messaging", 2, "OTP_DELIVERY", "PASSENGER_NOTIFICATIONS"),
            node("OTP_DELIVERY", "OTP Delivery", "Messaging", 2, "PASSENGER_LOGIN"),
            node("PASSENGER_LOGIN", "Passenger Login", "Identity & Access", 2),
            node("TICKET_CONFIRMATION", "Ticket Confirmation", "Booking Systems", 3, "PASSENGER_NOTIFICATIONS"),
            node("REFUND_PROCESSING", "Refund Processing", "Payments & Reconciliation", 2),
            node("PASSENGER_NOTIFICATIONS", "Passenger Notifications", "Messaging", 1),
            node("E_CATERING_PORTAL", "E-Catering Portal", "Catering Platforms", 2, "CATERING_ORDERS"),
            node("CATERING_ORDERS", "Catering Orders", "Catering Platforms", 1)
        ));
    }
}
