package com.railway.itsm.domain.model;
import java.time.Instant;
public record Resolution(String summary, String rootCause, Instant resolvedAt) {
    public Resolution {
        if(summary==null || summary.isBlank() || rootCause==null || rootCause.isBlank() || resolvedAt==null)
            throw new IllegalArgumentException("Resolution summary, root cause and time required");
    }
}
