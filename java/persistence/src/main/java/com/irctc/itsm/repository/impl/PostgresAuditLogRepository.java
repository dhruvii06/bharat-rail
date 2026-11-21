package com.irctc.itsm.repository.impl;

import com.irctc.itsm.model.AuditLog;
import com.irctc.itsm.repository.AuditLogRepository;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class PostgresAuditLogRepository implements AuditLogRepository {

    @Override
    public AuditLog save(AuditLog log) {
        String sql = "INSERT INTO audit_logs (incident_id, performed_by, action, previous_state, new_state, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, log.getIncidentId());
            ps.setObject(2, log.getPerformedByUserId(), Types.BIGINT);
            ps.setString(3, log.getAction());
            ps.setString(4, log.getPreviousState());
            ps.setString(5, log.getNewState());
            ps.setString(6, log.getDescription());
            ps.setTimestamp(7, Timestamp.valueOf(log.getTimestamp()));
            ps.executeUpdate();

            ResultSet keys = ps.getGeneratedKeys();
            if (keys.next()) {
                log.setLogId(keys.getLong(1));
            }
            return log;
        } catch (SQLException e) {
            throw new DatabaseException("Failed to save audit log", e);
        }
    }

 @Override
    public List<AuditLog> findByIncidentId(String incidentId) {
        List<AuditLog> logs = new ArrayList<>();
        String sql = "SELECT * FROM audit_logs WHERE incident_id = ? ORDER BY created_at ASC";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, incidentId);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                AuditLog log = new AuditLog();
                log.setLogId(rs.getLong("log_id"));
                log.setIncidentId(rs.getString("incident_id"));
                Number performedBy = (Number) rs.getObject("performed_by");
                log.setPerformedByUserId(performedBy != null ? performedBy.longValue() : null);
                log.setAction(rs.getString("action"));
                log.setPreviousState(rs.getString("previous_state"));
                log.setNewState(rs.getString("new_state"));
                log.setDescription(rs.getString("description"));
                Timestamp ts = rs.getTimestamp("created_at");
                if (ts != null) log.setTimestamp(ts.toLocalDateTime());
                logs.add(log);
            }
            return logs;
        } catch (SQLException e) {
            throw new DatabaseException("Failed to fetch audit logs for: " + incidentId, e);
        }
    }
}