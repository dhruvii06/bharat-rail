package com.railway.itsm.service.app;

import com.railway.itsm.domain.enums.Priority;
import com.railway.itsm.domain.model.Incident;

/**
 * Explains, in words, the priority that RailwayPriorityStrategy produced, so users can see why an
 * incident is P1. Mirrors the strategy's rules: overrides first, then impact × urgency × criticality.
 */
public final class PriorityExplainer {
    private PriorityExplainer() {}

    public static String explain(Incident incident, Priority result) {
        int impact = incident.getImpact().score();
        int urgency = incident.getUrgency().score();
        int criticality = incident.getAffectedService().getBusinessCriticality();
        String score = "Impact " + impact + " × urgency " + urgency + " × service criticality " + criticality + " = " + (impact * urgency * criticality);
        if (incident.isCriticalSecurityIncident()) return score + "; security incident override → " + label(result);
        if (incident.isPeakTatkalIncident() && impact == 3 && urgency == 3) return score + "; Tatkal window with high impact and urgency → " + label(result);
        return score + " → " + label(result) + " (P1 ≥ 20, P2 ≥ 10, P3 ≥ 5)";
    }

    private static String label(Priority p) { return p.name().replace('_', ' '); }
}
