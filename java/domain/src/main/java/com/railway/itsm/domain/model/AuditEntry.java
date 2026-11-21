package com.railway.itsm.domain.model;
import com.railway.itsm.domain.enums.IncidentStatus;
import java.time.Instant;
import java.util.UUID;
public record AuditEntry(UUID incidentId, Instant timestamp, UUID actorId, String action,
                         IncidentStatus previousStatus, IncidentStatus newStatus, String details) {}
