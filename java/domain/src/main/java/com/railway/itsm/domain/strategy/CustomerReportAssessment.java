package com.railway.itsm.domain.strategy;

import com.railway.itsm.domain.enums.Impact;
import com.railway.itsm.domain.enums.Urgency;
import java.util.Objects;

/**
 * Customers describe what happened in plain terms; they do not rate impact or urgency themselves.
 * This explainable rule turns their answers into the impact and urgency that the PriorityStrategy
 * then combines with the service's business criticality.
 *
 * Impact: could not complete what they were doing → HIGH; it worked with problems → MEDIUM;
 * minor or cosmetic → LOW. Money taken without the service raises impact to at least MEDIUM.
 * Urgency: money taken without the service → HIGH; still happening → MEDIUM; otherwise LOW.
 */
public final class CustomerReportAssessment {

    /** How the problem affected the customer. */
    public enum Effect { BLOCKED, DEGRADED, MINOR }

    public record Answers(Effect effect, boolean moneyTaken, boolean stillHappening) {
        public Answers { Objects.requireNonNull(effect, "Say how the problem affected you"); }
    }

    public record Result(Impact impact, Urgency urgency, String explanation) {}

    private CustomerReportAssessment() {}

    public static Result assess(Answers a) {
        Impact impact = switch (a.effect()) {
            case BLOCKED -> Impact.HIGH;
            case DEGRADED -> Impact.MEDIUM;
            case MINOR -> Impact.LOW;
        };
        if (a.moneyTaken() && impact == Impact.LOW) impact = Impact.MEDIUM;
        Urgency urgency = a.moneyTaken() ? Urgency.HIGH : a.stillHappening() ? Urgency.MEDIUM : Urgency.LOW;
        String effectText = switch (a.effect()) {
            case BLOCKED -> "could not complete the task";
            case DEGRADED -> "worked with problems";
            case MINOR -> "minor problem";
        };
        String explanation = "Customer report: " + effectText
                + (a.moneyTaken() ? ", money taken without the service" : "")
                + (a.stillHappening() ? ", still happening" : "")
                + " → impact " + impact + ", urgency " + urgency;
        return new Result(impact, urgency, explanation);
    }
}
