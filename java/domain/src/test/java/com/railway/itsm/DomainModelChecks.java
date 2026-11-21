package com.railway.itsm;
import com.railway.itsm.application.*;
import com.railway.itsm.domain.enums.*;
import com.railway.itsm.domain.events.*;
import com.railway.itsm.domain.exceptions.*;
import com.railway.itsm.domain.model.*;
import com.railway.itsm.domain.strategy.*;
import com.railway.itsm.infrastructure.*;
import java.time.*;
import java.util.*;

/** Run without test dependencies: java -cp out com.railway.itsm.DomainModelChecks */
public final class DomainModelChecks {
    private static int count;
    private static final Instant START=Instant.parse("2026-11-12T04:00:00Z");
    private static final Employee EMP=new Employee("Reporter","reporter@example.test");
    private static final Administrator ADMIN=new Administrator("Manager","manager@example.test");
    private static final RailwayService SERVICE=new RailwayService("Tatkal",3);
    static Incident incident(Impact i,Urgency u,boolean sec,boolean peak){
        return new Incident("Payment failure","UPI payment callback is down",EMP,SERVICE,
            IncidentCategory.PAYMENT,i,u,1000,sec,peak,START);
    }
    static void check(boolean passed,String name){
        if(!passed)throw new AssertionError(name);count++;System.out.println("PASS "+count+": "+name);
    }
    static void throwsException(Class<? extends Throwable> expected,Runnable r,String name){
        boolean caught=false;
        try{r.run();}catch(Throwable ex){if(!expected.isInstance(ex))throw ex;caught=true;}
        check(caught,name);
    }
    public static void main(String[] ignored){
        PriorityStrategy priority=new RailwayPriorityStrategy();
        check(priority.calculate(incident(Impact.HIGH,Urgency.HIGH,false,true))==Priority.P1_CRITICAL,"peak Tatkal P1");
        check(priority.calculate(incident(Impact.LOW,Urgency.LOW,true,false))==Priority.P1_CRITICAL,"critical security override");
        check(priority.calculate(incident(Impact.HIGH,Urgency.MEDIUM,false,false))==Priority.P2_HIGH,"score 18 P2");
        check(priority.calculate(incident(Impact.LOW,Urgency.MEDIUM,false,false))==Priority.P3_MEDIUM,"score 6 P3");
        check(priority.calculate(incident(Impact.LOW,Urgency.LOW,false,false))==Priority.P4_LOW,"score 3 P4");
        Incident inc=incident(Impact.HIGH,Urgency.HIGH,false,true);
        throwsException(InvalidTransitionException.class,()->inc.close(ADMIN,START),"cannot close NEW");
        check(inc.getStatus()==IncidentStatus.NEW,"initial state");
        check(inc.getAuditTrail().size()==1,"created audit entry");
        inc.classify(priority.calculate(inc),ADMIN,START.plusSeconds(1));
        check(inc.getSlaPolicy().responseTarget().equals(Duration.ofMinutes(5)),"P1 response deadline target");
        check(inc.getSlaPolicy().resolutionTarget().equals(Duration.ofMinutes(30)),"P1 resolution deadline target");
        Technician pay=new Technician("Pay","pay@example.test",Set.of(Skill.PAYMENTS),1);
        Technician db=new Technician("DB","db@example.test",Set.of(Skill.DATABASE),2);
        throwsException(NoTechnicianAvailableException.class,
            ()->new SkillBasedAssignmentStrategy().select(inc,List.of(db)),"reject wrong skill");
        check(new SkillBasedAssignmentStrategy().select(inc,List.of(db,pay))==pay,"skill-based chooses eligible");
        inc.assign(pay,ADMIN,START.plusSeconds(2));
        check(pay.getActiveIncidents()==1,"assignment increases workload");
        throwsException(IllegalStateException.class,()->pay.takeIncident(),"capacity enforcement");
        Technician another=new Technician("Another","another@example.test",Set.of(Skill.PAYMENTS),3);
        check(new LoadBasedAssignmentStrategy().select(inc,List.of(pay,another))==another,"least loaded technician");
        check(SLAEvaluator.evaluate(inc,START.plusSeconds(301)).responseViolated(),"unacknowledged past SLA");
        throwsException(SecurityException.class,()->inc.acknowledge(another,START.plusSeconds(3)),"only assigned tech can acknowledge");
        inc.acknowledge(pay,START.plusSeconds(60));
        check(!SLAEvaluator.evaluate(inc,START.plusSeconds(500)).responseViolated(),"acknowledged on time remains compliant");
        check(SLAEvaluator.evaluate(inc,START.plusSeconds(1700)).resolutionAtRisk(),"resolution risk warning");
        check(SLAEvaluator.evaluate(inc,START.plusSeconds(1900)).resolutionViolated(),"resolution deadline breached");
        inc.startInvestigation(pay,START.plusSeconds(100));
        inc.resolve(pay,"Restored callback","Timeout",START.plusSeconds(600));
        check(pay.getActiveIncidents()==0,"resolution frees workload");
        check(inc.getResolution()!=null,"resolution stored");
        throwsException(SecurityException.class,()->inc.verify(new Employee("Other","other@example.test"),START.plusSeconds(700)),"only reporter can verify");
        inc.verify(EMP,START.plusSeconds(700));inc.close(ADMIN,START.plusSeconds(800));
        check(inc.getStatus()==IncidentStatus.CLOSED,"full lifecycle closes");
        check(inc.getAuditTrail().size()==8,"audit records all eight transitions/events");
        Incident draft=incident(Impact.LOW,Urgency.LOW,false,false);
        InMemoryIncidentRepository repo=new InMemoryIncidentRepository();repo.save(draft);
        check(repo.findById(draft.getId()).orElseThrow()==draft,"repository readback");
        EventPublisher events=new EventPublisher();List<IncidentEvent> received=new ArrayList<>();events.subscribe(received::add);
        events.publish(new IncidentEvent(draft.getId(),"TEST","message",START));
        check(received.size()==1,"observer notification");
        Incident similar=new Incident("Payment timeout","Payment backend",EMP,SERVICE,IncidentCategory.PAYMENT,
            Impact.LOW,Urgency.LOW,10,false,false,START);
        IncidentManagementService svc=new IncidentManagementService(repo,priority,new LoadBasedAssignmentStrategy(),events);
        check(svc.findPotentialDuplicates(similar).size()==1,"duplicate candidate detection");
        check(inc.getAuditTrail().stream().allMatch(e->e.actorId()!=null),"audit attributes actor");
        throwsException(IllegalArgumentException.class,()->new RailwayService("Bad",4),"invalid criticality rejected");
        UUID savedId=UUID.randomUUID();
        Technician savedTech=new Technician(UUID.randomUUID(),"Saved","saved@example.test",Set.of(Skill.PAYMENTS),3,1,true);
        Incident restored=Incident.restore(savedId,"Saved","Loaded from storage",EMP,SERVICE,IncidentCategory.PAYMENT,
            Impact.HIGH,Urgency.HIGH,10,false,false,START,IncidentStatus.ASSIGNED,Priority.P1_CRITICAL,savedTech,null,null,null);
        check(restored.getId().equals(savedId) && restored.getAuditTrail().isEmpty(),"restore keeps identity, adds no audit");
        throwsException(InvalidTransitionException.class,()->restored.close(ADMIN,START),"restored incident still enforces lifecycle");
        System.out.println("TOTAL: "+count+" checks passed");
    }
}
