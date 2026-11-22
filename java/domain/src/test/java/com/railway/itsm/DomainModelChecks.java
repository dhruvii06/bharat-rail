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
    private static final RailwayService SERVICE=new RailwayService("Tatkal",3,true);
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
        Incident loadedSeparately=new Incident("Payment timeout again","Payment backend",EMP,SERVICE,
            IncidentCategory.of("PAYMENT","Payment",Skill.PAYMENTS),Impact.LOW,Urgency.LOW,10,false,false,START);
        check(svc.findPotentialDuplicates(loadedSeparately).size()==1,"duplicate detection compares categories by value, not by object");
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
        RailwayService booking=new RailwayService("Tatkal booking engine",1,true), catering=new RailwayService("E-catering",1,false);
        Incident onPath=new Incident("Booking down","Tatkal booking fails",EMP,booking,IncidentCategory.APPLICATION,Impact.HIGH,Urgency.HIGH,10,false,true,START);
        Incident offPath=new Incident("Catering down","Menu does not load",EMP,catering,IncidentCategory.APPLICATION,Impact.HIGH,Urgency.HIGH,10,false,true,START);
        check(onPath.isPeakTatkalIncident() && priority.calculate(onPath)==Priority.P1_CRITICAL,"Tatkal override applies to a booking-path service");
        check(!offPath.isPeakTatkalIncident() && priority.calculate(offPath)==Priority.P3_MEDIUM,"Tatkal override ignored for a service outside the booking path (3x3x1=9 gives P3)");
        IncidentCategory phishing=IncidentCategory.of(IncidentCategory.codeFor("Phishing e-mail"),"Phishing e-mail",Skill.SECURITY);
        check(phishing.code().equals("PHISHING_E_MAIL") && phishing.isSecurity() && phishing.equals(IncidentCategory.of("PHISHING_E_MAIL","Other label",Skill.SECURITY)),
            "an IT manager's new category gets a code, a team and value equality");
        check(!IncidentCategory.of("MOBILE_APP","Mobile app",Skill.APPLICATION).isSecurity() && IncidentCategory.standard().size()==8,"only categories handled by security count as security");
        throwsException(IllegalArgumentException.class,()->IncidentCategory.of("bad code","Bad",Skill.NETWORK),"invalid category code rejected");
        Incident editable=incident(Impact.MEDIUM,Urgency.MEDIUM,false,false);
        editable.classify(Priority.P2_HIGH,ADMIN,START);
        editable.edit(EMP,"UPI payment failure","UPI callback times out after 30 seconds",null,START.plusSeconds(5));
        check(editable.getTitle().equals("UPI payment failure") && editable.getAuditTrail().get(editable.getAuditTrail().size()-1).action().equals("EDITED"),
            "reporter corrects title and description before acknowledgement");
        throwsException(UnauthorizedIncidentOperationException.class,()->editable.edit(EMP,null,null,IncidentCategory.DATABASE,START.plusSeconds(6)),
            "reporter cannot change the category");
        throwsException(UnauthorizedIncidentOperationException.class,()->editable.edit(new Employee("Other","other@example.test"),"Other title",null,null,START.plusSeconds(6)),
            "another employee cannot edit");
        throwsException(IllegalArgumentException.class,()->editable.edit(EMP,"UPI payment failure",null,null,START.plusSeconds(6)),"an edit must change something");
        editable.edit(ADMIN,null,null,IncidentCategory.SECURITY,START.plusSeconds(7));
        check(editable.getCategory().equals(IncidentCategory.SECURITY) && editable.isCriticalSecurityIncident() && new RailwayPriorityStrategy().calculate(editable)==Priority.P1_CRITICAL,
            "IT manager recategorises to security; the security rule now gives P1");
        Incident ask=incident(Impact.HIGH,Urgency.HIGH,false,false);
        ask.classify(priority.calculate(ask),ADMIN,START);
        Technician helper=new Technician("Helper","helper@example.test",Set.of(Skill.PAYMENTS),3);
        ask.assign(helper,ADMIN,START);
        throwsException(InvalidTransitionException.class,()->ask.requestInformation(helper,"Which UPI app?",START),"cannot request information before acknowledging");
        ask.acknowledge(helper,START.plusSeconds(5));ask.startInvestigation(helper,START.plusSeconds(6));
        ask.requestInformation(helper,"Which UPI app was used?",START.plusSeconds(10));
        check(ask.isAwaitingInformation(),"assigned technician can request information");
        throwsException(InvalidTransitionException.class,()->ask.requestInformation(helper,"Another?",START.plusSeconds(11)),"one open question at a time");
        throwsException(InvalidTransitionException.class,()->ask.resolve(helper,"Fixed the callback","cause",START.plusSeconds(20)),"cannot resolve while waiting for the reporter");
        throwsException(UnauthorizedIncidentOperationException.class,()->ask.provideInformation(new Employee("Other","o2@example.test"),"x",START.plusSeconds(21)),"only the reporter can answer");
        ask.provideInformation(EMP,"PhonePe",START.plusSeconds(30));
        check(!ask.isAwaitingInformation() && ask.getAuditTrail().stream().anyMatch(e->e.action().equals("INFO_PROVIDED")),"reporter's answer clears the request");
        Incident configured=incident(Impact.LOW,Urgency.LOW,false,false);
        configured.classify(Priority.P4_LOW,new SLAPolicy(Priority.P4_LOW,Duration.ofMinutes(10),Duration.ofMinutes(60)),ADMIN,START);
        check(configured.getSlaPolicy().responseTarget().equals(Duration.ofMinutes(10)),"configured SLA policy is used");

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
        Customer rider=new Customer("Rider","rider@example.test");
        Incident publicReport=new Incident("App crash on payment","The app closes when I pay by UPI",rider,SERVICE,
            IncidentCategory.APPLICATION,Impact.MEDIUM,Urgency.MEDIUM,1,false,false,START);
        check(publicReport.getReporter() instanceof Reporter && "CUSTOMER".equals(rider.getRole()),"a customer can report an incident");
        publicReport.classify(priority.calculate(publicReport),ADMIN,START);
        Technician appTech=new Technician("App","app@example.test",Set.of(Skill.APPLICATION),3);
        publicReport.assign(appTech,ADMIN,START);publicReport.acknowledge(appTech,START);publicReport.startInvestigation(appTech,START);
        publicReport.resolve(appTech,"Fixed the UPI intent handler","Null intent",START.plusSeconds(60));
        throwsException(UnauthorizedIncidentOperationException.class,()->publicReport.verify(EMP,START.plusSeconds(70)),"staff cannot verify a customer's incident");
        publicReport.verify(rider,START.plusSeconds(80));
        check(publicReport.getStatus()==IncidentStatus.VERIFIED,"the customer verifies their own incident");
        var blockedPaid=CustomerReportAssessment.assess(new CustomerReportAssessment.Answers(CustomerReportAssessment.Effect.BLOCKED,true,true));
        check(blockedPaid.impact()==Impact.HIGH && blockedPaid.urgency()==Urgency.HIGH,"customer blocked and charged: high impact, high urgency");
        var minorPaid=CustomerReportAssessment.assess(new CustomerReportAssessment.Answers(CustomerReportAssessment.Effect.MINOR,true,false));
        check(minorPaid.impact()==Impact.MEDIUM,"money taken raises a minor problem to medium impact");
        var cosmetic=CustomerReportAssessment.assess(new CustomerReportAssessment.Answers(CustomerReportAssessment.Effect.MINOR,false,false));
        check(cosmetic.impact()==Impact.LOW && cosmetic.urgency()==Urgency.LOW,"cosmetic issue stays low");
        throwsException(NullPointerException.class,()->new CustomerReportAssessment.Answers(null,false,false),"customer must say how they were affected");
        Incident escalate=incident(Impact.LOW,Urgency.LOW,false,false);
        throwsException(InvalidTransitionException.class,()->escalate.changePriority(Priority.P1_CRITICAL,SLAPolicy.forPriority(Priority.P1_CRITICAL),ADMIN,"x",START),"priority cannot change before classification");
        escalate.classify(priority.calculate(escalate),ADMIN,START);
        throwsException(IllegalArgumentException.class,()->escalate.changePriority(Priority.P1_CRITICAL,SLAPolicy.forPriority(Priority.P1_CRITICAL),ADMIN," ",START),"a reason is required to change priority");
        throwsException(IllegalArgumentException.class,()->escalate.changePriority(escalate.getPriority(),SLAPolicy.forPriority(escalate.getPriority()),ADMIN,"same",START),"changing to the same priority is refused");
        escalate.changePriority(Priority.P1_CRITICAL,SLAPolicy.forPriority(Priority.P1_CRITICAL),ADMIN,"Affects all Tatkal bookings",START.plusSeconds(60));
        check(escalate.getPriority()==Priority.P1_CRITICAL && escalate.getSlaPolicy().resolutionTarget().equals(Duration.ofMinutes(30))
            && escalate.getAuditTrail().stream().anyMatch(e->e.action().equals("PRIORITY_CHANGED")),"IT manager raises priority; SLA follows; audited");
        Technician fixer=new Technician("Fixer","fixer@example.test",Set.of(Skill.PAYMENTS),3);
        escalate.assign(fixer,ADMIN,START);escalate.acknowledge(fixer,START);escalate.startInvestigation(fixer,START);
        escalate.resolve(fixer,"Restarted the payment callback service","Stuck worker",START.plusSeconds(120));
        throwsException(InvalidTransitionException.class,()->escalate.changePriority(Priority.P2_HIGH,SLAPolicy.forPriority(Priority.P2_HIGH),ADMIN,"late",START.plusSeconds(130)),"priority cannot change after resolution");
        // ---- technicians sharing work ----
        Technician asha=new Technician("Asha","asha@example.test",Set.of(Skill.PAYMENTS),3);
        Technician ravi=new Technician("Ravi","ravi@example.test",Set.of(Skill.PAYMENTS),3);
        Technician dbTech=new Technician("Meena","meena@example.test",Set.of(Skill.DATABASE),3);
        Technician full=new Technician("Full","full@example.test",Set.of(Skill.PAYMENTS),1);
        full.takeIncident();
        Incident shared=incident(Impact.HIGH,Urgency.MEDIUM,false,false);
        shared.classify(Priority.P2_HIGH,ADMIN,START);shared.assign(asha,ADMIN,START.plusSeconds(10));
        throwsException(UnauthorizedIncidentOperationException.class,()->shared.requestHandover(ravi,dbTech,"Busy",START.plusSeconds(20)),
            "only the assigned technician can hand an incident over");
        throwsException(IllegalArgumentException.class,()->shared.requestHandover(asha,ravi," ",START.plusSeconds(20)),"a hand-over needs a reason");
        throwsException(TechnicianUnavailableException.class,()->shared.requestHandover(asha,full,"On leave tomorrow",START.plusSeconds(20)),
            "a colleague at capacity cannot be asked");
        shared.requestHandover(asha,ravi,"On leave from tomorrow",START.plusSeconds(20));
        check(shared.getPendingHandover()!=null && shared.getAssignedTechnician()==asha,"a hand-over request changes nothing until it is accepted");
        throwsException(InvalidTransitionException.class,()->shared.requestHandover(asha,dbTech,"Second try",START.plusSeconds(21)),
            "only one hand-over can wait at a time");
        throwsException(UnauthorizedIncidentOperationException.class,()->shared.acceptHandover(dbTech,START.plusSeconds(25)),
            "only the colleague who was asked can accept");
        shared.declineHandover(ravi,"Already on two P1s",START.plusSeconds(30));
        check(shared.getPendingHandover()==null && shared.getAssignedTechnician()==asha,"a declined hand-over leaves the incident with the requester");
        shared.requestHandover(asha,ravi,"On leave from tomorrow",START.plusSeconds(40));
        shared.acceptHandover(ravi,START.plusSeconds(50));
        check(shared.getAssignedTechnician()==ravi && shared.getStatus()==IncidentStatus.ASSIGNED && asha.getActiveIncidents()==0 && ravi.getActiveIncidents()==1
            && shared.getContributors().equals(List.of(asha)),"accepting moves the incident and the workload; the new technician must acknowledge");
        shared.acknowledge(ravi,START.plusSeconds(60));
        Instant firstResponse=shared.getAcknowledgedAt();
        throwsException(IllegalArgumentException.class,()->shared.handOff(ravi,dbTech," ",START.plusSeconds(70)),"a hand-off must say what was done");
        shared.startInvestigation(ravi,START.plusSeconds(70));
        shared.handOff(ravi,dbTech,"Payment callback replayed; ledger mismatch remains in the database",START.plusSeconds(80));
        check(shared.getAssignedTechnician()==dbTech && shared.getStatus()==IncidentStatus.ASSIGNED && shared.getContributors().equals(List.of(asha,ravi))
            && dbTech.getActiveIncidents()==1 && ravi.getActiveIncidents()==0,"hand-off passes the rest to another team and records who worked on it");
        shared.acknowledge(dbTech,START.plusSeconds(90));
        check(shared.getAcknowledgedAt().equals(firstResponse),"re-acknowledging after a hand-off keeps the first response time for the SLA");
        Incident early=incident(Impact.HIGH,Urgency.MEDIUM,false,false);
        early.classify(Priority.P2_HIGH,ADMIN,START);early.assign(new Technician("New","new@example.test",Set.of(Skill.PAYMENTS),3),ADMIN,START);
        throwsException(InvalidTransitionException.class,()->early.handOff(early.getAssignedTechnician(),dbTech,"Nothing yet",START.plusSeconds(5)),
            "no hand-off before the technician has acknowledged and started");
        Technician leaving=early.getAssignedTechnician();
        early.handBack(leaving,"Wrong team for this one",START.plusSeconds(6));
        check(early.getStatus()==IncidentStatus.CLASSIFIED && early.getAssignedTechnician()==null && leaving.getActiveIncidents()==0,
            "handing back returns the incident to the IT manager to assign again");
        System.out.println("TOTAL: "+count+" checks passed");
    }
}
