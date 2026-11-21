package com.railway.itsm.service;

import com.irctc.itsm.repository.impl.PostgresAuditLogRepository;
import com.irctc.itsm.repository.impl.PostgresIncidentRepository;
import com.irctc.itsm.repository.impl.PostgresResolutionRepository;
import com.irctc.itsm.repository.impl.PostgresServiceAndSlaRepository;
import com.irctc.itsm.repository.impl.PostgresUserRepository;
import com.railway.itsm.domain.events.EventPublisher;
import com.railway.itsm.domain.strategy.LoadBasedAssignmentStrategy;
import com.railway.itsm.domain.strategy.RailwayPriorityStrategy;
import com.railway.itsm.domain.strategy.SkillBasedAssignmentStrategy;
import com.railway.itsm.service.app.IncidentWorkflowService;
import com.railway.itsm.service.db.IntegrationQueries;
import com.railway.itsm.service.http.ApiServer;
import com.railway.itsm.service.notify.InAppNotificationSender;
import com.railway.itsm.service.notify.NotificationPolicy;
import com.railway.itsm.service.notify.SimulatedEmailSender;
import com.railway.itsm.service.sla.SlaMonitor;
import java.time.Clock;
import java.util.Map;

/**
 * Composition root: chooses the concrete classes and connects them.
 * Domain (strategies, events) + persistence (PostgreSQL repositories) → workflow service → HTTP.
 */
public final class ServiceMain {
    public static final String DEV_TOKEN = "dev-internal-token";

    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(env("ITSM_SERVICE_PORT", "8081"));
        String token = env("ITSM_INTERNAL_TOKEN", DEV_TOKEN);
        long slaSeconds = Long.parseLong(env("ITSM_SLA_CHECK_SECONDS", "30"));
        if (token.equals(DEV_TOKEN)) System.out.println("Using the development internal token. Set ITSM_INTERNAL_TOKEN outside local development.");

        IntegrationQueries queries = new IntegrationQueries();
        EventPublisher events = new EventPublisher();
        IncidentWorkflowService workflow = new IncidentWorkflowService(
                new PostgresIncidentRepository(), new PostgresUserRepository(), new PostgresServiceAndSlaRepository(),
                new PostgresResolutionRepository(), new PostgresAuditLogRepository(), queries, events,
                new RailwayPriorityStrategy(),
                Map.of("skill", new SkillBasedAssignmentStrategy(), "load", new LoadBasedAssignmentStrategy()),
                Clock.systemUTC());

        NotificationPolicy policy = new NotificationPolicy();
        events.subscribe(new InAppNotificationSender(workflow::snapshot, policy, queries));
        events.subscribe(new SimulatedEmailSender(workflow::snapshot, policy, queries));

        workflow.snapshot();   // fail fast if the database is unreachable
        new SlaMonitor(workflow, slaSeconds).start();
        new ApiServer(port, token, workflow).start();
        System.out.println("Incident service on http://127.0.0.1:" + port + " (SLA check every " + slaSeconds + " s)");
    }

    private static String env(String name, String fallback) {
        String v = System.getenv(name);
        return v == null || v.isBlank() ? fallback : v;
    }
}
