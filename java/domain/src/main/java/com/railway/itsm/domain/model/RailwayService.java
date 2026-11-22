package com.railway.itsm.domain.model;
import java.util.UUID;
public final class RailwayService {
    private final UUID id;
    private final String name;
    private final int businessCriticality;
    private final boolean tatkalBookingPath;
    public RailwayService(String name,int businessCriticality){
        this(UUID.randomUUID(),name,businessCriticality,false);
    }
    public RailwayService(String name,int businessCriticality,boolean tatkalBookingPath){
        this(UUID.randomUUID(),name,businessCriticality,tatkalBookingPath);
    }
    /** Restores a service loaded from storage with its existing identity. */
    public RailwayService(UUID id,String name,int businessCriticality){
        this(id,name,businessCriticality,false);
    }
    /** Restores a service loaded from storage with its existing identity. */
    public RailwayService(UUID id,String name,int businessCriticality,boolean tatkalBookingPath){
        if(id==null||name==null||name.isBlank()||businessCriticality<1||businessCriticality>3)
            throw new IllegalArgumentException("Name required; criticality must be 1..3");
        this.id=id;this.name=name;this.businessCriticality=businessCriticality;this.tatkalBookingPath=tatkalBookingPath;
    }
    public UUID getId(){return id;}
    public String getName(){return name;}
    public int getBusinessCriticality(){return businessCriticality;}
    /** True for services a Tatkal booking depends on (booking engine, payment, core database). */
    public boolean isOnTatkalBookingPath(){return tatkalBookingPath;}
}
