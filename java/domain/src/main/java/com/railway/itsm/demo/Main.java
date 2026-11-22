package com.railway.itsm.demo;
import com.railway.itsm.application.IncidentManagementService;
import com.railway.itsm.domain.enums.*;
import com.railway.itsm.domain.events.EventPublisher;
import com.railway.itsm.domain.model.*;
import com.railway.itsm.domain.strategy.*;
import com.railway.itsm.infrastructure.*;
import java.time.*;
import java.util.*;
public final class Main {
    public static void main(String[] args){
        EventPublisher events=new EventPublisher();
        events.subscribe(new EmailNotification());
        events.subscribe(new InAppNotification());
        IncidentManagementService manager=new IncidentManagementService(
            new InMemoryIncidentRepository(),new RailwayPriorityStrategy(),
            new LoadBasedAssignmentStrategy(),events);
        Employee employee=new Employee("Ticket Support","support@example.test");
        Administrator admin=new Administrator("IT Manager","manager@example.test");
        Technician a=new Technician("Asha","asha@example.test",Set.of(Skill.PAYMENTS),3);
        Technician b=new Technician("Dev","dev@example.test",Set.of(Skill.PAYMENTS),3);
        RailwayService tatkal=new RailwayService("Tatkal Payment Gateway",3,true);
        Instant start=Instant.parse("2026-11-12T04:00:00Z");
        Incident incident=new Incident("UPI payment failing during Tatkal",
          "UPI debited but booking does not finish",employee,tatkal,IncidentCategory.PAYMENT,
          Impact.HIGH,Urgency.HIGH,5000,false,true,start);
        manager.report(incident);
        manager.classifyAndAssign(incident,admin,List.of(a,b),start.plusSeconds(30));
        Technician assigned=incident.getAssignedTechnician();
        incident.acknowledge(assigned,start.plusSeconds(90));
        incident.startInvestigation(assigned,start.plusSeconds(120));
        incident.resolve(assigned,"Recovered payment callback processing","Gateway timeout",start.plusSeconds(600));
        incident.verify(employee,start.plusSeconds(660));
        incident.close(admin,start.plusSeconds(700));
        System.out.println("ID="+incident.getId());
        System.out.println("Priority="+incident.getPriority()+", finalStatus="+incident.getStatus());
        System.out.println("SLA="+SLAEvaluator.evaluate(incident,start.plusSeconds(700)));
        System.out.println("Audit entries="+incident.getAuditTrail().size());
    }
}
