package com.railway.itsm.domain.exceptions;

/** The specified technician cannot take a new incident while unavailable. */
public final class TechnicianUnavailableException extends DomainException {
    public TechnicianUnavailableException(String message) { super(message); }
}
