package com.railway.itsm.service.notify;

import com.railway.itsm.service.app.Snapshot;
import com.railway.itsm.service.db.IntegrationQueries;
import java.util.function.Supplier;

/** Channel 1: notifications shown in the web app's notification list. */
public final class InAppNotificationSender extends StoredNotificationSender {
    public InAppNotificationSender(Supplier<Snapshot> snapshots, NotificationPolicy policy, IntegrationQueries queries) {
        super(snapshots, policy, queries);
    }

    @Override protected NotificationPolicy.Channel channel() { return NotificationPolicy.Channel.IN_APP; }
}
