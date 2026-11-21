package com.railway.itsm.domain.model;
import java.util.Objects;
import java.util.UUID;
public abstract class User {
    private final UUID id;
    private final String name;
    private final String email;
    protected User(String name, String email) {
        this(UUID.randomUUID(), name, email);
    }
    /** Restores a user loaded from storage with its existing identity. */
    protected User(UUID id, String name, String email) {
        if (id == null || name == null || name.isBlank() || email == null || !email.contains("@"))
            throw new IllegalArgumentException("Valid id/name/email required");
        this.id=id; this.name=name; this.email=email;
    }
    public UUID getId(){return id;}
    public String getName(){return name;}
    public String getEmail(){return email;}
    public abstract String getRole();
}
