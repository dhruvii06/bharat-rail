package com.railway.itsm.domain.model;
import java.util.Objects;
import java.util.UUID;
public abstract class User {
    private final UUID id;
    private final String name;
    private final String email;
    protected User(String name, String email) {
        if (name == null || name.isBlank() || email == null || !email.contains("@"))
            throw new IllegalArgumentException("Valid name/email required");
        this.id=UUID.randomUUID(); this.name=name; this.email=email;
    }
    public UUID getId(){return id;}
    public String getName(){return name;}
    public String getEmail(){return email;}
    public abstract String getRole();
}
