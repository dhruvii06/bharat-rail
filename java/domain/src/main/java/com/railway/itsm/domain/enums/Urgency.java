package com.railway.itsm.domain.enums;
public enum Urgency { LOW(1), MEDIUM(2), HIGH(3); private final int score; Urgency(int score){this.score=score;} public int score(){return score;} }
