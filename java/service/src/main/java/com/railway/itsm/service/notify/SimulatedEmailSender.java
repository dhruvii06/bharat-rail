package com.railway.itsm.service.notify;

import com.railway.itsm.domain.events.IncidentEvent;
import com.railway.itsm.service.app.Snapshot;
import com.railway.itsm.service.db.IntegrationQueries;
import java.util.function.Supplier;

/**
 * Channel 2: email, simulated. Messages go to an outbox table (visible to managers in the app) and
 * the console instead of a mail server. A real SMTP adapter would replace only {@link #deliver}.
 */
public final class SimulatedEmailSender extends StoredNotificationSender {
    public SimulatedEmailSender(Supplier<Snapshot> snapshots, NotificationPolicy policy, IntegrationQueries queries) {
        super(snapshots, policy, queries);
    }

    @Override protected NotificationPolicy.Channel channel() { return NotificationPolicy.Channel.EMAIL; }

    @Override protected void deliver(long userId, String email, String incidentId, IncidentEvent event) {
        super.deliver(userId, email, incidentId, event);
        System.out.println("[SIMULATED EMAIL] to " + email + " | " + event.type() + " | " + event.message());
    }
}
