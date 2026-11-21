package com.railway.itsm.domain.exceptions;

/** No SLA policy is configured for the requested incident priority. */
public final class SLAPolicyNotFoundException extends DomainException {
    public SLAPolicyNotFoundException(String message) { super(message); }
}
