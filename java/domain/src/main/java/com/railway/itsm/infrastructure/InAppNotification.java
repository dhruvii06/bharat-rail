package com.railway.itsm.infrastructure;
import com.railway.itsm.domain.events.*;
public final class InAppNotification implements NotificationSender {
    @Override public void onEvent(IncidentEvent event){
        System.out.println("[IN-APP] "+event.type()+": "+event.message());
    }
}
