package com.railway.itsm.domain.enums;
public enum Impact { LOW(1), MEDIUM(2), HIGH(3); private final int score; Impact(int score){this.score=score;} public int score(){return score;} }
