package com.railway.itsm.domain.strategy;
import com.railway.itsm.domain.exceptions.NoTechnicianAvailableException;
import com.railway.itsm.domain.model.*;
import java.util.*;
public final class LoadBasedAssignmentStrategy implements AssignmentStrategy {
    @Override public Technician select(Incident incident,List<Technician> candidates){
        // Eligible technicians only; least active workload wins.
        return candidates.stream().filter(t->SkillMatcher.eligible(t,incident))
          .min(Comparator.comparingInt(Technician::getActiveIncidents).thenComparing(Technician::getName))
          .orElseThrow(()->new NoTechnicianAvailableException("No eligible technician under capacity"));
    }
}
