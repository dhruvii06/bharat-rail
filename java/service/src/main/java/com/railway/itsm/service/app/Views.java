package com.railway.itsm.service.app;

import java.time.Instant;
import java.util.List;

/** JSON shapes returned to the Node API and the React frontend (see shared/domain.ts). */
public final class Views {
    private Views() {}

    public record IncidentView(String id, String title, String description, String category,
                               long serviceId, String serviceName, int impact, int urgency, int criticality,
                               int affectedUsers, boolean tatkalWindow, String priority, String priorityReason,
                               String status, Long reporterId, String reporterName, Long assigneeId, String assigneeName,
                               Instant createdAt, Instant acknowledgedAt, Instant responseDueAt, Instant resolutionDueAt,
                               Instant resolvedAt, String sla, String informationRequest, Instant informationRequestedAt,
                               ResolutionView resolution, List<HistoryView> history, List<String> allowedActions,
                               List<SimilarView> similar) {}

    public record ResolutionView(String summary, String rootCause, Instant resolvedAt, Long technicianId,
                                 String technicianName, Integer feedback) {}

    public record HistoryView(Instant at, Long actorId, String actorName, String action, String fromStatus,
                              String toStatus, String description) {}

    public record SimilarView(String id, String title, String status, String priority) {}

    public record ServiceView(long id, String name, String category, String criticality, int criticalityScore, boolean tatkalBookingPath) {}

    public record TechnicianView(long id, String name, String email, String skill, int workload, int capacity,
                                 int experienceYears, boolean available) {}

    public record NotificationView(long id, String incidentId, String type, String message, Instant createdAt, boolean read) {}

    public record NotificationList(List<NotificationView> items, long unread) {}

    /** {@code team} is the technician skill that handles the category; {@code standard} marks the eight built-in ones. */
    public record CategoryView(String code, String label, boolean active, String team, boolean standard) {}

    public record SlaPolicyView(String priority, int responseMinutes, int resolutionMinutes) {}

    public record SettingsView(String defaultAssignmentStrategy, List<String> assignmentStrategies) {}

    public record AuditSearchView(long id, String incidentId, Instant at, Long actorId, String actorName, String action,
                                  String fromStatus, String toStatus, String description) {}

    public record CreatedIncident(IncidentView incident, List<SimilarView> possibleDuplicates) {}

    public record Count(String label, long count) {}

    public record Overview(long total, long open, long critical, long resolved, long slaViolations,
                           Integer slaCompliancePercent, Double averageResolutionMinutes,
                           List<Count> byService, List<Count> byPriority, List<Count> byStatus,
                           List<TechnicianView> workload) {}
}
