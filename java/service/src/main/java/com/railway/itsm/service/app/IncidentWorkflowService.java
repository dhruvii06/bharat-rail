package com.railway.itsm.service.app;

import com.irctc.itsm.model.AuditLog;
import com.irctc.itsm.model.ITService;
import com.irctc.itsm.model.Resolution;
import com.irctc.itsm.model.TechnicianDetail;
import com.irctc.itsm.repository.AuditLogRepository;
import com.irctc.itsm.repository.IncidentRepository;
import com.irctc.itsm.repository.ResolutionRepository;
import com.irctc.itsm.repository.ServiceAndSlaRepository;
import com.irctc.itsm.repository.UserRepository;
import com.railway.itsm.application.IncidentManagementService;
import com.railway.itsm.domain.enums.Impact;
import com.railway.itsm.domain.enums.IncidentCategory;
import com.railway.itsm.domain.enums.IncidentStatus;
import com.railway.itsm.domain.enums.Priority;
import com.railway.itsm.domain.enums.Urgency;
import com.railway.itsm.domain.events.EventPublisher;
import com.railway.itsm.domain.events.IncidentEvent;
import com.railway.itsm.domain.model.Administrator;
import com.railway.itsm.domain.model.Reporter;
import com.railway.itsm.domain.model.Incident;
import com.railway.itsm.domain.model.RailwayService;
import com.railway.itsm.domain.model.SLAEvaluator;
import com.railway.itsm.domain.model.SLAPolicy;
import com.railway.itsm.domain.exceptions.SLAPolicyNotFoundException;
import com.railway.itsm.domain.model.SLAResult;
import com.railway.itsm.domain.model.Technician;
import com.railway.itsm.domain.strategy.AssignmentStrategy;
import com.railway.itsm.domain.strategy.CustomerReportAssessment;
import com.railway.itsm.domain.strategy.PriorityStrategy;
import com.railway.itsm.service.app.Views.*;
import com.railway.itsm.service.db.IntegrationQueries;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Application service that connects the parts: every command rebuilds the domain aggregate from the
 * database, lets the domain decide whether the action is allowed (lifecycle, actor, capacity rules),
 * saves the result through the transactional JDBC repositories, and publishes an event that the
 * notification observers deliver. Commands are synchronized so two requests cannot both pass the
 * domain check for the same incident.
 */
public class IncidentWorkflowService {
    private static final Set<String> FINISHED = Set.of("RESOLVED", "VERIFIED", "CLOSED");

    /** Staff fill in category, impact and urgency; customers answer effect / moneyTaken / stillHappening instead. */
    public record NewIncident(String title, String description, Long serviceId, String category,
                              Integer impact, Integer urgency, Integer affectedUsers, Boolean tatkalWindow,
                              String effect, Boolean moneyTaken, Boolean stillHappening) {}

    private final IncidentRepository incidents;
    private final UserRepository users;
    private final ServiceAndSlaRepository catalogue;
    private final ResolutionRepository resolutions;
    private final AuditLogRepository audit;
    private final IntegrationQueries queries;
    private final EventPublisher events;
    private final PriorityStrategy priorityStrategy;
    private final Map<String, AssignmentStrategy> assignmentStrategies;
    private final Clock clock;

    public IncidentWorkflowService(IncidentRepository incidents, UserRepository users, ServiceAndSlaRepository catalogue,
                                   ResolutionRepository resolutions, AuditLogRepository audit, IntegrationQueries queries,
                                   EventPublisher events, PriorityStrategy priorityStrategy,
                                   Map<String, AssignmentStrategy> assignmentStrategies, Clock clock) {
        this.incidents = incidents; this.users = users; this.catalogue = catalogue; this.resolutions = resolutions;
        this.audit = audit; this.queries = queries; this.events = events; this.priorityStrategy = priorityStrategy;
        this.assignmentStrategies = Map.copyOf(assignmentStrategies); this.clock = clock;
    }

    public Snapshot snapshot() { return new Snapshot(users, catalogue, incidents, queries); }

    // =====================================================================================
    // Queries
    // =====================================================================================

    public List<IncidentView> list(Actor actor, Map<String, String> filters) {
        Snapshot s = snapshot();
        Instant now = clock.instant();
        String q = filters.getOrDefault("q", "").trim().toLowerCase(Locale.ROOT);
        LocalDate from = date(filters.get("from")), to = date(filters.get("to"));
        List<IncidentView> result = new ArrayList<>();
        for (com.irctc.itsm.model.Incident dto : s.incidents()) {
            if (!canSee(actor, dto)) continue;
            IncidentView v = view(s, dto, actor, now, false);
            if (!q.isEmpty() && !(v.id() + " " + v.title() + " " + v.description()).toLowerCase(Locale.ROOT).contains(q)) continue;
            boolean triage = !actor.isCustomer();
            if (!matches(filters.get("status"), v.status()) || (triage && !matches(filters.get("priority"), v.priority()))
                    || !matches(filters.get("category"), v.category()) || (triage && !matches(filters.get("sla"), v.sla()))
                    || !matches(filters.get("serviceId"), String.valueOf(v.serviceId()))
                    || !matches(filters.get("technicianId"), v.assigneeId() == null ? "" : String.valueOf(v.assigneeId()))) continue;
            LocalDate created = v.createdAt().atZone(ZoneId.systemDefault()).toLocalDate();
            if ((from != null && created.isBefore(from)) || (to != null && created.isAfter(to))) continue;
            result.add(v);
        }
        return result;
    }

    public IncidentView detail(Actor actor, String id) {
        Snapshot s = snapshot();
        return view(s, visible(s, actor, id), actor, clock.instant(), true);
    }

    public List<SimilarView> similar(Actor actor, String id) {
        if (actor.isReporter()) throw new SecurityException("Only technicians and managers can view similar incidents.");
        Snapshot s = snapshot();
        return similarTo(s, s.restore(visible(s, actor, id)));
    }

    public List<ServiceView> services() {
        return catalogue.findAllServices().stream().map(this::serviceView).toList();
    }

    /** Categories reporters can choose: the ones the IT manager has not switched off. */
    public List<CategoryView> categories() {
        return queries.categories().stream().filter(IntegrationQueries.CategoryRow::active)
                .map(c -> new CategoryView(c.code(), c.label(), true)).toList();
    }

    public List<String> assignmentStrategies() { return assignmentStrategies.keySet().stream().sorted().toList(); }

    public List<TechnicianView> technicians(Actor actor) {
        actor.require(Actor.ADMIN, "view technicians");
        return technicianViews(snapshot());
    }

    public NotificationList notifications(Actor actor) {
        List<NotificationView> items = queries.notifications(actor.userId(), 30).stream()
                .map(n -> new NotificationView(n.id(), n.incidentId(), n.type(), n.message(), n.createdAt(), n.read())).toList();
        return new NotificationList(items, items.stream().filter(n -> !n.read()).count());
    }

    public void markRead(Actor actor, long notificationId) {
        if (!queries.markRead(notificationId, actor.userId())) throw new NotFoundException("Notification not found or already read.");
    }

    public void markAllRead(Actor actor) { queries.markAllRead(actor.userId()); }

    public List<IntegrationQueries.OutboxRow> emailOutbox(Actor actor) {
        actor.require(Actor.ADMIN, "view the email outbox");
        return queries.emailOutbox(50);
    }

    public Overview overview(Actor actor) {
        actor.require(Actor.ADMIN, "view reports");
        Snapshot s = snapshot();
        Instant now = clock.instant();
        List<IncidentView> all = s.incidents().stream().map(d -> view(s, d, actor, now, false)).toList();
        long open = all.stream().filter(v -> !FINISHED.contains(v.status())).count();
        long critical = all.stream().filter(v -> "P1".equals(v.priority()) && !FINISHED.contains(v.status())).count();
        List<IncidentView> finished = all.stream().filter(v -> FINISHED.contains(v.status())).toList();
        long violations = all.stream().filter(v -> "BREACHED".equals(v.sla())).count();
        Integer compliance = finished.isEmpty() ? null
                : (int) Math.round(100.0 * finished.stream().filter(v -> !"BREACHED".equals(v.sla())).count() / finished.size());
        Double avgMinutes = finished.stream().filter(v -> v.resolvedAt() != null)
                .mapToLong(v -> Duration.between(v.createdAt(), v.resolvedAt()).toMinutes()).average().stream().boxed().findFirst().orElse(null);
        return new Overview(all.size(), open, critical, all.size() - open, violations, compliance, avgMinutes,
                counts(all, IncidentView::serviceName), counts(all, IncidentView::priority), counts(all, IncidentView::status),
                technicianViews(s));
    }

    // =====================================================================================
    // Commands
    // =====================================================================================

    public synchronized CreatedIncident report(Actor actor, NewIncident in) {
        actor.requireReporter("report incidents");
        String title = text(in.title(), "title", 5, 120);
        String description = text(in.description(), "description", 10, 4000);
        if (in.serviceId() == null) throw new IllegalArgumentException("Choose the affected service.");
        Snapshot s = snapshot();
        Instant now = clock.instant();
        Reporter reporter = s.reporter(actor.userId());
        RailwayService service = s.service(in.serviceId());

        IncidentCategory category;
        int impact, urgency, affected;
        boolean tatkal;
        String customerAssessment = null;
        if (actor.isCustomer()) {
            // Customers only describe what happened. Their answers decide impact and urgency, the
            // category comes from the service, and any ratings they send are ignored.
            CustomerReportAssessment.Result r = CustomerReportAssessment.assess(new CustomerReportAssessment.Answers(
                    effect(in.effect()), Boolean.TRUE.equals(in.moneyTaken()), Boolean.TRUE.equals(in.stillHappening())));
            impact = r.impact().score(); urgency = r.urgency().score(); affected = 1;
            category = Mapping.category(s.services().get(in.serviceId()).getCategory());
            tatkal = TatkalWindow.contains(now);
            customerAssessment = r.explanation();
        } else {
            category = Mapping.category(Objects.requireNonNullElse(in.category(), ""));
            if (queries.categories().stream().noneMatch(c -> c.code().equals(category.name()) && c.active()))
                throw new IllegalArgumentException("The category " + category.name() + " is not available. Choose another category.");
            impact = range(in.impact(), "impact", 1, 3); urgency = range(in.urgency(), "urgency", 1, 3);
            affected = in.affectedUsers() == null ? 0 : range(in.affectedUsers(), "affected passengers", 0, 100_000_000);
            tatkal = Boolean.TRUE.equals(in.tatkalWindow()) || TatkalWindow.contains(now);
        }

        // Domain: build the incident, let the priority strategy classify it, look for duplicates.
        Incident incident = new Incident(title, description, reporter, service, category, Impact.values()[impact - 1],
                Urgency.values()[urgency - 1], affected, category == IncidentCategory.SECURITY, tatkal, now);
        Priority priority = priorityStrategy.calculate(incident);
        com.irctc.itsm.model.Priority dbPriority = Mapping.priority(priority);
        com.irctc.itsm.model.SLAPolicy configured = catalogue.findSlaByPriority(dbPriority)
                .orElseThrow(() -> new SLAPolicyNotFoundException("No SLA policy is configured for " + dbPriority));
        incident.classify(priority, new SLAPolicy(priority, Duration.ofMinutes(configured.getResponseTargetMins()),
                Duration.ofMinutes(configured.getResolutionTargetMins())), reporter, now);
        List<SimilarView> duplicates = similarTo(s, incident);

        // Persistence: store the classified incident and its audit trail.
        String id = queries.nextIncidentId();
        Long slaId = configured.getSlaId();
        com.irctc.itsm.model.Incident dto = new com.irctc.itsm.model.Incident();
        dto.setIncidentId(id); dto.setReporterId(actor.userId()); dto.setServiceId(in.serviceId()); dto.setCategory(category.name());
        dto.setTitle(title); dto.setDescription(description); dto.setImpact(Mapping.level(impact)); dto.setUrgency(Mapping.level(urgency));
        dto.setPriority(dbPriority); dto.setTatkalWindow(tatkal); dto.setStatus(com.irctc.itsm.model.IncidentStatus.CLASSIFIED);
        dto.setSlaId(slaId); dto.setCreatedAt(Mapping.local(now));
        dto.setSlaResponseDeadline(Mapping.local(now.plus(incident.getSlaPolicy().responseTarget())));
        dto.setSlaResolutionDeadline(Mapping.local(now.plus(incident.getSlaPolicy().resolutionTarget())));
        incidents.save(dto);
        queries.setAffectedUsers(id, affected);
        audit.save(new AuditLog(id, actor.userId(), "INCIDENT_CREATED", null, "NEW", "Reported by " + reporter.getName()));
        if (customerAssessment != null)
            audit.save(new AuditLog(id, null, "CUSTOMER_ASSESSMENT", "NEW", "NEW", customerAssessment));
        audit.save(new AuditLog(id, null, "PRIORITY_ASSIGNED", "NEW", "CLASSIFIED", PriorityExplainer.explain(incident, priority)));
        if (!duplicates.isEmpty())
            audit.save(new AuditLog(id, null, "POSSIBLE_DUPLICATE", "CLASSIFIED", "CLASSIFIED",
                    "Similar open incidents: " + duplicates.stream().map(SimilarView::id).collect(Collectors.joining(", "))));

        publish(id, "CREATED", "New " + dbPriority + " incident " + id + " on " + service.getName() + ": " + title);
        publish(id, "RECEIVED", "We received your report " + id + ": " + title + ". Our IT team will look into it.");
        return new CreatedIncident(detail(actor, id), actor.isCustomer() ? List.of() : duplicates);
    }

    public synchronized IncidentView assign(Actor actor, String id, String strategyName, Long technicianId) {
        actor.require(Actor.ADMIN, "assign incidents");
        Snapshot s = snapshot();
        com.irctc.itsm.model.Incident dto = visible(s, actor, id);
        Incident incident = s.restore(dto);
        Administrator manager = s.administrator(actor.userId());
        Technician technician;
        String how;
        if (technicianId != null) {
            if (!s.technicianDetails().containsKey(technicianId)) throw new IllegalArgumentException("Unknown technician " + technicianId + ".");
            technician = s.technician(technicianId, 0);
            how = "chosen by the manager";
        } else {
            String key = strategyName == null || strategyName.isBlank() ? defaultStrategy() : strategyName.trim().toLowerCase(Locale.ROOT);
            AssignmentStrategy strategy = assignmentStrategies.get(key);
            if (strategy == null) throw new IllegalArgumentException("Unknown assignment strategy '" + strategyName + "'. Use one of " + assignmentStrategies() + ".");
            technician = strategy.select(incident, s.technicians());   // throws NoTechnicianAvailableException
            how = "selected by the " + key + "-based strategy";
        }
        incident.assign(technician, manager, clock.instant());           // domain checks state, availability and capacity
        long technicianUserId = userIdOf(s, technician);
        incidents.assignTechnician(id, technicianUserId, actor.userId());
        audit.save(new AuditLog(id, actor.userId(), "ASSIGNMENT_REASON", "ASSIGNED", "ASSIGNED", technician.getName() + " " + how));
        publish(id, "ASSIGNED", id + " assigned to " + technician.getName() + ": " + dto.getTitle());
        return detail(actor, id);
    }

    public synchronized IncidentView transition(Actor actor, String id, String action, String summary, String rootCause) {
        Snapshot s = snapshot();
        com.irctc.itsm.model.Incident dto = visible(s, actor, id);
        Incident incident = s.restore(dto);
        Instant now = clock.instant();
        String act = action == null ? "" : action.trim().toUpperCase(Locale.ROOT);
        switch (act) {
            case "ACKNOWLEDGE" -> {
                actor.require(Actor.TECHNICIAN, "acknowledge incidents");
                incident.acknowledge(s.technician(actor.userId(), 0), now);
                incidents.updateStatus(id, com.irctc.itsm.model.IncidentStatus.ACKNOWLEDGED, actor.userId());
                queries.setAcknowledgedAt(id, now);
                publish(id, "ACKNOWLEDGED", id + " acknowledged by " + s.userName(actor.userId()));
            }
            case "START" -> {
                actor.require(Actor.TECHNICIAN, "start investigations");
                incident.startInvestigation(s.technician(actor.userId(), 0), now);
                incidents.updateStatus(id, com.irctc.itsm.model.IncidentStatus.IN_PROGRESS, actor.userId());
                publish(id, "IN_PROGRESS", "Investigation started on " + id);
            }
            case "RESOLVE" -> {
                actor.require(Actor.TECHNICIAN, "resolve incidents");
                String fix = text(summary, "resolution summary", 10, 4000);
                String cause = text(rootCause, "root cause", 3, 2000);
                incident.resolve(s.technician(actor.userId(), 0), fix, cause, now);
                resolutions.resolveIncident(new Resolution(id, actor.userId(), cause, fix));
                publish(id, "RESOLVED", id + " resolved: " + fix);
            }
            case "VERIFY" -> {
                actor.requireReporter("verify resolutions");
                incident.verify(s.reporter(actor.userId()), now);
                incidents.updateStatus(id, com.irctc.itsm.model.IncidentStatus.VERIFIED, actor.userId());
                publish(id, "VERIFIED", "Reporter confirmed the fix for " + id);
            }
            case "CLOSE" -> {
                actor.require(Actor.ADMIN, "close incidents");
                incident.close(s.administrator(actor.userId()), now);
                incidents.updateStatus(id, com.irctc.itsm.model.IncidentStatus.CLOSED, actor.userId());
                publish(id, "CLOSED", id + " closed");
            }
            default -> throw new IllegalArgumentException("Unknown action '" + action + "'. Use ACKNOWLEDGE, START, RESOLVE, VERIFY or CLOSE.");
        }
        return detail(actor, id);
    }

    /** Technician step: ask the reporter for more information (the domain checks who and when). */
    public synchronized IncidentView requestInformation(Actor actor, String id, String question) {
        actor.require(Actor.TECHNICIAN, "request information");
        Snapshot s = snapshot();
        com.irctc.itsm.model.Incident dto = visible(s, actor, id);
        Incident incident = s.restore(dto);
        String text = text(question, "question", 5, 1000);
        Instant now = clock.instant();
        incident.requestInformation(s.technician(actor.userId(), 0), text, now);
        queries.setInfoRequest(id, text, now);
        audit.save(new AuditLog(id, actor.userId(), "INFO_REQUESTED", dto.getStatus().name(), dto.getStatus().name(), text));
        publish(id, "INFO_REQUESTED", s.userName(actor.userId()) + " needs more information on " + id + ": " + text);
        return detail(actor, id);
    }

    /** Employee step: the reporter answers the technician's question. */
    public synchronized IncidentView provideInformation(Actor actor, String id, String answer) {
        actor.requireReporter("answer information requests");
        Snapshot s = snapshot();
        com.irctc.itsm.model.Incident dto = visible(s, actor, id);
        Incident incident = s.restore(dto);
        String text = text(answer, "answer", 2, 2000);
        incident.provideInformation(s.reporter(actor.userId()), text, clock.instant());
        queries.clearInfoRequest(id);
        audit.save(new AuditLog(id, actor.userId(), "INFO_PROVIDED", dto.getStatus().name(), dto.getStatus().name(), text));
        publish(id, "INFO_PROVIDED", "The reporter answered the question on " + id + ": " + text);
        return detail(actor, id);
    }

    /**
     * Conversation between the reporter and the IT team (the assigned technician, or the IT manager
     * while nobody is assigned). Unlike internal notes, messages are visible to the reporter.
     */
    public synchronized IncidentView sendMessage(Actor actor, String id, String message) {
        Snapshot s = snapshot();
        com.irctc.itsm.model.Incident dto = visible(s, actor, id);
        if (dto.getStatus() == com.irctc.itsm.model.IncidentStatus.CLOSED) throw new IllegalStateException("This incident is closed. Report a new problem if you still need help.");
        if (!canMessage(actor, dto)) throw new SecurityException("Only the reporter and the IT staff handling this incident can send messages.");
        String body = text(message, "message", 1, 2000);
        audit.save(new AuditLog(id, actor.userId(), "MESSAGE", dto.getStatus().name(), dto.getStatus().name(), body));
        String sender = s.userName(actor.userId());
        if (Objects.equals(dto.getReporterId(), actor.userId()))
            publish(id, dto.getAssignedTechnicianId() == null ? "MESSAGE_UNASSIGNED" : "MESSAGE_FROM_REPORTER", sender + " wrote on " + id + ": " + body);
        else
            publish(id, "MESSAGE_TO_REPORTER", sender + " from the IT team wrote on " + id + ": " + body);
        return detail(actor, id);
    }

    private static boolean canMessage(Actor actor, com.irctc.itsm.model.Incident dto) {
        return actor.isAdmin()
                || (actor.isReporter() && Objects.equals(dto.getReporterId(), actor.userId()))
                || (actor.isTechnician() && Objects.equals(dto.getAssignedTechnicianId(), actor.userId()));
    }

    public synchronized IncidentView addNote(Actor actor, String id, String note) {
        if (actor.isCustomer()) throw new SecurityException("Use Messages to talk to the IT team.");
        Snapshot s = snapshot();
        com.irctc.itsm.model.Incident dto = visible(s, actor, id);
        if (dto.getStatus() == com.irctc.itsm.model.IncidentStatus.CLOSED) throw new IllegalStateException("Closed incidents cannot take new notes.");
        String body = text(note, "note", 2, 2000);
        audit.save(new AuditLog(id, actor.userId(), "NOTE", dto.getStatus().name(), dto.getStatus().name(), body));
        return detail(actor, id);
    }

    public synchronized IncidentView feedback(Actor actor, String id, Integer rating) {
        actor.requireReporter("rate resolutions");
        Snapshot s = snapshot();
        com.irctc.itsm.model.Incident dto = visible(s, actor, id);
        if (!FINISHED.contains(dto.getStatus().name())) throw new IllegalStateException("Feedback is possible once the incident is resolved.");
        int stars = range(rating, "rating", 1, 5);
        Resolution resolution = resolutions.findByIncidentId(id).orElseThrow(() -> new IllegalStateException("This incident has no resolution to rate."));
        if (resolution.getUserFeedback() != null) throw new IllegalStateException("Feedback was already given for this incident.");
        resolutions.submitFeedback(id, stars);
        audit.save(new AuditLog(id, actor.userId(), "FEEDBACK", dto.getStatus().name(), dto.getStatus().name(), "Reporter rated the resolution " + stars + "/5"));
        return detail(actor, id);
    }

    /**
     * SLA monitoring (run every few seconds by SlaMonitor): records violations, warns before the
     * resolution deadline, and escalates P1/P2 incidents nobody acknowledged in time. Each event fires once.
     */
    public synchronized int checkSla() {
        Snapshot s = snapshot();
        Instant now = clock.instant();
        int fired = 0;
        for (com.irctc.itsm.model.Incident dto : s.incidents()) {
            String status = dto.getStatus().name();
            if (FINISHED.contains(status) || dto.getPriority() == null) continue;
            String id = dto.getIncidentId();
            SLAResult r = SLAEvaluator.evaluate(s.restore(dto), now);
            Set<String> done = audit.findByIncidentId(id).stream().map(AuditLog::getAction).collect(Collectors.toSet());
            if ((r.responseViolated() || r.resolutionViolated()) && !dto.isSlaViolated()) {
                String which = r.responseViolated() ? "response" : "resolution";
                queries.setSlaViolated(id);
                audit.save(new AuditLog(id, null, "SLA_VIOLATED", status, status, "Missed the " + which + " target"));
                publish(id, "SLA_VIOLATED", id + " missed its " + which + " target (" + dto.getPriority() + ")");
                fired++;
            }
            boolean urgent = dto.getPriority() == com.irctc.itsm.model.Priority.P1 || dto.getPriority() == com.irctc.itsm.model.Priority.P2;
            boolean unacknowledged = status.equals("CLASSIFIED") || status.equals("ASSIGNED");
            if (urgent && unacknowledged && r.responseViolated() && !done.contains("ESCALATED")) {
                audit.save(new AuditLog(id, null, "ESCALATED", status, status, "Not acknowledged within the response target; escalated to the IT manager"));
                publish(id, "ESCALATED", dto.getPriority() + " incident " + id + " was not acknowledged in time and has been escalated");
                fired++;
            }
            if (r.resolutionAtRisk() && !done.contains("SLA_WARNING")) {
                audit.save(new AuditLog(id, null, "SLA_WARNING", status, status, "Resolution deadline is less than 5 minutes away"));
                publish(id, "SLA_WARNING", id + " will miss its resolution target in under 5 minutes");
                fired++;
            }
        }
        return fired;
    }

    // =====================================================================================
    // Administration (IT manager): catalogue, SLA policies, categories, settings, technicians
    // =====================================================================================

    public List<ServiceView> adminServices(Actor actor) {
        actor.require(Actor.ADMIN, "manage services");
        return services();
    }

    public synchronized ServiceView createService(Actor actor, String name, String category, String criticality) {
        actor.require(Actor.ADMIN, "manage services");
        ITService svc = catalogue.saveService(new ITService(null, serviceName(name),
                Mapping.category(Objects.requireNonNullElse(category, "")).name(), severity(criticality)));
        System.out.println("[ADMIN] user " + actor.userId() + " added service " + svc.getServiceName());
        return serviceView(svc);
    }

    public synchronized ServiceView updateService(Actor actor, long serviceId, String name, String category, String criticality) {
        actor.require(Actor.ADMIN, "manage services");
        ITService current = catalogue.findServiceById(serviceId).orElseThrow(() -> new NotFoundException("Service " + serviceId + " was not found."));
        String newName = name == null ? current.getServiceName() : serviceName(name);
        String newCategory = category == null ? current.getCategory() : Mapping.category(category).name();
        String newCriticality = criticality == null ? current.getBusinessCriticality().name() : severity(criticality).name();
        queries.updateService(serviceId, newName, newCategory, newCriticality);
        return serviceView(catalogue.findServiceById(serviceId).orElseThrow());
    }

    public List<SlaPolicyView> slaPolicies(Actor actor) {
        actor.require(Actor.ADMIN, "manage SLA policies");
        return catalogue.findAllSlaPolicies().stream()
                .sorted(Comparator.comparing((com.irctc.itsm.model.SLAPolicy p) -> p.getPriority().name()))
                .map(p -> new SlaPolicyView(p.getPriority().name(), p.getResponseTargetMins(), p.getResolutionTargetMins())).toList();
    }

    /** Applies to incidents reported from now on; existing incidents keep the deadlines they were given. */
    public synchronized SlaPolicyView updateSlaPolicy(Actor actor, String priorityText, Integer responseMinutes, Integer resolutionMinutes) {
        actor.require(Actor.ADMIN, "manage SLA policies");
        com.irctc.itsm.model.Priority priority;
        try { priority = com.irctc.itsm.model.Priority.valueOf(Objects.requireNonNullElse(priorityText, "").toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException e) { throw new IllegalArgumentException("Priority must be P1, P2, P3 or P4."); }
        int response = range(responseMinutes, "response target (minutes)", 1, 10_080);
        int resolution = range(resolutionMinutes, "resolution target (minutes)", 1, 43_200);
        if (resolution <= response) throw new IllegalArgumentException("The resolution target must be longer than the response target.");
        catalogue.saveOrUpdateSlaPolicy(new com.irctc.itsm.model.SLAPolicy(null, priority, response, resolution));
        System.out.println("[ADMIN] user " + actor.userId() + " set " + priority + " SLA to " + response + "/" + resolution + " min");
        return new SlaPolicyView(priority.name(), response, resolution);
    }

    public List<CategoryView> adminCategories(Actor actor) {
        actor.require(Actor.ADMIN, "manage categories");
        return queries.categories().stream().map(c -> new CategoryView(c.code(), c.label(), c.active())).toList();
    }

    public synchronized CategoryView updateCategory(Actor actor, String code, String label, Boolean active) {
        actor.require(Actor.ADMIN, "manage categories");
        String key = Mapping.category(Objects.requireNonNullElse(code, "")).name();
        String newLabel = label == null ? null : text(label, "label", 2, 60);
        if (Boolean.FALSE.equals(active) && queries.categories().stream().filter(IntegrationQueries.CategoryRow::active).count() <= 1)
            throw new IllegalStateException("At least one category must stay available.");
        if (!queries.updateCategory(key, newLabel, active)) throw new NotFoundException("Category " + key + " was not found.");
        return queries.categories().stream().filter(c -> c.code().equals(key)).findFirst()
                .map(c -> new CategoryView(c.code(), c.label(), c.active())).orElseThrow();
    }

    public SettingsView settings(Actor actor) {
        actor.require(Actor.ADMIN, "manage settings");
        return new SettingsView(defaultStrategy(), assignmentStrategies());
    }

    public synchronized SettingsView updateSettings(Actor actor, String defaultAssignmentStrategy) {
        actor.require(Actor.ADMIN, "manage settings");
        String key = Objects.requireNonNullElse(defaultAssignmentStrategy, "").trim().toLowerCase(Locale.ROOT);
        if (!assignmentStrategies.containsKey(key)) throw new IllegalArgumentException("Choose one of " + assignmentStrategies() + ".");
        queries.setSetting("default_assignment_strategy", key);
        return settings(actor);
    }

    /** Creates or updates a technician's skill, experience and availability; current workload is kept. */
    public synchronized TechnicianView saveTechnicianProfile(Actor actor, long userId, String skill, Integer experienceYears, Boolean available) {
        actor.require(Actor.ADMIN, "manage technicians");
        Snapshot s = snapshot();
        com.irctc.itsm.model.User user = s.user(userId).orElseThrow(() -> new NotFoundException("User " + userId + " was not found."));
        if (user.getRole() != com.irctc.itsm.model.Role.TECHNICIAN) throw new IllegalArgumentException(user.getFullName() + " is not a technician.");
        TechnicianDetail current = s.technicianDetails().get(userId);
        String skillCode = skill == null && current != null ? current.getSkillCategory() : Mapping.category(Objects.requireNonNullElse(skill, "")).name();
        Mapping.skill(skillCode);
        int years = experienceYears == null ? (current == null ? 1 : current.getExperienceYears()) : range(experienceYears, "experience (years)", 0, 50);
        boolean isAvailable = available == null ? current == null || current.isAvailable() : available;
        users.saveTechnicianDetail(new TechnicianDetail(userId, skillCode, current == null ? 0 : current.getCurrentWorkload(), years, isAvailable));
        return technicianViews(snapshot()).stream().filter(t -> t.id() == userId).findFirst().orElseThrow();
    }

    // =====================================================================================
    // Helpers
    // =====================================================================================

    private static CustomerReportAssessment.Effect effect(String text) {
        try { return CustomerReportAssessment.Effect.valueOf(Objects.requireNonNullElse(text, "").trim().toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException e) { throw new IllegalArgumentException("Tell us how the problem affected you."); }
    }

    private String defaultStrategy() {
        String value = queries.setting("default_assignment_strategy", "skill");
        return assignmentStrategies.containsKey(value) ? value : "skill";
    }

    private static String serviceName(String name) {
        String v = text(name, "service name", 3, 100).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_").replaceAll("^_|_$", "");
        if (v.length() < 3) throw new IllegalArgumentException("Enter a service name of 3-100 letters or digits.");
        return v;
    }

    private static com.irctc.itsm.model.SeverityLevel severity(String text) {
        try { return com.irctc.itsm.model.SeverityLevel.valueOf(Objects.requireNonNullElse(text, "").trim().toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException e) { throw new IllegalArgumentException("Criticality must be CRITICAL, HIGH, MEDIUM or LOW."); }
    }

    private void publish(String incidentId, String type, String message) {
        events.publish(new IncidentEvent(Ids.incident(incidentId), type, message, clock.instant()));
    }

    private boolean canSee(Actor actor, com.irctc.itsm.model.Incident dto) {
        if (actor.isAdmin()) return true;
        if (actor.isReporter()) return Objects.equals(dto.getReporterId(), actor.userId());
        return Objects.equals(dto.getAssignedTechnicianId(), actor.userId());
    }

    private com.irctc.itsm.model.Incident visible(Snapshot s, Actor actor, String id) {
        return s.incident(id).filter(d -> canSee(actor, d))
                .orElseThrow(() -> new NotFoundException("Incident " + id + " was not found or is not visible to you."));
    }

    private List<SimilarView> similarTo(Snapshot s, Incident incident) {
        IncidentManagementService domainService = new IncidentManagementService(new SnapshotIncidentRepository(s),
                priorityStrategy, assignmentStrategies.get("load"), events);
        return domainService.findPotentialDuplicates(incident).stream()
                .map(d -> s.incident(Ids.incidentKey(d.getId()).orElseThrow()).orElseThrow())
                .map(d -> new SimilarView(d.getIncidentId(), d.getTitle(), d.getStatus().name(), d.getPriority() == null ? null : d.getPriority().name()))
                .toList();
    }

    private IncidentView view(Snapshot s, com.irctc.itsm.model.Incident dto, Actor actor, Instant now, boolean detail) {
        Incident incident = s.restore(dto);
        String id = dto.getIncidentId();
        String sla = "NONE";
        Instant responseDue = Mapping.instant(dto.getSlaResponseDeadline()), resolutionDue = Mapping.instant(dto.getSlaResolutionDeadline());
        if (incident.getPriority() != null) {
            SLAResult r = SLAEvaluator.evaluate(incident, now);
            boolean breached = dto.isSlaViolated() || r.responseViolated() || r.resolutionViolated();
            sla = breached ? "BREACHED" : s.resolvedAt(id) != null ? "MET" : r.resolutionAtRisk() ? "AT_RISK" : "WITHIN";
            if (responseDue == null) responseDue = r.responseDeadline();
            if (resolutionDue == null) resolutionDue = r.resolutionDeadline();
        }
        ITService service = s.services().get(dto.getServiceId());
        ResolutionView resolution = null;
        List<HistoryView> history = null;
        List<String> actions = null;
        List<SimilarView> similar = null;
        if (detail) {
            resolution = resolutions.findByIncidentId(id).map(r -> new ResolutionView(r.getResolutionSummary(), r.getRootCause(),
                    Mapping.instant(r.getResolvedAt()), r.getTechnicianId(), s.userName(r.getTechnicianId()), r.getUserFeedback())).orElse(null);
            history = audit.findByIncidentId(id).stream().map(a -> new HistoryView(Mapping.instant(a.getTimestamp()), a.getPerformedByUserId(),
                    a.getPerformedByUserId() == null ? "System" : s.userName(a.getPerformedByUserId()), a.getAction(),
                    a.getPreviousState(), a.getNewState(), a.getDescription())).toList();
            actions = allowedActions(actor, dto, resolution, incident.isAwaitingInformation());
            similar = actor.isReporter() ? List.of() : similarTo(s, incident);
        }
        if (actor.isCustomer()) {
            // Customers see what is happening and who is helping them, never internal triage:
            // no priority, SLA targets, impact ratings, internal notes or internal history entries.
            if (history != null) history = customerHistory(history, s);
            return new IncidentView(id, dto.getTitle(), dto.getDescription(), dto.getCategory(), dto.getServiceId(),
                    service == null ? null : service.getServiceName(), 0, 0, 0, 0, false, null, null,
                    dto.getStatus().name(), dto.getReporterId(), s.userName(dto.getReporterId()), dto.getAssignedTechnicianId(),
                    s.userName(dto.getAssignedTechnicianId()), Mapping.instant(dto.getCreatedAt()), s.acknowledgedAt(id),
                    null, null, s.resolvedAt(id), "NONE", incident.getInformationRequest(), incident.getInformationRequestedAt(),
                    resolution, history, actions, similar);
        }
        return new IncidentView(id, dto.getTitle(), dto.getDescription(), dto.getCategory(), dto.getServiceId(),
                service == null ? null : service.getServiceName(), Mapping.score(dto.getImpact()), Mapping.score(dto.getUrgency()),
                incident.getAffectedService().getBusinessCriticality(), s.affectedUsers(id), dto.isTatkalWindow(),
                dto.getPriority() == null ? null : dto.getPriority().name(),
                incident.getPriority() == null ? null : PriorityExplainer.explain(incident, incident.getPriority()),
                dto.getStatus().name(), dto.getReporterId(), s.userName(dto.getReporterId()), dto.getAssignedTechnicianId(),
                s.userName(dto.getAssignedTechnicianId()), Mapping.instant(dto.getCreatedAt()), s.acknowledgedAt(id),
                responseDue, resolutionDue, s.resolvedAt(id), sla, incident.getInformationRequest(), incident.getInformationRequestedAt(),
                resolution, history, actions, similar);
    }

    /** History entries a customer may see. Internal triage (priority, assessment, duplicates, notes, SLA) is left out. */
    private static final Set<String> CUSTOMER_VISIBLE = Set.of("INCIDENT_CREATED", "TECHNICIAN_ASSIGNED", "STATUS_CHANGED",
            "INCIDENT_RESOLVED", "INFO_REQUESTED", "INFO_PROVIDED", "MESSAGE", "FEEDBACK");

    private static List<HistoryView> customerHistory(List<HistoryView> history, Snapshot s) {
        return history.stream().filter(h -> CUSTOMER_VISIBLE.contains(h.action()))
                .map(h -> h.action().equals("TECHNICIAN_ASSIGNED")
                        ? new HistoryView(h.at(), h.actorId(), h.actorName(), h.action(), h.fromStatus(), h.toStatus(), "An IT team member was assigned to help you")
                        : h)
                .toList();
    }

    private List<String> allowedActions(Actor actor, com.irctc.itsm.model.Incident dto, ResolutionView resolution, boolean waiting) {
        String status = dto.getStatus().name();
        List<String> actions = new ArrayList<>();
        if (actor.isAdmin()) {
            if (status.equals("CLASSIFIED")) actions.add("ASSIGN");
            if (status.equals("VERIFIED")) actions.add("CLOSE");
        }
        if (actor.isTechnician() && Objects.equals(dto.getAssignedTechnicianId(), actor.userId())) {
            switch (status) {
                case "ASSIGNED" -> actions.add("ACKNOWLEDGE");
                case "ACKNOWLEDGED" -> actions.add("START");
                case "IN_PROGRESS" -> { if (!waiting) actions.add("RESOLVE"); }
                default -> { }
            }
            if (!waiting && (status.equals("ACKNOWLEDGED") || status.equals("IN_PROGRESS"))) actions.add("REQUEST_INFO");
        }
        if (actor.isReporter() && Objects.equals(dto.getReporterId(), actor.userId())) {
            if (waiting) actions.add("PROVIDE_INFO");
            if (status.equals("RESOLVED")) actions.add("VERIFY");
            if (FINISHED.contains(status) && resolution != null && resolution.feedback() == null) actions.add("FEEDBACK");
        }
        if (!status.equals("CLOSED")) {
            if (!actor.isCustomer()) actions.add("NOTE");
            if (canMessage(actor, dto)) actions.add("MESSAGE");
        }
        return actions;
    }

    private List<TechnicianView> technicianViews(Snapshot s) {
        List<TechnicianView> list = new ArrayList<>();
        for (Map.Entry<Long, TechnicianDetail> e : s.technicianDetails().entrySet()) {
            TechnicianDetail d = e.getValue();
            com.irctc.itsm.model.User u = s.user(e.getKey()).orElseThrow();
            list.add(new TechnicianView(e.getKey(), u.getFullName(), u.getEmail(), d.getSkillCategory(), d.getCurrentWorkload(),
                    Snapshot.TECHNICIAN_CAPACITY, d.getExperienceYears(), d.isAvailable() && s.isActive(e.getKey())));
        }
        return list;
    }

    private ServiceView serviceView(ITService svc) {
        return new ServiceView(svc.getServiceId(), svc.getServiceName(), svc.getCategory(), svc.getBusinessCriticality().name(),
                Mapping.criticality(svc.getBusinessCriticality()));
    }

    private static long userIdOf(Snapshot s, Technician technician) {
        return s.technicianDetails().keySet().stream().filter(k -> Ids.user(k).equals(technician.getId())).findFirst()
                .orElseThrow(() -> new IllegalStateException("Selected technician is not in the database"));
    }

    private static List<Count> counts(List<IncidentView> views, Function<IncidentView, String> key) {
        Map<String, Long> map = new TreeMap<>();
        for (IncidentView v : views) map.merge(Objects.requireNonNullElse(key.apply(v), "—"), 1L, Long::sum);
        return map.entrySet().stream().map(e -> new Count(e.getKey(), e.getValue())).toList();
    }

    private static boolean matches(String filter, String value) {
        return filter == null || filter.isBlank() || filter.equalsIgnoreCase(value);
    }

    private static LocalDate date(String text) {
        if (text == null || text.isBlank()) return null;
        try { return LocalDate.parse(text); } catch (RuntimeException e) { throw new IllegalArgumentException("Dates must look like 2026-11-22."); }
    }

    private static String text(String value, String field, int min, int max) {
        String v = value == null ? "" : value.trim();
        if (v.length() < min || v.length() > max) throw new IllegalArgumentException("Enter a " + field + " of " + min + "–" + max + " characters.");
        return v;
    }

    private static int range(Integer value, String field, int min, int max) {
        if (value == null || value < min || value > max) throw new IllegalArgumentException("The " + field + " must be between " + min + " and " + max + ".");
        return value;
    }
}
