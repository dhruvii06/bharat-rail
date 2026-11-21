package com.irctc.itsm.model;

public class TechnicianDetail {
    private Long technicianId;
    private String skillCategory;
    private int currentWorkload;
    private int experienceYears;
    private boolean available;

    public TechnicianDetail() {}

    public TechnicianDetail(Long technicianId, String skillCategory, int currentWorkload, int experienceYears, boolean available) {
        this.technicianId = technicianId;
        this.skillCategory = skillCategory;
        this.currentWorkload = currentWorkload;
        this.experienceYears = experienceYears;
        this.available = available;
    }

    public Long getTechnicianId() { return technicianId; }
    public void setTechnicianId(Long technicianId) { this.technicianId = technicianId; }

    public String getSkillCategory() { return skillCategory; }
    public void setSkillCategory(String skillCategory) { this.skillCategory = skillCategory; }

    public int getCurrentWorkload() { return currentWorkload; }
    public void setCurrentWorkload(int currentWorkload) { this.currentWorkload = currentWorkload; }

    public int getExperienceYears() { return experienceYears; }
    public void setExperienceYears(int experienceYears) { this.experienceYears = experienceYears; }

    public boolean isAvailable() { return available; }
    public void setAvailable(boolean available) { this.available = available; }
}