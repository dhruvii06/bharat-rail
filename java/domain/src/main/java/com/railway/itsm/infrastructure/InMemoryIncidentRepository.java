package com.railway.itsm.infrastructure;
import com.railway.itsm.domain.model.Incident;
import com.railway.itsm.domain.repository.IncidentRepository;
import java.util.*;
public final class InMemoryIncidentRepository implements IncidentRepository {
    private final Map<UUID,Incident> incidents=new LinkedHashMap<>();
    public void save(Incident incident){incidents.put(incident.getId(),incident);}
    public Optional<Incident> findById(UUID id){return Optional.ofNullable(incidents.get(id));}
    public List<Incident> findAll(){return List.copyOf(incidents.values());}
}
