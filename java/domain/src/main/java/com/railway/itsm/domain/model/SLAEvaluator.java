package com.railway.itsm.domain.model;
import java.time.Duration;
import java.time.Instant;
public final class SLAEvaluator {
    private SLAEvaluator(){}
    public static SLAResult evaluate(Incident incident, Instant now){
        if(incident.getPriority()==null) throw new IllegalStateException("Incident not classified");
        SLAPolicy policy=incident.getSlaPolicy();
        Instant responseDeadline=incident.getCreatedAt().plus(policy.responseTarget());
        Instant resolutionDeadline=incident.getCreatedAt().plus(policy.resolutionTarget());
        Instant response=incident.getAcknowledgedAt();
        Instant resolution=incident.getResolvedAt();
        boolean responseViolated=(response==null?now:response).isAfter(responseDeadline);
        boolean resolutionViolated=(resolution==null?now:resolution).isAfter(resolutionDeadline);
        boolean atRisk=resolution==null && !resolutionViolated &&
            !now.isBefore(resolutionDeadline.minus(Duration.ofMinutes(5)));
        return new SLAResult(responseDeadline,resolutionDeadline,responseViolated,resolutionViolated,atRisk);
    }
}
