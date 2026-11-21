package com.irctc.itsm;

import com.irctc.itsm.model.*;
import com.irctc.itsm.repository.*;
import com.irctc.itsm.repository.impl.*;

public class DatabaseSmokeTest {
    public static void main(String[] args) {
        UserRepository userRepo = new PostgresUserRepository();
        ServiceAndSlaRepository metaRepo = new PostgresServiceAndSlaRepository();
        IncidentRepository incidentRepo = new PostgresIncidentRepository();
        ResolutionRepository resRepo = new PostgresResolutionRepository();

        System.out.println("Users loaded: " + userRepo.findByRole(Role.TECHNICIAN).size());
        System.out.println("Payment Techs available: " + userRepo.findAvailableTechniciansBySkill("PAYMENT").size());
        System.out.println("IT Services loaded: " + metaRepo.findAllServices().size());
        System.out.println("P1 SLA Resolution Target (mins): " + metaRepo.findSlaByPriority(Priority.P1).get().getResolutionTargetMins());
        System.out.println("Total Incidents: " + incidentRepo.findAll().size());

        resRepo.resolveIncident(new Resolution("INC-1002", 3L, "Redis PNR cache stale", "Flushed cache and restarted PNR API pod"));
        resRepo.submitFeedback("INC-1002", 5);
        System.out.println("Resolution & Feedback verified: " + resRepo.findByIncidentId("INC-1002").get().getUserFeedback() + "/5");
    }
}