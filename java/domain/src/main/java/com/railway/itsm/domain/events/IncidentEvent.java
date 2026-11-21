package com.railway.itsm.domain.events;
import java.time.Instant;
import java.util.UUID;
public record IncidentEvent(UUID incidentId,String type,String message,Instant timestamp) {}
