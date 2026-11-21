package com.irctc.itsm.repository;

import com.irctc.itsm.model.ITService;
import com.irctc.itsm.model.Priority;
import com.irctc.itsm.model.SLAPolicy;
import java.util.List;
import java.util.Optional;

public interface ServiceAndSlaRepository {
    ITService saveService(ITService service);
    Optional<ITService> findServiceById(Long serviceId);
    List<ITService> findAllServices();
    SLAPolicy saveOrUpdateSlaPolicy(SLAPolicy policy);
    Optional<SLAPolicy> findSlaByPriority(Priority priority);
    List<SLAPolicy> findAllSlaPolicies();
}