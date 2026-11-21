package com.railway.itsm.domain.exceptions;

/** A user attempted an incident action that their role or assignment does not permit. */
public final class UnauthorizedIncidentOperationException extends DomainException {
    public UnauthorizedIncidentOperationException(String message) { super(message); }
}
