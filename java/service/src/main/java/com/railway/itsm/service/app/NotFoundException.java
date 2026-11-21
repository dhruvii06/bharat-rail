package com.railway.itsm.service.app;

/** The resource does not exist, or the caller is not allowed to know it exists. */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) { super(message); }
}
