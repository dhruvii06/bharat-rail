package com.irctc.itsm.repository;

import com.irctc.itsm.model.Resolution;
import java.util.Optional;

public interface ResolutionRepository {
    Resolution resolveIncident(Resolution resolution);
    Optional<Resolution> findByIncidentId(String incidentId);
    boolean submitFeedback(String incidentId, int rating);
}