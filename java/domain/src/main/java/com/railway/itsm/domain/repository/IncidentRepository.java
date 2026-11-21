package com.railway.itsm.domain.repository;
import com.railway.itsm.domain.model.Incident;
import java.util.*;
public interface IncidentRepository {
    void save(Incident incident);
    Optional<Incident> findById(UUID id);
    List<Incident> findAll();
}
