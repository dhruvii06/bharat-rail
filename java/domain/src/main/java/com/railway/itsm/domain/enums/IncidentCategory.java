package com.railway.itsm.domain.enums;

import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * An incident category. The eight standard ones are constants; the IT manager can add more at run
 * time, each handled by one of the technician teams ({@link Skill}). A category handled by the
 * security team is treated as a security incident by the priority rules.
 * Categories are values: two with the same code are equal.
 */
public final class IncidentCategory {
    private static final Pattern CODE = Pattern.compile("[A-Z][A-Z0-9_]{1,29}");

    public static final IncidentCategory APPLICATION = new IncidentCategory("APPLICATION", "Application", Skill.APPLICATION);
    public static final IncidentCategory PAYMENT = new IncidentCategory("PAYMENT", "Payment", Skill.PAYMENTS);
    public static final IncidentCategory DATABASE = new IncidentCategory("DATABASE", "Database", Skill.DATABASE);
    public static final IncidentCategory NETWORK = new IncidentCategory("NETWORK", "Network", Skill.NETWORK);
    public static final IncidentCategory SECURITY = new IncidentCategory("SECURITY", "Security", Skill.SECURITY);
    public static final IncidentCategory AUTHENTICATION = new IncidentCategory("AUTHENTICATION", "Authentication", Skill.AUTHENTICATION);
    public static final IncidentCategory API_INTEGRATION = new IncidentCategory("API_INTEGRATION", "API integration", Skill.API);
    public static final IncidentCategory INFRASTRUCTURE = new IncidentCategory("INFRASTRUCTURE", "Infrastructure", Skill.INFRASTRUCTURE);

    private static final List<IncidentCategory> STANDARD = List.of(APPLICATION, PAYMENT, DATABASE, NETWORK, SECURITY,
            AUTHENTICATION, API_INTEGRATION, INFRASTRUCTURE);

    private final String code;
    private final String label;
    private final Skill handledBy;

    private IncidentCategory(String code, String label, Skill handledBy) {
        if (code == null || !CODE.matcher(code).matches())
            throw new IllegalArgumentException("Category code must be 2-30 capital letters, digits or underscores.");
        if (label == null || label.isBlank()) throw new IllegalArgumentException("Category name is required.");
        this.code = code;
        this.label = label.trim();
        this.handledBy = Objects.requireNonNull(handledBy, "handledBy");
    }

    /** A category defined by the IT manager (or loaded from storage). */
    public static IncidentCategory of(String code, String label, Skill handledBy) {
        return new IncidentCategory(code, label, handledBy);
    }

    /** The eight categories every installation starts with. */
    public static List<IncidentCategory> standard() { return STANDARD; }

    /** Turns a name such as "Mobile app" into a code such as MOBILE_APP. */
    public static String codeFor(String label) {
        String code = Objects.requireNonNullElse(label, "").trim().toUpperCase(java.util.Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "_").replaceAll("^_+|_+$", "");
        if (!code.isEmpty() && !Character.isLetter(code.charAt(0))) code = "C_" + code;
        return code.length() > 30 ? code.substring(0, 30) : code;
    }

    public String code() { return code; }
    /** Same as {@link #code()}; kept so callers written for the old enum still read naturally. */
    public String name() { return code; }
    public String label() { return label; }
    public Skill handledBy() { return handledBy; }
    public boolean isSecurity() { return handledBy == Skill.SECURITY; }

    @Override public boolean equals(Object o) { return o instanceof IncidentCategory c && c.code.equals(code); }
    @Override public int hashCode() { return code.hashCode(); }
    @Override public String toString() { return code; }
}
