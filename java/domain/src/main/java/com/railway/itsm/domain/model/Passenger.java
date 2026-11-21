package com.railway.itsm.domain.model;
/** A member of the public who registered to report a problem with the railway's online services. */
public final class Passenger extends Reporter {
    public Passenger(String name,String email){super(name,email);}
    public Passenger(java.util.UUID id,String name,String email){super(id,name,email);}
    @Override public String getRole(){return "PASSENGER";}
}
