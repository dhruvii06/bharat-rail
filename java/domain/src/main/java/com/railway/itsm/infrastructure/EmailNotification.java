package com.railway.itsm.infrastructure;
import com.railway.itsm.domain.events.*;
public final class EmailNotification implements NotificationSender {
    @Override public void onEvent(IncidentEvent event){
        System.out.println("[SIMULATED EMAIL] "+event.type()+": "+event.message());
    }
}
