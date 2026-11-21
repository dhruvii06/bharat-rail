package com.railway.itsm.domain.model;
public final class Administrator extends User {
    public Administrator(String name,String email){super(name,email);}
    public Administrator(java.util.UUID id,String name,String email){super(id,name,email);}
    @Override public String getRole(){return "ADMINISTRATOR";}
}
