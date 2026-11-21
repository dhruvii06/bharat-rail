package com.railway.itsm.domain.strategy;
import com.railway.itsm.domain.enums.*;
import com.railway.itsm.domain.model.*;
final class SkillMatcher {
    private SkillMatcher(){}
    static Skill required(IncidentCategory category){
        return switch(category){
            case APPLICATION -> Skill.APPLICATION;
            case PAYMENT -> Skill.PAYMENTS;
            case DATABASE -> Skill.DATABASE;
            case NETWORK -> Skill.NETWORK;
            case SECURITY -> Skill.SECURITY;
            case AUTHENTICATION -> Skill.AUTHENTICATION;
            case API_INTEGRATION -> Skill.API;
            case INFRASTRUCTURE -> Skill.INFRASTRUCTURE;
        };
    }
    static boolean eligible(Technician t,Incident incident){
        return t.isAvailable() && t.getSkills().contains(required(incident.getCategory()));
    }
}
