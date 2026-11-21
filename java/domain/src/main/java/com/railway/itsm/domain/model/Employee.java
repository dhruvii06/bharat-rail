package com.railway.itsm.domain.model;
public final class Employee extends User {
    public Employee(String name, String email){super(name,email);}
    @Override public String getRole(){return "EMPLOYEE";}
}
