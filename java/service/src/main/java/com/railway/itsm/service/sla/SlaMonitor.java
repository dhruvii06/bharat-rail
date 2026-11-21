package com.railway.itsm.service.sla;

import com.railway.itsm.service.app.IncidentWorkflowService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/** Background SLA monitoring: checks every open incident on a fixed interval. */
public final class SlaMonitor {
    private final IncidentWorkflowService workflow;
    private final long intervalSeconds;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "sla-monitor");
        t.setDaemon(true);
        return t;
    });

    public SlaMonitor(IncidentWorkflowService workflow, long intervalSeconds) {
        this.workflow = workflow;
        this.intervalSeconds = intervalSeconds;
    }

    public void start() {
        scheduler.scheduleWithFixedDelay(() -> {
            try {
                int fired = workflow.checkSla();
                if (fired > 0) System.out.println("[SLA] " + fired + " SLA event(s) raised");
            } catch (RuntimeException e) {
                System.err.println("[SLA] check failed: " + e.getMessage());
            }
        }, 5, intervalSeconds, TimeUnit.SECONDS);
    }
}
