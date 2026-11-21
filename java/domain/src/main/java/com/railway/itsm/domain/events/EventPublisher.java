package com.railway.itsm.domain.events;
import java.util.*;
public final class EventPublisher {
    private final List<IncidentListener> listeners=new ArrayList<>();
    public void subscribe(IncidentListener listener){listeners.add(Objects.requireNonNull(listener));}
    public void publish(IncidentEvent event){for(IncidentListener listener:listeners) listener.onEvent(event);}
}
