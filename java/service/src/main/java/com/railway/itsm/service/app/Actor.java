package com.railway.itsm.service.app;

/** The signed-in user making a request, as vouched for by the Node API (database user id and role). */
public record Actor(long userId, String role) {
    public static final String EMPLOYEE = "EMPLOYEE";
    public static final String TECHNICIAN = "TECHNICIAN";
    public static final String ADMIN = "ADMIN";

    public Actor {
        if (!EMPLOYEE.equals(role) && !TECHNICIAN.equals(role) && !ADMIN.equals(role))
            throw new SecurityException("Unknown role " + role);
    }

    public boolean isEmployee() { return EMPLOYEE.equals(role); }
    public boolean isTechnician() { return TECHNICIAN.equals(role); }
    public boolean isAdmin() { return ADMIN.equals(role); }

    public void require(String expected, String action) {
        if (!expected.equals(role)) throw new SecurityException("Only " + expected.toLowerCase() + " accounts can " + action + ".");
    }
}
