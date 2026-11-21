package com.railway.itsm.service.app;

import com.irctc.itsm.model.SeverityLevel;
import com.railway.itsm.domain.enums.Impact;
import com.railway.itsm.domain.enums.IncidentCategory;
import com.railway.itsm.domain.enums.Priority;
import com.railway.itsm.domain.enums.Skill;
import com.railway.itsm.domain.enums.Urgency;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Locale;

/**
 * Converts between the persistence model (JDBC DTOs, database enums) and the domain model.
 * Keeping every conversion here means neither model has to know about the other.
 */
public final class Mapping {
    private Mapping() {}

    public static Priority priority(com.irctc.itsm.model.Priority db) {
        return switch (db) {
            case P1 -> Priority.P1_CRITICAL;
            case P2 -> Priority.P2_HIGH;
            case P3 -> Priority.P3_MEDIUM;
            case P4 -> Priority.P4_LOW;
        };
    }

    public static com.irctc.itsm.model.Priority priority(Priority domain) {
        return switch (domain) {
            case P1_CRITICAL -> com.irctc.itsm.model.Priority.P1;
            case P2_HIGH -> com.irctc.itsm.model.Priority.P2;
            case P3_MEDIUM -> com.irctc.itsm.model.Priority.P3;
            case P4_LOW -> com.irctc.itsm.model.Priority.P4;
        };
    }

    /** Database severity (4 levels) to the 1..3 scale used by the priority formula. CRITICAL counts as 3. */
    public static int score(SeverityLevel level) {
        if (level == null) return 1;
        return switch (level) {
            case LOW -> 1;
            case MEDIUM -> 2;
            case HIGH, CRITICAL -> 3;
        };
    }

    public static SeverityLevel level(int score) {
        return switch (score) {
            case 1 -> SeverityLevel.LOW;
            case 2 -> SeverityLevel.MEDIUM;
            case 3 -> SeverityLevel.HIGH;
            default -> throw new IllegalArgumentException("Impact and urgency must be 1, 2 or 3");
        };
    }

    public static Impact impact(SeverityLevel level) { return Impact.values()[score(level) - 1]; }

    public static Urgency urgency(SeverityLevel level) { return Urgency.values()[score(level) - 1]; }

    /** Service business criticality on the domain's 1..3 scale: CRITICAL 3, HIGH 2, MEDIUM and LOW 1. */
    public static int criticality(SeverityLevel level) {
        if (level == null) return 1;
        return switch (level) {
            case CRITICAL -> 3;
            case HIGH -> 2;
            case MEDIUM, LOW -> 1;
        };
    }

    public static IncidentCategory category(String text) {
        try {
            return IncidentCategory.valueOf(text.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("Unknown incident category: " + text);
        }
    }

    /** Technician skill text from the database; PAYMENT and API are stored without the domain suffix. */
    public static Skill skill(String text) {
        String key = text == null ? "" : text.trim().toUpperCase(Locale.ROOT);
        return switch (key) {
            case "PAYMENT" -> Skill.PAYMENTS;
            case "API_INTEGRATION" -> Skill.API;
            default -> Skill.valueOf(key);
        };
    }

    public static Instant instant(LocalDateTime local) {
        return local == null ? null : local.atZone(ZoneId.systemDefault()).toInstant();
    }

    public static LocalDateTime local(Instant instant) {
        return instant == null ? null : LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
    }
}
