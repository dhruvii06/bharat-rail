package com.railway.itsm.domain.strategy;
import com.railway.itsm.domain.exceptions.NoTechnicianAvailableException;
import com.railway.itsm.domain.model.*;
import java.util.*;
public final class SkillBasedAssignmentStrategy implements AssignmentStrategy {
    @Override public Technician select(Incident incident,List<Technician> candidates){
        // All eligible technicians match the required skill; stable name ordering breaks ties.
        return candidates.stream().filter(t->SkillMatcher.eligible(t,incident))
          .min(Comparator.comparing(Technician::getName).thenComparing(t->t.getId().toString()))
          .orElseThrow(()->new NoTechnicianAvailableException("No skilled available technician"));
    }
}
