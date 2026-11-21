package com.railway.itsm.domain.model;
import java.time.Instant;
public record SLAResult(Instant responseDeadline, Instant resolutionDeadline,
                        boolean responseViolated, boolean resolutionViolated, boolean resolutionAtRisk) {}
