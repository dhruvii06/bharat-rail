package com.irctc.itsm.model;

import java.time.LocalDateTime;

public class Incident {
    private String incidentId;
    private Long reporterId;
    private Long serviceId;
    private String category;
    private String title;
    private String description;
    private SeverityLevel impact;
    private SeverityLevel urgency;
    private Priority priority;
    private boolean tatkalWindow;
    private IncidentStatus status;
    private Long assignedTechnicianId;
    private Long slaId;
    private LocalDateTime createdAt;
    private LocalDateTime slaResponseDeadline;
    private LocalDateTime slaResolutionDeadline;
    private boolean slaViolated;

    public Incident() {
        this.status = IncidentStatus.NEW;
        this.createdAt = LocalDateTime.now();
    }

    public String getIncidentId() { return incidentId; }
    public void setIncidentId(String incidentId) { this.incidentId = incidentId; }

    public Long getReporterId() { return reporterId; }
    public void setReporterId(Long reporterId) { this.reporterId = reporterId; }

    public Long getServiceId() { return serviceId; }
    public void setServiceId(Long serviceId) { this.serviceId = serviceId; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public SeverityLevel getImpact() { return impact; }
    public void setImpact(SeverityLevel impact) { this.impact = impact; }

    public SeverityLevel getUrgency() { return urgency; }
    public void setUrgency(SeverityLevel urgency) { this.urgency = urgency; }

    public Priority getPriority() { return priority; }
    public void setPriority(Priority priority) { this.priority = priority; }

    public boolean isTatkalWindow() { return tatkalWindow; }
    public void setTatkalWindow(boolean tatkalWindow) { this.tatkalWindow = tatkalWindow; }

    public IncidentStatus getStatus() { return status; }
    public void setStatus(IncidentStatus status) { this.status = status; }

    public Long getAssignedTechnicianId() { return assignedTechnicianId; }
    public void setAssignedTechnicianId(Long assignedTechnicianId) { this.assignedTechnicianId = assignedTechnicianId; }

    public Long getSlaId() { return slaId; }
    public void setSlaId(Long slaId) { this.slaId = slaId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getSlaResponseDeadline() { return slaResponseDeadline; }
    public void setSlaResponseDeadline(LocalDateTime slaResponseDeadline) { this.slaResponseDeadline = slaResponseDeadline; }

    public LocalDateTime getSlaResolutionDeadline() { return slaResolutionDeadline; }
    public void setSlaResolutionDeadline(LocalDateTime slaResolutionDeadline) { this.slaResolutionDeadline = slaResolutionDeadline; }

    public boolean isSlaViolated() { return slaViolated; }
    public void setSlaViolated(boolean slaViolated) { this.slaViolated = slaViolated; }
}