package com.railway.itsm.service.notify;

import com.railway.itsm.domain.events.IncidentEvent;
import com.railway.itsm.domain.events.NotificationSender;
import com.railway.itsm.service.app.Ids;
import com.railway.itsm.service.app.Snapshot;
import com.railway.itsm.service.db.IntegrationQueries;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * Observer that turns domain events into stored notifications (Template Method: subclasses choose
 * the channel and how delivery looks). A failing listener never undoes the action that raised the
 * event; it logs the problem instead.
 */
public abstract class StoredNotificationSender implements NotificationSender {
    private final Supplier<Snapshot> snapshots;
    private final NotificationPolicy policy;
    protected final IntegrationQueries queries;

    protected StoredNotificationSender(Supplier<Snapshot> snapshots, NotificationPolicy policy, IntegrationQueries queries) {
        this.snapshots = snapshots; this.policy = policy; this.queries = queries;
    }

    protected abstract NotificationPolicy.Channel channel();

    /** Delivers one message; the default stores it for the recipient. */
    protected void deliver(long userId, String email, String incidentId, IncidentEvent event) {
        queries.addNotification(userId, incidentId, channel().name(), event.type(), event.message());
    }

    @Override public final void onEvent(IncidentEvent event) {
        try {
            Optional<String> incidentId = Ids.incidentKey(event.incidentId());
            if (incidentId.isEmpty()) return;
            Snapshot s = snapshots.get();
            s.incident(incidentId.get()).ifPresent(dto -> {
                for (long userId : policy.recipients(event.type(), channel(), dto.getReporterId(), dto.getAssignedTechnicianId(), s.managerIds(),
                        s.handoverTarget(incidentId.get()), s.previousAssignee(incidentId.get()))) {
                    String email = s.user(userId).map(com.irctc.itsm.model.User::getEmail).orElse(null);
                    deliver(userId, email, incidentId.get(), event);
                }
            });
        } catch (RuntimeException e) {
            System.err.println("[" + channel() + "] could not deliver " + event.type() + ": " + e.getMessage());
        }
    }
}
