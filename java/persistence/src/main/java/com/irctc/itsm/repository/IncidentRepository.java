package com.irctc.itsm.repository;

import com.irctc.itsm.model.Incident;
import com.irctc.itsm.model.IncidentStatus;
import com.irctc.itsm.model.Priority;
import java.util.List;
import java.util.Optional;

public interface IncidentRepository {
    Incident save(Incident incident);
    Optional<Incident> findById(String incidentId);
    List<Incident> findAll();
    List<Incident> findByStatus(IncidentStatus status);
    List<Incident> findByPriority(Priority priority);
    List<Incident> findByTechnicianId(Long technicianId);
    List<Incident> findSlaViolatedIncidents();
    boolean updateStatus(String incidentId, IncidentStatus newStatus, Long modifiedByUserId);
    boolean assignTechnician(String incidentId, Long technicianId, Long modifiedByUserId);
}