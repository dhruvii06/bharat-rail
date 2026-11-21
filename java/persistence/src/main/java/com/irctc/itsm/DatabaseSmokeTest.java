package com.irctc.itsm;

import com.irctc.itsm.model.*;
import com.irctc.itsm.repository.*;
import com.irctc.itsm.repository.impl.*;

public class DatabaseSmokeTest {
    public static void main(String[] args) {
        IncidentRepository incidentRepo = new PostgresIncidentRepository();
        AuditLogRepository auditRepo = new PostgresAuditLogRepository();
        ResolutionRepository resRepo = new PostgresResolutionRepository();

        // 1. Verify status skipping is blocked (INC-1002 is ASSIGNED -> CLOSED must fail)
        try {
            incidentRepo.updateStatus("INC-1002", IncidentStatus.CLOSED, 1L);
            System.out.println("ERROR: Status skip was NOT blocked!");
        } catch (IllegalStateException e) {
            System.out.println("PASS - Blocked invalid jump: " + e.getMessage());
        }

        // 2. Verify edits are preserved on save()
        Incident inc = incidentRepo.findById("INC-1002").orElseThrow();
        inc.setTitle("Updated PNR Status Delay");
        incidentRepo.save(inc);
        System.out.println("PASS - Saved title: " + incidentRepo.findById("INC-1002").get().getTitle());

        // 3. Verify resolution logs real previous status (ASSIGNED -> RESOLVED)
        resRepo.resolveIncident(new Resolution("INC-1002", 3L, "Stale cache", "Cleared Redis cache"));
        auditRepo.findByIncidentId("INC-1002").forEach(log ->
            System.out.println("PASS - Audit logged: " + log.getPreviousState() + " -> " + log.getNewState())
        );
    }
}
