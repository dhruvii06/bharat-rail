package com.railway.itsm.domain.strategy;
import com.railway.itsm.domain.model.Incident;
import com.railway.itsm.domain.model.Technician;
import java.util.List;
public interface AssignmentStrategy { Technician select(Incident incident,List<Technician> candidates); }
