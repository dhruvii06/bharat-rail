package com.railway.itsm.service.app;

import com.irctc.itsm.model.ITService;
import com.irctc.itsm.model.Role;
import com.irctc.itsm.model.TechnicianDetail;
import com.irctc.itsm.repository.IncidentRepository;
import com.irctc.itsm.repository.ServiceAndSlaRepository;
import com.irctc.itsm.repository.UserRepository;
import com.railway.itsm.domain.enums.IncidentCategory;
import com.railway.itsm.domain.enums.IncidentStatus;
import com.railway.itsm.domain.enums.Priority;
import com.railway.itsm.domain.model.SLAPolicy;
import java.time.Duration;
import com.railway.itsm.domain.model.Administrator;
import com.railway.itsm.domain.model.Employee;
import com.railway.itsm.domain.model.Customer;
import com.railway.itsm.domain.model.Reporter;
import com.railway.itsm.domain.model.Incident;
import com.railway.itsm.domain.model.RailwayService;
import com.railway.itsm.domain.model.Technician;
import com.railway.itsm.service.db.IntegrationQueries;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * A consistent read of the stored data for one request, plus factories that rebuild domain objects
 * (Employee, Technician, Incident…) from the persistence DTOs. This is the adapter between the
 * JDBC model and the domain model.
 */
public final class Snapshot {
    /** Maximum concurrent incidents per technician; the domain rejects assignments beyond it. */
    public static final int TECHNICIAN_CAPACITY = 5;

    private final Map<Long, com.irctc.itsm.model.User> users = new LinkedHashMap<>();
    private final Map<Long, TechnicianDetail> technicianDetails = new LinkedHashMap<>();
    private final Map<Long, ITService> services = new LinkedHashMap<>();
    private final List<com.irctc.itsm.model.Incident> incidents;
    private final Map<String, IntegrationQueries.Extras> extras;
    private final Map<String, Instant> resolvedAt;
    private final Set<Long> inactive;
    private final Map<String, IncidentCategory> categories = new LinkedHashMap<>();
    private final Set<Long> tatkalServices;

    Snapshot(UserRepository userRepo, ServiceAndSlaRepository serviceRepo, IncidentRepository incidentRepo, IntegrationQueries queries) {
        for (Role role : Role.values()) for (com.irctc.itsm.model.User u : userRepo.findByRole(role)) users.put(u.getUserId(), u);
        for (com.irctc.itsm.model.User u : users.values())
            if (u.getRole() == Role.TECHNICIAN) userRepo.findTechnicianDetail(u.getUserId()).ifPresent(t -> technicianDetails.put(u.getUserId(), t));
        for (ITService s : serviceRepo.findAllServices()) services.put(s.getServiceId(), s);
        this.incidents = incidentRepo.findAll();
        this.extras = queries.extras();
        this.resolvedAt = queries.resolvedAt();
        this.inactive = queries.inactiveUserIds();
        for (IntegrationQueries.CategoryRow c : queries.categories()) categories.put(c.code(), Mapping.category(c.code(), c.label(), c.skill()));
        this.tatkalServices = queries.tatkalServiceIds();
    }

    /** A category by code, including ones the IT manager added or switched off. */
    public IncidentCategory category(String code) {
        IncidentCategory c = categories.get(code == null ? "" : code.trim().toUpperCase(java.util.Locale.ROOT));
        if (c == null) throw new IllegalArgumentException("Unknown incident category: " + code);
        return c;
    }

    public boolean onTatkalPath(long serviceId) { return tatkalServices.contains(serviceId); }

    public boolean isActive(long userId) { return !inactive.contains(userId); }

    public String infoRequest(String incidentId) { return Optional.ofNullable(extras.get(incidentId)).map(IntegrationQueries.Extras::infoRequest).orElse(null); }

    public Instant infoRequestedAt(String incidentId) { return Optional.ofNullable(extras.get(incidentId)).map(IntegrationQueries.Extras::infoRequestedAt).orElse(null); }

    public List<com.irctc.itsm.model.Incident> incidents() { return incidents; }

    public Optional<com.irctc.itsm.model.Incident> incident(String id) {
        return incidents.stream().filter(i -> i.getIncidentId().equals(id)).findFirst();
    }

    public Optional<com.irctc.itsm.model.User> user(Long id) { return Optional.ofNullable(id == null ? null : users.get(id)); }

    public String userName(Long id) { return user(id).map(com.irctc.itsm.model.User::getFullName).orElse(null); }

    public List<Long> managerIds() {
        return users.values().stream().filter(u -> u.getRole() == Role.ADMIN).map(com.irctc.itsm.model.User::getUserId).toList();
    }

    public Map<Long, ITService> services() { return services; }

    public Map<Long, TechnicianDetail> technicianDetails() { return technicianDetails; }

    public int affectedUsers(String incidentId) { return Optional.ofNullable(extras.get(incidentId)).map(IntegrationQueries.Extras::affectedUsers).orElse(0); }

    public Instant acknowledgedAt(String incidentId) { return Optional.ofNullable(extras.get(incidentId)).map(IntegrationQueries.Extras::acknowledgedAt).orElse(null); }

    public Instant resolvedAt(String incidentId) { return resolvedAt.get(incidentId); }

    // ---- domain object factories ----

    /** The reporting user as the right domain type: a Customer for public accounts, otherwise an Employee. */
    public Reporter reporter(long id) {
        com.irctc.itsm.model.User u = require(id);
        return u.getRole() == Role.CUSTOMER ? new Customer(Ids.user(id), u.getFullName(), u.getEmail())
                : new Employee(Ids.user(id), u.getFullName(), u.getEmail());
    }

    public Administrator administrator(long id) {
        com.irctc.itsm.model.User u = require(id);
        return new Administrator(Ids.user(id), u.getFullName(), u.getEmail());
    }

    /** A technician with workload from the database; {@code minimumActive} keeps the count consistent for an assignee. */
    public Technician technician(long id, int minimumActive) {
        com.irctc.itsm.model.User u = require(id);
        TechnicianDetail d = technicianDetails.get(id);
        if (d == null) throw new IllegalStateException("User " + id + " has no technician profile");
        int active = Math.max(d.getCurrentWorkload(), minimumActive);
        return new Technician(Ids.user(id), u.getFullName(), u.getEmail(), Set.of(Mapping.skill(d.getSkillCategory())),
                Math.max(TECHNICIAN_CAPACITY, active), active, d.isAvailable() && isActive(id));
    }

    public List<Technician> technicians() {
        List<Technician> list = new ArrayList<>();
        for (Long id : technicianDetails.keySet()) list.add(technician(id, 0));
        return list;
    }

    public RailwayService service(long id) {
        ITService s = services.get(id);
        if (s == null) throw new IllegalArgumentException("Unknown service " + id);
        return new RailwayService(Ids.service(id), s.getServiceName(), Mapping.criticality(s.getBusinessCriticality()), onTatkalPath(id));
    }

    /** Rebuilds the domain aggregate in its stored state so the lifecycle rules can check the next action. */
    public Incident restore(com.irctc.itsm.model.Incident dto) {
        IncidentStatus status = IncidentStatus.valueOf(dto.getStatus().name());
        boolean active = status == IncidentStatus.ASSIGNED || status == IncidentStatus.ACKNOWLEDGED || status == IncidentStatus.IN_PROGRESS;
        Technician assignee = dto.getAssignedTechnicianId() == null ? null : technician(dto.getAssignedTechnicianId(), active ? 1 : 0);
        IncidentCategory category = category(dto.getCategory());
        Priority priority = dto.getPriority() == null ? null : Mapping.priority(dto.getPriority());
        return Incident.restore(Ids.incident(dto.getIncidentId()), dto.getTitle(), dto.getDescription(),
                reporter(dto.getReporterId()), service(dto.getServiceId()), category,
                Mapping.impact(dto.getImpact()), Mapping.urgency(dto.getUrgency()), affectedUsers(dto.getIncidentId()),
                category.isSecurity(), dto.isTatkalWindow(), Mapping.instant(dto.getCreatedAt()),
                status, priority, assignee, acknowledgedAt(dto.getIncidentId()), resolvedAt(dto.getIncidentId()), null,
                storedSlaPolicy(dto, priority), infoRequest(dto.getIncidentId()), infoRequestedAt(dto.getIncidentId()));
    }

    /** The SLA targets this incident was created with, taken from its stored deadlines (null if unknown). */
    private static SLAPolicy storedSlaPolicy(com.irctc.itsm.model.Incident dto, Priority priority) {
        if (priority == null || dto.getCreatedAt() == null || dto.getSlaResponseDeadline() == null || dto.getSlaResolutionDeadline() == null) return null;
        Duration response = Duration.between(dto.getCreatedAt(), dto.getSlaResponseDeadline());
        Duration resolution = Duration.between(dto.getCreatedAt(), dto.getSlaResolutionDeadline());
        return response.isNegative() || response.isZero() || resolution.isNegative() || resolution.isZero() ? null
                : new SLAPolicy(priority, response, resolution);
    }

    private com.irctc.itsm.model.User require(long id) {
        com.irctc.itsm.model.User u = users.get(id);
        if (u == null) throw new IllegalStateException("Unknown user " + id);
        return u;
    }
}
