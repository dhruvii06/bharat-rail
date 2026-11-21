package com.railway.itsm.domain.model;
import com.railway.itsm.domain.enums.Skill;
import java.util.Set;
public final class Technician extends User {
    private final Set<Skill> skills;
    private final int maxConcurrentIncidents;
    private boolean available=true;
    private int activeIncidents=0;
    public Technician(String name,String email,Set<Skill> skills,int capacity){
        super(name,email);
        if(skills==null || skills.isEmpty() || capacity<1) throw new IllegalArgumentException("Skills and positive capacity required");
        this.skills=Set.copyOf(skills); this.maxConcurrentIncidents=capacity;
    }
    @Override public String getRole(){return "TECHNICIAN";}
    public Set<Skill> getSkills(){return skills;}
    public boolean isAvailable(){return available && activeIncidents<maxConcurrentIncidents;}
    public void setAvailable(boolean available){this.available=available;}
    public int getActiveIncidents(){return activeIncidents;}
    public void takeIncident(){
        if(!isAvailable()) throw new IllegalStateException("Technician unavailable or at capacity");
        activeIncidents++;
    }
    public void finishIncident(){if(activeIncidents<=0) throw new IllegalStateException("No active incidents"); activeIncidents--;}
}
