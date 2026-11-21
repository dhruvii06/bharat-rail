package com.railway.itsm.service.app;

/** The signed-in user making a request, as vouched for by the Node API (database user id and role). */
public record Actor(long userId, String role) {
    public static final String EMPLOYEE = "EMPLOYEE";
    public static final String TECHNICIAN = "TECHNICIAN";
    public static final String ADMIN = "ADMIN";
    public static final String PASSENGER = "PASSENGER";

    public Actor {
        if (!EMPLOYEE.equals(role) && !TECHNICIAN.equals(role) && !ADMIN.equals(role) && !PASSENGER.equals(role))
            throw new SecurityException("Unknown role " + role);
    }

    public boolean isEmployee() { return EMPLOYEE.equals(role); }
    /** Employees and passengers report incidents, follow their own, answer questions and verify fixes. */
    public boolean isReporter() { return EMPLOYEE.equals(role) || PASSENGER.equals(role); }

    public void requireReporter(String action) {
        if (!isReporter()) throw new SecurityException("Only employees and passengers can " + action + ".");
    }
    public boolean isTechnician() { return TECHNICIAN.equals(role); }
    public boolean isAdmin() { return ADMIN.equals(role); }

    public void require(String expected, String action) {
        if (!expected.equals(role)) throw new SecurityException("Only " + expected.toLowerCase() + " accounts can " + action + ".");
    }
}
