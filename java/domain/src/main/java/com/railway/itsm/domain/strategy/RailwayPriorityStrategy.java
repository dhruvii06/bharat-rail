package com.railway.itsm.domain.strategy;
import com.railway.itsm.domain.enums.Priority;
import com.railway.itsm.domain.model.Incident;
public final class RailwayPriorityStrategy implements PriorityStrategy {
    @Override public Priority calculate(Incident incident){
        int score=incident.getImpact().score()*incident.getUrgency().score()*
                incident.getAffectedService().getBusinessCriticality();
        if(incident.isCriticalSecurityIncident() || (incident.isPeakTatkalIncident() &&
           incident.getImpact().score()==3 && incident.getUrgency().score()==3) || score>=20)
            return Priority.P1_CRITICAL;
        if(score>=10) return Priority.P2_HIGH;
        if(score>=5) return Priority.P3_MEDIUM;
        return Priority.P4_LOW;
    }
}
