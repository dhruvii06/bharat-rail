package com.railway.itsm.domain.model;
import java.util.UUID;
/**
 * A user who can report incidents and confirm their resolution: staff (Employee) or a member of the
 * public (Customer). Technicians and administrators work on incidents but do not report them.
 */
public abstract class Reporter extends User {
    protected Reporter(String name,String email){super(name,email);}
    protected Reporter(UUID id,String name,String email){super(id,name,email);}
}
