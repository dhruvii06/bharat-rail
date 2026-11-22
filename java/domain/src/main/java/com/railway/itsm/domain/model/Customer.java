package com.railway.itsm.domain.model;
/** A member of the public (the brief's "Customer") who registered to report a problem with the online services. */
public final class Customer extends Reporter {
    public Customer(String name,String email){super(name,email);}
    public Customer(java.util.UUID id,String name,String email){super(id,name,email);}
    @Override public String getRole(){return "CUSTOMER";}
}
