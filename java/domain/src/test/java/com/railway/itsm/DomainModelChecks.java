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
        throwsException(TechnicianWorkloadExceededException.class,()->pay.takeIncident(),"capacity enforcement with typed exception");
        pay.setAvailable(false);
        throwsException(TechnicianUnavailableException.class,()->pay.takeIncident(),"unavailable technician typed exception");
        pay.setAvailable(true);
        Technician another=new Technician("Another","another@example.test",Set.of(Skill.PAYMENTS),3);
        check(new LoadBasedAssignmentStrategy().select(inc,List.of(pay,another))==another,"least loaded technician");
        check(SLAEvaluator.evaluate(inc,START.plusSeconds(301)).responseViolated(),"unacknowledged past SLA");
        throwsException(UnauthorizedIncidentOperationException.class,()->inc.acknowledge(another,START.plusSeconds(3)),"only assigned tech can acknowledge");
        inc.acknowledge(pay,START.plusSeconds(60));
        check(!SLAEvaluator.evaluate(inc,START.plusSeconds(500)).responseViolated(),"acknowledged on time remains compliant");
        check(SLAEvaluator.evaluate(inc,START.plusSeconds(1700)).resolutionAtRisk(),"resolution risk warning");
        check(SLAEvaluator.evaluate(inc,START.plusSeconds(1900)).resolutionViolated(),"resolution deadline breached");
        inc.startInvestigation(pay,START.plusSeconds(100));
        inc.resolve(pay,"Restored callback","Timeout",START.plusSeconds(600));
        check(pay.getActiveIncidents()==0,"resolution frees workload");
        check(inc.getResolution()!=null,"resolution stored");
        throwsException(UnauthorizedIncidentOperationException.class,()->inc.verify(new Employee("Other","other@example.test"),START.plusSeconds(700)),"only reporter can verify");
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
        throwsException(SLAPolicyNotFoundException.class,()->SLAPolicy.forPriority(null),"missing SLA policy rejected");
        check(priority.calculate(incident(Impact.HIGH,Urgency.HIGH,false,false))==Priority.P1_CRITICAL,"score 27 P1 without override");
        check(priority.calculate(incident(Impact.MEDIUM,Urgency.MEDIUM,false,false))==Priority.P2_HIGH,"score 12 P2");
        check(priority.calculate(incident(Impact.MEDIUM,Urgency.LOW,false,false))==Priority.P3_MEDIUM,"score 6 P3");
        check(priority.calculate(incident(Impact.LOW,Urgency.LOW,false,true))==Priority.P4_LOW,"Tatkal without maximum impact and urgency does not override");

        var graph=com.railway.itsm.domain.impact.ServiceDependencyGraph.railwayExample();
        var paymentImpact=graph.analyze("UPI_PAYMENT_GATEWAY");
        check(paymentImpact.directCount()==4 && paymentImpact.indirectCount()>=1,
            "payment outage cascades to direct and indirect dependents");
        check(paymentImpact.affected().stream().anyMatch(a->a.id().equals("TATKAL_BOOKING_ENGINE") && a.depth()==1),
            "Tatkal affected directly by payment outage");
        check(paymentImpact.affected().stream().map(a->a.id()).distinct().count()==paymentImpact.affected().size(),
            "dependency analysis never duplicates affected services");
        check(graph.analyze("CATERING_ORDERS").affected().isEmpty(),
            "leaf service outage has no predicted blast radius");
        throwsException(IllegalArgumentException.class,()->graph.analyze("NOT_CONFIGURED"),
            "unknown service cannot be simulated");
        var cycleGraph=new com.railway.itsm.domain.impact.ServiceDependencyGraph(List.of(
            new com.railway.itsm.domain.impact.ServiceDependencyGraph.ServiceNode("A","A","Ops",3,List.of("B")),
            new com.railway.itsm.domain.impact.ServiceDependencyGraph.ServiceNode("B","B","Ops",2,List.of("A"))));
        check(cycleGraph.analyze("A").affected().size()==1,
            "cyclic dependency graph terminates safely");
        System.out.println("TOTAL: "+count+" checks passed");
    }
}
