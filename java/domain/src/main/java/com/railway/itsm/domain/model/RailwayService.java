package com.railway.itsm.domain.model;
import java.util.UUID;
public final class RailwayService {
    private final UUID id=UUID.randomUUID();
    private final String name;
    private final int businessCriticality;
    public RailwayService(String name,int businessCriticality){
        if(name==null||name.isBlank()||businessCriticality<1||businessCriticality>3)
            throw new IllegalArgumentException("Name required; criticality must be 1..3");
        this.name=name;this.businessCriticality=businessCriticality;
    }
    public UUID getId(){return id;}
    public String getName(){return name;}
    public int getBusinessCriticality(){return businessCriticality;}
}
