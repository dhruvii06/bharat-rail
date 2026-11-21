package com.railway.itsm.service.app;

import com.railway.itsm.domain.model.Incident;
import com.railway.itsm.domain.repository.IncidentRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Adapter pattern: presents the PostgreSQL data through the domain's own {@link IncidentRepository}
 * interface, so domain services written against that interface (such as duplicate detection in
 * IncidentManagementService) work unchanged on stored incidents. Read-only: writes go through
 * IncidentWorkflowService, which uses the transactional JDBC repositories.
 */
final class SnapshotIncidentRepository implements IncidentRepository {
    private final List<Incident> incidents;

    SnapshotIncidentRepository(Snapshot snapshot) {
        this.incidents = snapshot.incidents().stream().map(snapshot::restore).toList();
    }

    @Override public void save(Incident incident) {
        throw new UnsupportedOperationException("Read-only view; save incidents through IncidentWorkflowService");
    }

    @Override public Optional<Incident> findById(UUID id) {
        return incidents.stream().filter(i -> i.getId().equals(id)).findFirst();
    }

    @Override public List<Incident> findAll() { return incidents; }
}
