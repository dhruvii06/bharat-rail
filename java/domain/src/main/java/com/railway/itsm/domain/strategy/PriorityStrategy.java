package com.railway.itsm.domain.strategy;
import com.railway.itsm.domain.enums.Priority;
import com.railway.itsm.domain.model.Incident;
public interface PriorityStrategy { Priority calculate(Incident incident); }
