package com.railway.itsm.domain.model;
import com.railway.itsm.domain.enums.Skill;
import com.railway.itsm.domain.exceptions.TechnicianUnavailableException;
import com.railway.itsm.domain.exceptions.TechnicianWorkloadExceededException;
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
    /** Restores a technician loaded from storage, including current workload and availability. */
    public Technician(java.util.UUID id,String name,String email,Set<Skill> skills,int capacity,int activeIncidents,boolean available){
        super(id,name,email);
        if(skills==null || skills.isEmpty() || capacity<1 || activeIncidents<0) throw new IllegalArgumentException("Skills, positive capacity and nonnegative workload required");
        this.skills=Set.copyOf(skills); this.maxConcurrentIncidents=capacity;
        this.activeIncidents=activeIncidents; this.available=available;
    }
    @Override public String getRole(){return "TECHNICIAN";}
    public Set<Skill> getSkills(){return skills;}
    public boolean isAvailable(){return available && activeIncidents<maxConcurrentIncidents;}
    public void setAvailable(boolean available){this.available=available;}
    public int getActiveIncidents(){return activeIncidents;}
    public void takeIncident(){
        if(!available) throw new TechnicianUnavailableException("Technician "+getId()+" is unavailable");
        if(activeIncidents>=maxConcurrentIncidents) throw new TechnicianWorkloadExceededException("Technician "+getId()+" has reached capacity");
        activeIncidents++;
    }
    public void finishIncident(){if(activeIncidents<=0) throw new IllegalStateException("No active incidents"); activeIncidents--;}
}
