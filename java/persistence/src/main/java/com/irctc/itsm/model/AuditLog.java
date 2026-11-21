package com.irctc.itsm.model;

import java.time.LocalDateTime;

public class AuditLog {
    private Long logId;
    private String incidentId;
    private Long performedByUserId;
    private String action;
    private String previousState;
    private String newState;
    private String description;
    private LocalDateTime timestamp;

    public AuditLog() {
        this.timestamp = LocalDateTime.now();
    }

    public AuditLog(String incidentId, Long performedByUserId, String action,
                    String previousState, String newState, String description) {
        this.incidentId = incidentId;
        this.performedByUserId = performedByUserId;
        this.action = action;
        this.previousState = previousState;
        this.newState = newState;
        this.description = description;
        this.timestamp = LocalDateTime.now();
    }

    public Long getLogId() { return logId; }
    public void setLogId(Long logId) { this.logId = logId; }

    public String getIncidentId() { return incidentId; }
    public void setIncidentId(String incidentId) { this.incidentId = incidentId; }

    public Long getPerformedByUserId() { return performedByUserId; }
    public void setPerformedByUserId(Long performedByUserId) { this.performedByUserId = performedByUserId; }

    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }

    public String getPreviousState() { return previousState; }
    public void setPreviousState(String previousState) { this.previousState = previousState; }

    public String getNewState() { return newState; }
    public void setNewState(String newState) { this.newState = newState; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
}