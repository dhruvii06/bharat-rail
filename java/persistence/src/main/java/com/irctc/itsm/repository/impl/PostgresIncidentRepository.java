package com.irctc.itsm.repository.impl;

import com.irctc.itsm.model.*;
import com.irctc.itsm.repository.IncidentRepository;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class PostgresIncidentRepository implements IncidentRepository {

    @Override
    public Incident save(Incident incident) {
        String sql = """
            INSERT INTO incidents (incident_id, reporter_id, service_id, category, title, description,
            impact, urgency, priority, tatkal_window, status, assigned_technician_id, sla_id,
            created_at, sla_response_deadline, sla_resolution_deadline, sla_violated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (incident_id) DO UPDATE SET
            service_id = EXCLUDED.service_id,
            category = EXCLUDED.category,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            impact = EXCLUDED.impact,
            urgency = EXCLUDED.urgency,
            priority = EXCLUDED.priority,
            tatkal_window = EXCLUDED.tatkal_window,
            status = EXCLUDED.status,
            assigned_technician_id = EXCLUDED.assigned_technician_id,
            sla_id = EXCLUDED.sla_id,
            sla_response_deadline = EXCLUDED.sla_response_deadline,
            sla_resolution_deadline = EXCLUDED.sla_resolution_deadline,
            sla_violated = EXCLUDED.sla_violated
            """;
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, incident.getIncidentId());
            ps.setObject(2, incident.getReporterId(), Types.BIGINT);
            ps.setObject(3, incident.getServiceId(), Types.BIGINT);
            ps.setString(4, incident.getCategory());
            ps.setString(5, incident.getTitle());
            ps.setString(6, incident.getDescription());
            ps.setString(7, incident.getImpact() != null ? incident.getImpact().name() : null);
            ps.setString(8, incident.getUrgency() != null ? incident.getUrgency().name() : null);
            ps.setString(9, incident.getPriority() != null ? incident.getPriority().name() : null);
            ps.setBoolean(10, incident.isTatkalWindow());
            ps.setString(11, incident.getStatus().name());
            ps.setObject(12, incident.getAssignedTechnicianId(), Types.BIGINT);
            ps.setObject(13, incident.getSlaId(), Types.BIGINT);
            ps.setTimestamp(14, Timestamp.valueOf(incident.getCreatedAt()));
            ps.setTimestamp(15, incident.getSlaResponseDeadline() != null ? Timestamp.valueOf(incident.getSlaResponseDeadline()) : null);
            ps.setTimestamp(16, incident.getSlaResolutionDeadline() != null ? Timestamp.valueOf(incident.getSlaResolutionDeadline()) : null);
            ps.setBoolean(17, incident.isSlaViolated());
            ps.executeUpdate();
            return incident;
        } catch (SQLException e) {
            throw new DatabaseException("Failed to save incident: " + incident.getIncidentId(), e);
        }
    }

    @Override
    public Optional<Incident> findById(String incidentId) {
        String sql = "SELECT * FROM incidents WHERE incident_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, incidentId);
            ResultSet rs = ps.executeQuery();
            return rs.next() ? Optional.of(mapRow(rs)) : Optional.empty();
        } catch (SQLException e) {
            throw new DatabaseException("Error fetching incident: " + incidentId, e);
        }
    }

    @Override
    public List<Incident> findAll() {
        return queryList("SELECT * FROM incidents ORDER BY created_at DESC", null);
    }

    @Override
    public List<Incident> findByStatus(IncidentStatus status) {
        return queryList("SELECT * FROM incidents WHERE status = ?", status.name());
    }

    @Override
    public List<Incident> findByPriority(Priority priority) {
        return queryList("SELECT * FROM incidents WHERE priority = ?", priority.name());
    }

    @Override
    public List<Incident> findByTechnicianId(Long technicianId) {
        List<Incident> list = new ArrayList<>();
        String sql = "SELECT * FROM incidents WHERE assigned_technician_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, technicianId);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) list.add(mapRow(rs));
            return list;
        } catch (SQLException e) {
            throw new DatabaseException("Error fetching technician incidents", e);
        }
    }

    @Override
    public List<Incident> findSlaViolatedIncidents() {
        return queryList("SELECT * FROM incidents WHERE sla_violated = TRUE OR (sla_resolution_deadline < NOW() AND status NOT IN ('RESOLVED', 'VERIFIED', 'CLOSED'))", null);
    }

    @Override
    public boolean updateStatus(String incidentId, IncidentStatus newStatus, Long modifiedByUserId) {
        String selectSql = "SELECT status FROM incidents WHERE incident_id = ? FOR UPDATE";
        String updateSql = "UPDATE incidents SET status = ? WHERE incident_id = ?";
        String auditSql = "INSERT INTO audit_logs (incident_id, performed_by, action, previous_state, new_state, description) VALUES (?, ?, 'STATUS_CHANGED', ?, ?, ?)";

        try (Connection conn = DatabaseConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                IncidentStatus currentStatus;
                try (PreparedStatement psSelect = conn.prepareStatement(selectSql)) {
                    psSelect.setString(1, incidentId);
                    ResultSet rs = psSelect.executeQuery();
                    if (!rs.next()) {
                        conn.rollback();
                        return false;
                    }
                    currentStatus = IncidentStatus.valueOf(rs.getString("status"));
                }

                if (!isValidTransition(currentStatus, newStatus)) {
                    conn.rollback();
                    throw new IllegalStateException("Invalid status transition from " + currentStatus + " to " + newStatus);
                }

                try (PreparedStatement psUpdate = conn.prepareStatement(updateSql)) {
                    psUpdate.setString(1, newStatus.name());
                    psUpdate.setString(2, incidentId);
                    psUpdate.executeUpdate();
                }

                try (PreparedStatement psAudit = conn.prepareStatement(auditSql)) {
                    psAudit.setString(1, incidentId);
                    psAudit.setObject(2, modifiedByUserId, Types.BIGINT);
                    psAudit.setString(3, currentStatus.name());
                    psAudit.setString(4, newStatus.name());
                    psAudit.setString(5, "Status transitioned from " + currentStatus.name() + " to " + newStatus.name());
                    psAudit.executeUpdate();
                }

                conn.commit();
                return true;
            } catch (SQLException | RuntimeException e) {
                conn.rollback();
                throw e;
            }
        } catch (SQLException e) {
            throw new DatabaseException("Transaction failed during status update", e);
        }
    }

    @Override
    public boolean assignTechnician(String incidentId, Long technicianId, Long modifiedByUserId) {
        String selectSql = "SELECT status FROM incidents WHERE incident_id = ? FOR UPDATE";
        String updateSql = "UPDATE incidents SET assigned_technician_id = ?, status = 'ASSIGNED' WHERE incident_id = ?";
        String workloadSql = "UPDATE technician_details SET current_workload = current_workload + 1 WHERE technician_id = ?";
        String auditSql = "INSERT INTO audit_logs (incident_id, performed_by, action, previous_state, new_state, description) VALUES (?, ?, 'TECHNICIAN_ASSIGNED', ?, 'ASSIGNED', ?)";

        try (Connection conn = DatabaseConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                String oldStatus;
                try (PreparedStatement psSelect = conn.prepareStatement(selectSql)) {
                    psSelect.setString(1, incidentId);
                    ResultSet rs = psSelect.executeQuery();
                    if (!rs.next()) {
                        conn.rollback();
                        return false;
                    }
                    oldStatus = rs.getString("status");
                }

                try (PreparedStatement ps1 = conn.prepareStatement(updateSql)) {
                    ps1.setLong(1, technicianId);
                    ps1.setString(2, incidentId);
                    ps1.executeUpdate();
                }

                try (PreparedStatement ps2 = conn.prepareStatement(workloadSql)) {
                    ps2.setLong(1, technicianId);
                    ps2.executeUpdate();
                }

                try (PreparedStatement ps3 = conn.prepareStatement(auditSql)) {
                    ps3.setString(1, incidentId);
                    ps3.setObject(2, modifiedByUserId, Types.BIGINT);
                    ps3.setString(3, oldStatus);
                    ps3.setString(4, "Assigned to Technician ID: " + technicianId);
                    ps3.executeUpdate();
                }

                conn.commit();
                return true;
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            }
        } catch (SQLException e) {
            throw new DatabaseException("Transaction failed during technician assignment", e);
        }
    }

    private boolean isValidTransition(IncidentStatus current, IncidentStatus next) {
        return switch (current) {
            case NEW -> next == IncidentStatus.CLASSIFIED;
            case CLASSIFIED -> next == IncidentStatus.ASSIGNED;
            case ASSIGNED -> next == IncidentStatus.ACKNOWLEDGED;
            case ACKNOWLEDGED -> next == IncidentStatus.IN_PROGRESS;
            case IN_PROGRESS -> next == IncidentStatus.RESOLVED;
            case RESOLVED -> next == IncidentStatus.VERIFIED || next == IncidentStatus.IN_PROGRESS;
            case VERIFIED -> next == IncidentStatus.CLOSED;
            case CLOSED -> false;
        };
    }

    private List<Incident> queryList(String sql, String param) {
        List<Incident> list = new ArrayList<>();
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            if (param != null) ps.setString(1, param);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) list.add(mapRow(rs));
            return list;
        } catch (SQLException e) {
            throw new DatabaseException("Query execution failed", e);
        }
    }

    private Incident mapRow(ResultSet rs) throws SQLException {
        Incident inc = new Incident();
        inc.setIncidentId(rs.getString("incident_id"));
        inc.setReporterId(getNullableLong(rs, "reporter_id"));
        inc.setServiceId(getNullableLong(rs, "service_id"));
        inc.setCategory(rs.getString("category"));
        inc.setTitle(rs.getString("title"));
        inc.setDescription(rs.getString("description"));
        if (rs.getString("impact") != null) inc.setImpact(SeverityLevel.valueOf(rs.getString("impact")));
        if (rs.getString("urgency") != null) inc.setUrgency(SeverityLevel.valueOf(rs.getString("urgency")));
        if (rs.getString("priority") != null) inc.setPriority(Priority.valueOf(rs.getString("priority")));
        inc.setTatkalWindow(rs.getBoolean("tatkal_window"));
        inc.setStatus(IncidentStatus.valueOf(rs.getString("status")));
        inc.setAssignedTechnicianId(getNullableLong(rs, "assigned_technician_id"));
        inc.setSlaId(getNullableLong(rs, "sla_id"));
        Timestamp created = rs.getTimestamp("created_at");
        if (created != null) inc.setCreatedAt(created.toLocalDateTime());
        Timestamp resp = rs.getTimestamp("sla_response_deadline");
        if (resp != null) inc.setSlaResponseDeadline(resp.toLocalDateTime());
        Timestamp res = rs.getTimestamp("sla_resolution_deadline");
        if (res != null) inc.setSlaResolutionDeadline(res.toLocalDateTime());
        inc.setSlaViolated(rs.getBoolean("sla_violated"));
        return inc;
    }

    private Long getNullableLong(ResultSet rs, String column) throws SQLException {
        Number num = (Number) rs.getObject(column);
        return num != null ? num.longValue() : null;
    }
}
