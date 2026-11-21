package com.irctc.itsm.repository;

import com.irctc.itsm.model.AuditLog;
import java.util.List;

public interface AuditLogRepository {
    AuditLog save(AuditLog log);
    List<AuditLog> findByIncidentId(String incidentId);
}