package com.irctc.itsm.model;

public class SLAPolicy {
    private Long slaId;
    private Priority priority;
    private int responseTargetMins;
    private int resolutionTargetMins;

    public SLAPolicy() {}

    public SLAPolicy(Long slaId, Priority priority, int responseTargetMins, int resolutionTargetMins) {
        this.slaId = slaId;
        this.priority = priority;
        this.responseTargetMins = responseTargetMins;
        this.resolutionTargetMins = resolutionTargetMins;
    }

    public Long getSlaId() { return slaId; }
    public void setSlaId(Long slaId) { this.slaId = slaId; }

    public Priority getPriority() { return priority; }
    public void setPriority(Priority priority) { this.priority = priority; }

    public int getResponseTargetMins() { return responseTargetMins; }
    public void setResponseTargetMins(int responseTargetMins) { this.responseTargetMins = responseTargetMins; }

    public int getResolutionTargetMins() { return resolutionTargetMins; }
    public void setResolutionTargetMins(int resolutionTargetMins) { this.resolutionTargetMins = resolutionTargetMins; }
}