package com.railway.itsm.domain.exceptions;

/** The technician has reached their configured concurrent incident limit. */
public final class TechnicianWorkloadExceededException extends DomainException {
    public TechnicianWorkloadExceededException(String message) { super(message); }
}
