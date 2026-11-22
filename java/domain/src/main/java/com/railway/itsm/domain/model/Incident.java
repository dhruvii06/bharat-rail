package com.railway.itsm.domain.model;
import com.railway.itsm.domain.enums.*;
import com.railway.itsm.domain.exceptions.InvalidTransitionException;
import com.railway.itsm.domain.exceptions.UnauthorizedIncidentOperationException;
import java.time.Instant;
import java.util.*;
public final class Incident {
    private final UUID id;
    private String title;
    private String description;
    private final Reporter reporter;
    private final RailwayService affectedService;
    private IncidentCategory category;
    private final Impact impact;
    private final Urgency urgency;
    private final int affectedUsers;
    private boolean criticalSecurityIncident;
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
    private String informationRequest;
    private Instant informationRequestedAt;
    public Incident(String title,String description,Reporter reporter,RailwayService affectedService,
                    IncidentCategory category,Impact impact,Urgency urgency,int affectedUsers,
                    boolean criticalSecurityIncident,boolean peakTatkalIncident,Instant createdAt){
        this(UUID.randomUUID(),title,description,reporter,affectedService,category,impact,urgency,
             affectedUsers,criticalSecurityIncident,peakTatkalIncident,createdAt);
        record(reporter,"CREATED",IncidentStatus.NEW,IncidentStatus.NEW,"Incident submitted",createdAt);
    }
    private Incident(UUID id,String title,String description,Reporter reporter,RailwayService affectedService,
                    IncidentCategory category,Impact impact,Urgency urgency,int affectedUsers,
                    boolean criticalSecurityIncident,boolean peakTatkalIncident,Instant createdAt){
        if(title==null||title.isBlank()||description==null||description.isBlank()||affectedUsers<0)
            throw new IllegalArgumentException("Incident requires title/description and nonnegative affected users");
        this.id=Objects.requireNonNull(id);
        this.title=title;this.description=description;this.reporter=Objects.requireNonNull(reporter);
        this.affectedService=Objects.requireNonNull(affectedService);this.category=Objects.requireNonNull(category);
        this.impact=Objects.requireNonNull(impact);this.urgency=Objects.requireNonNull(urgency);
        this.affectedUsers=affectedUsers;this.criticalSecurityIncident=criticalSecurityIncident;
        // The Tatkal override only applies to services a Tatkal booking depends on; a catering or
        // enquiry fault reported at 10:05 is judged on impact, urgency and criticality alone.
        this.peakTatkalIncident=peakTatkalIncident&&affectedService.isOnTatkalBookingPath();this.createdAt=Objects.requireNonNull(createdAt);
    }
    /**
     * Rebuilds an incident that was saved earlier, in its saved state, so the lifecycle rules
     * can validate the next action. Used by the persistence adapter; records no new audit entry.
     */
    public static Incident restore(UUID id,String title,String description,Reporter reporter,RailwayService affectedService,
                                   IncidentCategory category,Impact impact,Urgency urgency,int affectedUsers,
                                   boolean criticalSecurityIncident,boolean peakTatkalIncident,Instant createdAt,
                                   IncidentStatus status,Priority priority,Technician assignedTechnician,
                                   Instant acknowledgedAt,Instant resolvedAt,Resolution resolution){
        return restore(id,title,description,reporter,affectedService,category,impact,urgency,affectedUsers,
                       criticalSecurityIncident,peakTatkalIncident,createdAt,status,priority,assignedTechnician,
                       acknowledgedAt,resolvedAt,resolution,null,null,null);
    }
    /**
     * Restore variant that also carries the SLA targets the incident was created with (so later policy
     * changes do not move its deadlines) and any open request for information to the reporter.
     */
    public static Incident restore(UUID id,String title,String description,Reporter reporter,RailwayService affectedService,
                                   IncidentCategory category,Impact impact,Urgency urgency,int affectedUsers,
                                   boolean criticalSecurityIncident,boolean peakTatkalIncident,Instant createdAt,
                                   IncidentStatus status,Priority priority,Technician assignedTechnician,
                                   Instant acknowledgedAt,Instant resolvedAt,Resolution resolution,
                                   SLAPolicy slaPolicy,String informationRequest,Instant informationRequestedAt){
        Incident incident=new Incident(id,title,description,reporter,affectedService,category,impact,urgency,
                                       affectedUsers,criticalSecurityIncident,peakTatkalIncident,createdAt);
        incident.status=Objects.requireNonNull(status);
        if(status!=IncidentStatus.NEW && priority==null)
            throw new IllegalArgumentException("A classified incident needs a priority");
        incident.priority=priority;
        incident.slaPolicy=priority==null?null:slaPolicy!=null?slaPolicy:SLAPolicy.forPriority(priority);
        incident.informationRequest=informationRequest==null||informationRequest.isBlank()?null:informationRequest;
        incident.informationRequestedAt=incident.informationRequest==null?null:informationRequestedAt;
        if(status.compareTo(IncidentStatus.ASSIGNED)>=0 && assignedTechnician==null)
            throw new IllegalArgumentException("An assigned incident needs a technician");
        incident.assignedTechnician=assignedTechnician;
        incident.acknowledgedAt=acknowledgedAt;incident.resolvedAt=resolvedAt;incident.resolution=resolution;
        return incident;
    }
    public void classify(Priority priority,User actor,Instant now){
        classify(priority,SLAPolicy.forPriority(priority),actor,now);
    }
    /** Classifies with a configured SLA policy (for example one the IT manager changed). */
    public void classify(Priority priority,SLAPolicy policy,User actor,Instant now){
        require(IncidentStatus.NEW);
        if(policy==null||policy.priority()!=priority) throw new IllegalArgumentException("SLA policy must match the priority");
        this.priority=Objects.requireNonNull(priority);this.slaPolicy=policy;
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
    /**
     * The assigned technician asks the reporter for more information. Allowed while the incident is
     * acknowledged or in progress, one open question at a time. The status does not change.
     */
    public void requestInformation(Technician actor,String question,Instant now){
        requireAssignedActor(actor);
        if(status!=IncidentStatus.ACKNOWLEDGED && status!=IncidentStatus.IN_PROGRESS)
            throw new InvalidTransitionException("Information can be requested only while acknowledged or in progress; actual "+status);
        if(informationRequest!=null) throw new InvalidTransitionException("Already waiting for the reporter to answer an earlier question");
        if(question==null||question.isBlank()) throw new IllegalArgumentException("A question is required");
        informationRequest=question.trim();informationRequestedAt=Objects.requireNonNull(now);
        record(actor,"INFO_REQUESTED",status,status,informationRequest,now);
    }
    /** The reporter answers the open question, which clears it. */
    public void provideInformation(Reporter actor,String answer,Instant now){
        if(actor==null||!reporter.getId().equals(actor.getId())) throw new UnauthorizedIncidentOperationException("Only the reporter can answer the technician's question");
        if(informationRequest==null) throw new InvalidTransitionException("No information has been requested");
        if(answer==null||answer.isBlank()) throw new IllegalArgumentException("An answer is required");
        informationRequest=null;informationRequestedAt=null;
        record(actor,"INFO_PROVIDED",status,status,answer.trim(),Objects.requireNonNull(now));
    }
    public void resolve(Technician actor,String summary,String rootCause,Instant now){
        requireAssignedActor(actor);require(IncidentStatus.IN_PROGRESS);
        if(informationRequest!=null) throw new InvalidTransitionException("Waiting for the reporter to answer: "+informationRequest);
        this.resolution=new Resolution(summary,rootCause,Objects.requireNonNull(now));
        resolvedAt=now;move(IncidentStatus.RESOLVED,actor,"RESOLVED",summary,now);
        assignedTechnician.finishIncident();
    }
    public void verify(Reporter actor,Instant now){
        if(!reporter.getId().equals(actor.getId())) throw new UnauthorizedIncidentOperationException("Only reporter may verify");
        require(IncidentStatus.RESOLVED);
        move(IncidentStatus.VERIFIED,actor,"VERIFIED","Reporter accepted fix",now);
    }
    public void close(Administrator actor,Instant now){
        require(IncidentStatus.VERIFIED);
        move(IncidentStatus.CLOSED,actor,"CLOSED","Incident closed",now);
    }
    /**
     * The IT manager overrides the calculated priority, with a reason. Allowed while the incident is
     * open (classified up to in progress). The new SLA policy replaces the old one; the status is unchanged.
     */
    public void changePriority(Priority newPriority,SLAPolicy newPolicy,Administrator actor,String reason,Instant now){
        Objects.requireNonNull(actor,"Only the IT manager can change priority");
        if(status==IncidentStatus.NEW||status==IncidentStatus.RESOLVED||status==IncidentStatus.VERIFIED||status==IncidentStatus.CLOSED)
            throw new InvalidTransitionException("Priority can only be changed while the incident is open; actual "+status);
        if(newPriority==null||newPolicy==null||newPolicy.priority()!=newPriority) throw new IllegalArgumentException("A priority and its matching SLA policy are required");
        if(newPriority==priority) throw new IllegalArgumentException("The incident is already "+newPriority);
        if(reason==null||reason.isBlank()) throw new IllegalArgumentException("A reason is required to change priority");
        Priority old=priority;
        priority=newPriority;slaPolicy=newPolicy;
        record(actor,"PRIORITY_CHANGED",status,status,old+" -> "+newPriority+": "+reason.trim(),Objects.requireNonNull(now));
    }
    /**
     * Corrects the incident's text or category. The reporter may fix the title and description until a
     * technician acknowledges the incident; the IT manager may edit any open incident and is the only one
     * who may change the category (which can change the security rule, so callers re-check priority).
     * Technicians cannot edit: they add notes instead.
     */
    public void edit(User actor,String newTitle,String newDescription,IncidentCategory newCategory,Instant now){
        Objects.requireNonNull(actor,"actor");
        if(status==IncidentStatus.RESOLVED||status==IncidentStatus.VERIFIED||status==IncidentStatus.CLOSED)
            throw new InvalidTransitionException("A "+status+" incident can no longer be edited");
        boolean manager=actor instanceof Administrator;
        if(!manager){
            if(!(actor instanceof Reporter)||!reporter.getId().equals(actor.getId()))
                throw new UnauthorizedIncidentOperationException("Only the reporter or the IT manager can edit an incident");
            if(status!=IncidentStatus.NEW&&status!=IncidentStatus.CLASSIFIED&&status!=IncidentStatus.ASSIGNED)
                throw new InvalidTransitionException("The technician is already working on it; send a message instead of editing");
            if(newCategory!=null&&!newCategory.equals(category))
                throw new UnauthorizedIncidentOperationException("Only the IT manager can change the category");
        }
        if(newTitle!=null&&newTitle.isBlank()||newDescription!=null&&newDescription.isBlank())
            throw new IllegalArgumentException("Title and description cannot be blank");
        List<String> changes=new ArrayList<>();
        if(newTitle!=null&&!newTitle.equals(title)){changes.add("title");}
        if(newDescription!=null&&!newDescription.equals(description)){changes.add("description");}
        boolean recategorised=newCategory!=null&&!newCategory.equals(category);
        if(changes.isEmpty()&&!recategorised) throw new IllegalArgumentException("Nothing was changed");
        String details=changes.isEmpty()?"":"Updated "+String.join(" and ",changes);
        if(recategorised) details=(details.isEmpty()?"":details+"; ")+"category "+category.code()+" -> "+newCategory.code();
        if(newTitle!=null)title=newTitle;
        if(newDescription!=null)description=newDescription;
        if(recategorised){category=newCategory;criticalSecurityIncident=newCategory.isSecurity();}
        record(actor,"EDITED",status,status,details,Objects.requireNonNull(now));
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
    public Reporter getReporter(){return reporter;}
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
    public boolean isAwaitingInformation(){return informationRequest!=null;}
    public String getInformationRequest(){return informationRequest;}
    public Instant getInformationRequestedAt(){return informationRequestedAt;}
    public List<AuditEntry> getAuditTrail(){return List.copyOf(auditTrail);}
}
