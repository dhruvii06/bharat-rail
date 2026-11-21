package com.railway.itsm.domain.model;
import com.railway.itsm.domain.enums.*;
import com.railway.itsm.domain.exceptions.InvalidTransitionException;
import com.railway.itsm.domain.exceptions.UnauthorizedIncidentOperationException;
import java.time.Instant;
import java.util.*;
public final class Incident {
    private final UUID id;
    private final String title;
    private final String description;
    private final Employee reporter;
    private final RailwayService affectedService;
    private final IncidentCategory category;
    private final Impact impact;
    private final Urgency urgency;
    private final int affectedUsers;
    private final boolean criticalSecurityIncident;
    private final boolean peakTatkalIncident;
    private final Instant createdAt;
    private final List<AuditEntry> auditTrail=new ArrayList<>();
    private IncidentStatus status=IncidentStatus.NEW;
    private Priority priority;
    private SLAPolicy slaPolicy;
    private Technician assignedTechnician;
    private Instant acknowledgedAt;
    private Instant resolvedAt;
    private Resolution resolution;
    public Incident(String title,String description,Employee reporter,RailwayService affectedService,
                    IncidentCategory category,Impact impact,Urgency urgency,int affectedUsers,
                    boolean criticalSecurityIncident,boolean peakTatkalIncident,Instant createdAt){
        this(UUID.randomUUID(),title,description,reporter,affectedService,category,impact,urgency,
             affectedUsers,criticalSecurityIncident,peakTatkalIncident,createdAt);
        record(reporter,"CREATED",IncidentStatus.NEW,IncidentStatus.NEW,"Incident submitted",createdAt);
    }
    private Incident(UUID id,String title,String description,Employee reporter,RailwayService affectedService,
                    IncidentCategory category,Impact impact,Urgency urgency,int affectedUsers,
                    boolean criticalSecurityIncident,boolean peakTatkalIncident,Instant createdAt){
        if(title==null||title.isBlank()||description==null||description.isBlank()||affectedUsers<0)
            throw new IllegalArgumentException("Incident requires title/description and nonnegative affected users");
        this.id=Objects.requireNonNull(id);
        this.title=title;this.description=description;this.reporter=Objects.requireNonNull(reporter);
        this.affectedService=Objects.requireNonNull(affectedService);this.category=Objects.requireNonNull(category);
        this.impact=Objects.requireNonNull(impact);this.urgency=Objects.requireNonNull(urgency);
        this.affectedUsers=affectedUsers;this.criticalSecurityIncident=criticalSecurityIncident;
        this.peakTatkalIncident=peakTatkalIncident;this.createdAt=Objects.requireNonNull(createdAt);
    }
    /**
     * Rebuilds an incident that was saved earlier, in its saved state, so the lifecycle rules
     * can validate the next action. Used by the persistence adapter; records no new audit entry.
     */
    public static Incident restore(UUID id,String title,String description,Employee reporter,RailwayService affectedService,
                                   IncidentCategory category,Impact impact,Urgency urgency,int affectedUsers,
                                   boolean criticalSecurityIncident,boolean peakTatkalIncident,Instant createdAt,
                                   IncidentStatus status,Priority priority,Technician assignedTechnician,
                                   Instant acknowledgedAt,Instant resolvedAt,Resolution resolution){
        Incident incident=new Incident(id,title,description,reporter,affectedService,category,impact,urgency,
                                       affectedUsers,criticalSecurityIncident,peakTatkalIncident,createdAt);
        incident.status=Objects.requireNonNull(status);
        if(status!=IncidentStatus.NEW && priority==null)
            throw new IllegalArgumentException("A classified incident needs a priority");
        incident.priority=priority;
        incident.slaPolicy=priority==null?null:SLAPolicy.forPriority(priority);
        if(status.compareTo(IncidentStatus.ASSIGNED)>=0 && assignedTechnician==null)
            throw new IllegalArgumentException("An assigned incident needs a technician");
        incident.assignedTechnician=assignedTechnician;
        incident.acknowledgedAt=acknowledgedAt;incident.resolvedAt=resolvedAt;incident.resolution=resolution;
        return incident;
    }
    public void classify(Priority priority,User actor,Instant now){
        require(IncidentStatus.NEW);
        this.priority=Objects.requireNonNull(priority);this.slaPolicy=SLAPolicy.forPriority(priority);
        move(IncidentStatus.CLASSIFIED,actor,"CLASSIFIED","Priority="+priority,now);
    }
    public void assign(Technician technician,User actor,Instant now){
        require(IncidentStatus.CLASSIFIED);
        Technician selected=Objects.requireNonNull(technician);
        selected.takeIncident();this.assignedTechnician=selected;
        move(IncidentStatus.ASSIGNED,actor,"ASSIGNED","Technician="+selected.getName(),now);
    }
    public void acknowledge(Technician actor,Instant now){
        requireAssignedActor(actor);require(IncidentStatus.ASSIGNED);
        acknowledgedAt=Objects.requireNonNull(now);
        move(IncidentStatus.ACKNOWLEDGED,actor,"ACKNOWLEDGED","Acknowledged",now);
    }
    public void startInvestigation(Technician actor,Instant now){
        requireAssignedActor(actor);require(IncidentStatus.ACKNOWLEDGED);
        move(IncidentStatus.IN_PROGRESS,actor,"INVESTIGATING","Investigation started",now);
    }
    public void resolve(Technician actor,String summary,String rootCause,Instant now){
        requireAssignedActor(actor);require(IncidentStatus.IN_PROGRESS);
        this.resolution=new Resolution(summary,rootCause,Objects.requireNonNull(now));
        resolvedAt=now;move(IncidentStatus.RESOLVED,actor,"RESOLVED",summary,now);
        assignedTechnician.finishIncident();
    }
    public void verify(Employee actor,Instant now){
        if(!reporter.getId().equals(actor.getId())) throw new UnauthorizedIncidentOperationException("Only reporter may verify");
        require(IncidentStatus.RESOLVED);
        move(IncidentStatus.VERIFIED,actor,"VERIFIED","Reporter accepted fix",now);
    }
    public void close(Administrator actor,Instant now){
        require(IncidentStatus.VERIFIED);
        move(IncidentStatus.CLOSED,actor,"CLOSED","Incident closed",now);
    }
    private void requireAssignedActor(Technician actor){
        if(actor==null||assignedTechnician==null||!assignedTechnician.getId().equals(actor.getId()))
            throw new UnauthorizedIncidentOperationException("Only assigned technician can work on incident");
    }
    private void require(IncidentStatus expected){
        if(status!=expected) throw new InvalidTransitionException("Expected "+expected+"; actual "+status);
    }
    private void move(IncidentStatus next,User actor,String action,String details,Instant now){
        Objects.requireNonNull(actor); Objects.requireNonNull(now);
        IncidentStatus previous=status;status=next;record(actor,action,previous,next,details,now);
    }
    private void record(User actor,String action,IncidentStatus from,IncidentStatus to,String details,Instant now){
        auditTrail.add(new AuditEntry(id,now,actor.getId(),action,from,to,details));
    }
    public UUID getId(){return id;}
    public String getTitle(){return title;}
    public String getDescription(){return description;}
    public Employee getReporter(){return reporter;}
    public RailwayService getAffectedService(){return affectedService;}
    public IncidentCategory getCategory(){return category;}
    public Impact getImpact(){return impact;}
    public Urgency getUrgency(){return urgency;}
    public int getAffectedUsers(){return affectedUsers;}
    public boolean isCriticalSecurityIncident(){return criticalSecurityIncident;}
    public boolean isPeakTatkalIncident(){return peakTatkalIncident;}
    public Instant getCreatedAt(){return createdAt;}
    public IncidentStatus getStatus(){return status;}
    public Priority getPriority(){return priority;}
    public SLAPolicy getSlaPolicy(){return slaPolicy;}
    public Technician getAssignedTechnician(){return assignedTechnician;}
    public Instant getAcknowledgedAt(){return acknowledgedAt;}
    public Instant getResolvedAt(){return resolvedAt;}
    public Resolution getResolution(){return resolution;}
    public List<AuditEntry> getAuditTrail(){return List.copyOf(auditTrail);}
}
