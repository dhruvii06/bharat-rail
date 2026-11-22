package com.railway.itsm.service.http;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.irctc.itsm.repository.impl.DatabaseException;
import com.railway.itsm.domain.exceptions.DomainException;
import com.railway.itsm.domain.exceptions.InvalidTransitionException;
import com.railway.itsm.domain.exceptions.NoTechnicianAvailableException;
import com.railway.itsm.domain.exceptions.SLAPolicyNotFoundException;
import com.railway.itsm.domain.exceptions.TechnicianUnavailableException;
import com.railway.itsm.domain.exceptions.TechnicianWorkloadExceededException;
import com.railway.itsm.domain.exceptions.UnauthorizedIncidentOperationException;
import com.railway.itsm.service.app.Actor;
import com.railway.itsm.service.app.IncidentWorkflowService;
import com.railway.itsm.service.app.IncidentWorkflowService.NewIncident;
import com.railway.itsm.service.app.NotFoundException;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Internal HTTP API of the incident service. It listens on localhost only and accepts requests
 * only from the Node API, which authenticates users and passes the signed-in user's id and role
 * with a shared internal token. Errors use the same JSON shape as the Node API.
 */
public final class ApiServer {
    private record Request(Map<String, String> path, Map<String, String> query, JsonNode body, Actor actor) {
        String id() { return path.get("id"); }
        String text(String field) { JsonNode n = body.get(field); return n == null || n.isNull() ? null : n.asText(); }
        Integer integer(String field) { JsonNode n = body.get(field); return n == null || n.isNull() ? null : n.isInt() ? n.asInt() : Integer.valueOf(n.asText()); }
        Boolean bool(String field) { JsonNode n = body.get(field); return n == null || n.isNull() ? null : n.asBoolean(); }
        Long number(String field) { JsonNode n = body.get(field); return n == null || n.isNull() || n.asText().isBlank() ? null : Long.valueOf(n.asText()); }
    }

    private interface Handler { Object handle(Request r) throws Exception; }

    private record Route(String method, Pattern pattern, List<String> names, int status, Handler handler) {}

    private static final Pattern PARAM = Pattern.compile("\\{(\\w+)}");

    private final List<Route> routes = new ArrayList<>();
    private final ObjectMapper json = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    private final byte[] token;
    private final int port;

    public ApiServer(int port, String internalToken, IncidentWorkflowService workflow) {
        this.port = port;
        this.token = internalToken.getBytes(StandardCharsets.UTF_8);

        route("GET", "/incidents", 200, r -> workflow.list(r.actor(), r.query()));
        route("POST", "/incidents", 201, r -> workflow.report(r.actor(), json.treeToValue(r.body(), NewIncident.class)));
        route("GET", "/incidents/{id}", 200, r -> workflow.detail(r.actor(), r.id()));
        route("POST", "/incidents/{id}/assignment", 200, r -> workflow.assign(r.actor(), r.id(), r.text("strategy"), r.number("technicianId")));
        route("POST", "/incidents/{id}/transitions", 200, r -> workflow.transition(r.actor(), r.id(), r.text("action"), r.text("summary"), r.text("rootCause")));
        route("POST", "/incidents/{id}/notes", 200, r -> workflow.addNote(r.actor(), r.id(), r.text("text")));
        route("POST", "/incidents/{id}/messages", 200, r -> workflow.sendMessage(r.actor(), r.id(), r.text("text")));
        route("PATCH", "/incidents/{id}", 200, r -> workflow.edit(r.actor(), r.id(), r.text("title"), r.text("description"), r.text("category")));
        route("GET", "/audit", 200, r -> workflow.searchAudit(r.actor(), r.query()));
        route("POST", "/incidents/{id}/priority", 200, r -> workflow.changePriority(r.actor(), r.id(), r.text("priority"), r.text("reason")));
        route("POST", "/incidents/{id}/feedback", 200, r -> workflow.feedback(r.actor(), r.id(), r.integer("rating")));
        route("GET", "/incidents/{id}/similar", 200, r -> workflow.similar(r.actor(), r.id()));
        route("GET", "/incidents/{id}/colleagues", 200, r -> workflow.colleagues(r.actor(), r.id()));
        route("POST", "/incidents/{id}/handover", 200, r -> workflow.requestHandover(r.actor(), r.id(), r.number("technicianId"), r.text("reason")));
        route("POST", "/incidents/{id}/handover/accept", 200, r -> workflow.acceptHandover(r.actor(), r.id()));
        route("POST", "/incidents/{id}/handover/decline", 200, r -> workflow.declineHandover(r.actor(), r.id(), r.text("reason")));
        route("POST", "/incidents/{id}/handover/withdraw", 200, r -> workflow.withdrawHandover(r.actor(), r.id()));
        route("POST", "/incidents/{id}/handoff", 200, r -> workflow.handOff(r.actor(), r.id(), r.number("technicianId"), r.text("team"), r.text("workDone")));
        route("POST", "/incidents/{id}/info-request", 200, r -> workflow.requestInformation(r.actor(), r.id(), r.text("question")));
        route("POST", "/incidents/{id}/info-response", 200, r -> workflow.provideInformation(r.actor(), r.id(), r.text("answer")));
        route("GET", "/services", 200, r -> workflow.services());
        route("GET", "/categories", 200, r -> workflow.categories());
        route("GET", "/assignment-strategies", 200, r -> workflow.assignmentStrategies());
        route("GET", "/technicians", 200, r -> workflow.technicians(r.actor()));
        route("GET", "/technicians/me", 200, r -> workflow.myWorkload(r.actor()));
        route("GET", "/notifications", 200, r -> workflow.notifications(r.actor()));
        route("GET", "/notifications/outbox", 200, r -> workflow.emailOutbox(r.actor()));
        route("POST", "/notifications/read-all", 204, r -> { workflow.markAllRead(r.actor()); return null; });
        route("POST", "/notifications/{id}/read", 204, r -> { workflow.markRead(r.actor(), Long.parseLong(r.id())); return null; });
        route("GET", "/reports/overview", 200, r -> workflow.overview(r.actor()));

        // Administration (IT manager). User accounts are managed by the Node API, which owns passwords.
        route("GET", "/admin/services", 200, r -> workflow.adminServices(r.actor()));
        route("POST", "/admin/services", 201, r -> workflow.createService(r.actor(), r.text("name"), r.text("category"), r.text("criticality"), r.bool("tatkalBookingPath")));
        route("PATCH", "/admin/services/{id}", 200, r -> workflow.updateService(r.actor(), Long.parseLong(r.id()), r.text("name"), r.text("category"), r.text("criticality"), r.bool("tatkalBookingPath")));
        route("GET", "/admin/sla-policies", 200, r -> workflow.slaPolicies(r.actor()));
        route("PUT", "/admin/sla-policies/{id}", 200, r -> workflow.updateSlaPolicy(r.actor(), r.id(), r.integer("responseMinutes"), r.integer("resolutionMinutes")));
        route("GET", "/admin/categories", 200, r -> workflow.adminCategories(r.actor()));
        route("POST", "/admin/categories", 201, r -> workflow.createCategory(r.actor(), r.text("label"), r.text("team")));
        route("PATCH", "/admin/categories/{id}", 200, r -> workflow.updateCategory(r.actor(), r.id(), r.text("label"), r.bool("active"), r.text("team")));
        route("GET", "/admin/settings", 200, r -> workflow.settings(r.actor()));
        route("PUT", "/admin/settings", 200, r -> workflow.updateSettings(r.actor(), r.text("defaultAssignmentStrategy")));
        route("PUT", "/admin/technicians/{id}", 200, r -> workflow.saveTechnicianProfile(r.actor(), Long.parseLong(r.id()), r.text("skill"), r.integer("experienceYears"), r.bool("available")));
    }

    private void route(String method, String template, int status, Handler handler) {
        List<String> names = new ArrayList<>();
        Matcher m = PARAM.matcher(template);
        while (m.find()) names.add(m.group(1));
        routes.add(new Route(method, Pattern.compile("^" + PARAM.matcher(template).replaceAll("([^/]+)") + "$"), names, status, handler));
    }

    public void start() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), port), 0);
        server.createContext("/", this::dispatch);
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();
    }

    private void dispatch(HttpExchange ex) throws IOException {
        try (ex) {
            String path = ex.getRequestURI().getPath();
            String method = ex.getRequestMethod();
            if (method.equals("GET") && path.equals("/health")) { send(ex, 200, Map.of("status", "ok")); return; }
            try {
                String given = Objects.requireNonNullElse(ex.getRequestHeaders().getFirst("X-Internal-Token"), "");
                if (!MessageDigest.isEqual(token, given.getBytes(StandardCharsets.UTF_8)))
                    throw new ApiError(401, "UNAUTHENTICATED", "Missing or wrong internal token.");
                Actor actor = actor(ex);
                for (Route route : routes) {
                    Matcher m = route.pattern().matcher(path);
                    if (!route.method().equals(method) || !m.matches()) continue;
                    Map<String, String> params = new HashMap<>();
                    for (int i = 0; i < route.names().size(); i++) params.put(route.names().get(i), decode(m.group(i + 1)));
                    Object result = route.handler().handle(new Request(params, query(ex), body(ex), actor));
                    send(ex, route.status(), result);
                    return;
                }
                throw new ApiError(404, "NOT_FOUND", "No endpoint matches " + method + " " + path + ".");
            } catch (Exception e) {
                ApiError error = toError(e);
                if (error.status >= 500) e.printStackTrace();
                send(ex, error.status, Map.of("error", Map.of("code", error.code, "message", error.getMessage())));
            }
        }
    }

    /** Domain and persistence exceptions to HTTP status codes; never exposes stack traces. */
    private static ApiError toError(Exception e) {
        if (e instanceof ApiError a) return a;
        if (e instanceof NotFoundException) return new ApiError(404, "NOT_FOUND", e.getMessage());
        if (e instanceof SecurityException || e instanceof UnauthorizedIncidentOperationException) return new ApiError(403, "FORBIDDEN", e.getMessage() + ".");
        if (e instanceof InvalidTransitionException) return new ApiError(409, "INVALID_TRANSITION", "That step is not allowed now: " + e.getMessage() + ".");
        if (e instanceof NoTechnicianAvailableException) return new ApiError(409, "NO_TECHNICIAN_AVAILABLE", e.getMessage() + ".");
        if (e instanceof TechnicianUnavailableException) return new ApiError(409, "TECHNICIAN_UNAVAILABLE", e.getMessage() + ".");
        if (e instanceof TechnicianWorkloadExceededException) return new ApiError(409, "TECHNICIAN_WORKLOAD_EXCEEDED", e.getMessage() + ".");
        if (e instanceof SLAPolicyNotFoundException) return new ApiError(409, "SLA_POLICY_MISSING", e.getMessage() + ".");
        if (e instanceof DomainException) return new ApiError(409, "DOMAIN_RULE", e.getMessage());
        if (e instanceof JsonProcessingException) return new ApiError(400, "BAD_REQUEST", "Request body is not valid JSON for this endpoint.");
        if (e instanceof IllegalArgumentException) return new ApiError(422, "VALIDATION_FAILED", e.getMessage());
        if (e instanceof IllegalStateException) return new ApiError(409, "CONFLICT", e.getMessage());
        if (e instanceof DatabaseException) return new ApiError(503, "DATABASE_UNAVAILABLE", "The database is not reachable. Try again shortly.");
        return new ApiError(500, "INTERNAL_ERROR", "Something went wrong in the incident service.");
    }

    private static Actor actor(HttpExchange ex) {
        String id = ex.getRequestHeaders().getFirst("X-Actor-Id"), role = ex.getRequestHeaders().getFirst("X-Actor-Role");
        if (id == null || role == null) throw new ApiError(401, "UNAUTHENTICATED", "Missing signed-in user.");
        try { return new Actor(Long.parseLong(id), role); }
        catch (NumberFormatException e) { throw new ApiError(401, "UNAUTHENTICATED", "Invalid signed-in user."); }
    }

    private JsonNode body(HttpExchange ex) throws IOException {
        try (InputStream in = ex.getRequestBody()) {
            byte[] bytes = in.readNBytes(100_000);
            if (bytes.length == 0) return json.createObjectNode();
            JsonNode node = json.readTree(bytes);
            return node == null || node instanceof NullNode ? json.createObjectNode() : node;
        }
    }

    private static Map<String, String> query(HttpExchange ex) {
        Map<String, String> map = new HashMap<>();
        String raw = ex.getRequestURI().getRawQuery();
        if (raw == null) return map;
        for (String pair : raw.split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0) map.put(decode(pair.substring(0, eq)), decode(pair.substring(eq + 1)));
        }
        return map;
    }

    private static String decode(String s) { return URLDecoder.decode(s, StandardCharsets.UTF_8); }

    private void send(HttpExchange ex, int status, Object body) throws IOException {
        if (status == 204 || body == null) { ex.sendResponseHeaders(status == 200 ? 204 : status, -1); return; }
        byte[] bytes = json.writeValueAsBytes(body);
        ex.getResponseHeaders().set("Content-Type", "application/json");
        ex.sendResponseHeaders(status, bytes.length);
        ex.getResponseBody().write(bytes);
    }

    private static final class ApiError extends RuntimeException {
        final int status; final String code;
        ApiError(int status, String code, String message) { super(message); this.status = status; this.code = code; }
    }
}
