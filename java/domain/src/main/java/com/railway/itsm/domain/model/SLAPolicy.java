package com.railway.itsm.domain.model;
import com.railway.itsm.domain.enums.Priority;
import java.time.Duration;
public record SLAPolicy(Priority priority, Duration responseTarget, Duration resolutionTarget) {
    public SLAPolicy {
        if(priority==null || responseTarget==null || resolutionTarget==null || responseTarget.isZero()
            || responseTarget.isNegative() || resolutionTarget.isZero() || resolutionTarget.isNegative())
            throw new IllegalArgumentException("Invalid SLA configuration");
    }
    public static SLAPolicy forPriority(Priority priority){
        return switch(priority){
            case P1_CRITICAL -> new SLAPolicy(priority,Duration.ofMinutes(5),Duration.ofMinutes(30));
            case P2_HIGH -> new SLAPolicy(priority,Duration.ofMinutes(15),Duration.ofHours(2));
            case P3_MEDIUM -> new SLAPolicy(priority,Duration.ofHours(1),Duration.ofHours(8));
            case P4_LOW -> new SLAPolicy(priority,Duration.ofHours(4),Duration.ofHours(24));
        };
    }
}
