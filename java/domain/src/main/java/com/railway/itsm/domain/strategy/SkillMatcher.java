package com.railway.itsm.domain.strategy;
import com.railway.itsm.domain.enums.*;
import com.railway.itsm.domain.model.*;
final class SkillMatcher {
    private SkillMatcher(){}
    /** The team that handles a category; set per category, so new categories route without code changes. */
    static Skill required(IncidentCategory category){
        return category.handledBy();
    }
    static boolean eligible(Technician t,Incident incident){
        return t.isAvailable() && t.getSkills().contains(required(incident.getCategory()));
    }
}
