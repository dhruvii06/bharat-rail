package com.railway.itsm.service.app;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Stable domain identities for database rows. The domain model identifies objects by UUID while the
 * database uses numbers and "INC-1001" strings; a name-based UUID gives every row the same UUID on
 * every request, so restored objects compare equal (for example "is this the assigned technician?").
 */
public final class Ids {
    private static final Map<UUID, String> INCIDENT_KEYS = new ConcurrentHashMap<>();

    private Ids() {}

    public static UUID user(long userId) { return uuid("user:" + userId); }

    public static UUID service(long serviceId) { return uuid("service:" + serviceId); }

    public static UUID incident(String incidentId) {
        UUID id = uuid("incident:" + incidentId);
        INCIDENT_KEYS.putIfAbsent(id, incidentId);
        return id;
    }

    /** The database incident id for a domain UUID seen earlier in this process. */
    public static Optional<String> incidentKey(UUID id) { return Optional.ofNullable(INCIDENT_KEYS.get(id)); }

    private static UUID uuid(String key) { return UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)); }
}
