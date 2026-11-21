package com.irctc.itsm.repository.impl;

import com.irctc.itsm.model.Resolution;
import com.irctc.itsm.repository.ResolutionRepository;
import java.sql.*;
import java.util.Optional;

public class PostgresResolutionRepository implements ResolutionRepository {

    @Override
    public Resolution resolveIncident(Resolution resolution) {
        String insertResSql = """
            INSERT INTO resolutions (incident_id, technician_id, root_cause, resolution_summary, resolved_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (incident_id) DO UPDATE SET
            root_cause = EXCLUDED.root_cause, resolution_summary = EXCLUDED.resolution_summary, resolved_at = EXCLUDED.resolved_at
            """;
        String updateIncSql = "UPDATE incidents SET status = 'RESOLVED' WHERE incident_id = ?";
        String updateTechSql = "UPDATE technician_details SET current_workload = GREATEST(current_workload - 1, 0) WHERE technician_id = ?";
        String auditSql = "INSERT INTO audit_logs (incident_id, performed_by, action, previous_state, new_state, description) VALUES (?, ?, 'INCIDENT_RESOLVED', 'IN_PROGRESS', 'RESOLVED', ?)";

        try (Connection conn = DatabaseConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                try (PreparedStatement ps1 = conn.prepareStatement(insertResSql, Statement.RETURN_GENERATED_KEYS)) {
                    ps1.setString(1, resolution.getIncidentId());
                    ps1.setObject(2, resolution.getTechnicianId(), Types.BIGINT);
                    ps1.setString(3, resolution.getRootCause());
                    ps1.setString(4, resolution.getResolutionSummary());
                    ps1.setTimestamp(5, Timestamp.valueOf(resolution.getResolvedAt()));
                    ps1.executeUpdate();
                    ResultSet keys = ps1.getGeneratedKeys();
                    if (keys.next()) resolution.setResolutionId(keys.getLong(1));
                }

                try (PreparedStatement ps2 = conn.prepareStatement(updateIncSql)) {
                    ps2.setString(1, resolution.getIncidentId());
                    ps2.executeUpdate();
                }

                if (resolution.getTechnicianId() != null) {
                    try (PreparedStatement ps3 = conn.prepareStatement(updateTechSql)) {
                        ps3.setLong(1, resolution.getTechnicianId());
                        ps3.executeUpdate();
                    }
                }

                try (PreparedStatement ps4 = conn.prepareStatement(auditSql)) {
                    ps4.setString(1, resolution.getIncidentId());
                    ps4.setObject(2, resolution.getTechnicianId(), Types.BIGINT);
                    ps4.setString(3, "Resolved: " + resolution.getResolutionSummary());
                    ps4.executeUpdate();
                }

                conn.commit();
                return resolution;
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            }
        } catch (SQLException e) {
            throw new DatabaseException("Failed to resolve incident: " + resolution.getIncidentId(), e);
        }
    }

    @Override
    public Optional<Resolution> findByIncidentId(String incidentId) {
        String sql = "SELECT * FROM resolutions WHERE incident_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, incidentId);
            ResultSet rs = ps.executeQuery();
            if (!rs.next()) return Optional.empty();

            Resolution r = new Resolution();
            r.setResolutionId(((Number) rs.getObject("resolution_id")).longValue());
            r.setIncidentId(rs.getString("incident_id"));
            Number techId = (Number) rs.getObject("technician_id");
            r.setTechnicianId(techId != null ? techId.longValue() : null);
            r.setRootCause(rs.getString("root_cause"));
            r.setResolutionSummary(rs.getString("resolution_summary"));
            Timestamp ts = rs.getTimestamp("resolved_at");
            if (ts != null) r.setResolvedAt(ts.toLocalDateTime());
            Number fb = (Number) rs.getObject("user_feedback");
            r.setUserFeedback(fb != null ? fb.intValue() : null);
            return Optional.of(r);
        } catch (SQLException e) {
            throw new DatabaseException("Failed to fetch resolution for: " + incidentId, e);
        }
    }

    @Override
    public boolean submitFeedback(String incidentId, int rating) {
        String sql = "UPDATE resolutions SET user_feedback = ? WHERE incident_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, rating);
            ps.setString(2, incidentId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new DatabaseException("Failed to submit feedback for: " + incidentId, e);
        }
    }
}