package com.railway.itsm.domain.model;
public final class Employee extends User {
    public Employee(String name, String email){super(name,email);}
    public Employee(java.util.UUID id, String name, String email){super(id,name,email);}
    @Override public String getRole(){return "EMPLOYEE";}
}
