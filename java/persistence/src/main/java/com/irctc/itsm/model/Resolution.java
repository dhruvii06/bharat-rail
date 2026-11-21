package com.irctc.itsm.model;

import java.time.LocalDateTime;

public class Resolution {
    private Long resolutionId;
    private String incidentId;
    private Long technicianId;
    private String rootCause;
    private String resolutionSummary;
    private LocalDateTime resolvedAt;
    private Integer userFeedback;

    public Resolution() {
        this.resolvedAt = LocalDateTime.now();
    }

    public Resolution(String incidentId, Long technicianId, String rootCause, String resolutionSummary) {
        this.incidentId = incidentId;
        this.technicianId = technicianId;
        this.rootCause = rootCause;
        this.resolutionSummary = resolutionSummary;
        this.resolvedAt = LocalDateTime.now();
    }

    public Long getResolutionId() { return resolutionId; }
    public void setResolutionId(Long resolutionId) { this.resolutionId = resolutionId; }

    public String getIncidentId() { return incidentId; }
    public void setIncidentId(String incidentId) { this.incidentId = incidentId; }

    public Long getTechnicianId() { return technicianId; }
    public void setTechnicianId(Long technicianId) { this.technicianId = technicianId; }

    public String getRootCause() { return rootCause; }
    public void setRootCause(String rootCause) { this.rootCause = rootCause; }

    public String getResolutionSummary() { return resolutionSummary; }
    public void setResolutionSummary(String resolutionSummary) { this.resolutionSummary = resolutionSummary; }

    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

    public Integer getUserFeedback() { return userFeedback; }
    public void setUserFeedback(Integer userFeedback) { this.userFeedback = userFeedback; }
}