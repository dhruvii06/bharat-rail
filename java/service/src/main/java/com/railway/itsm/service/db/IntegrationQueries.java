package com.railway.itsm.service.db;

import com.irctc.itsm.repository.impl.DatabaseConnection;
import com.irctc.itsm.repository.impl.DatabaseException;
import com.railway.itsm.service.app.Mapping;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Queries for the columns and tables added by integration.sql, which the original repositories
 * do not cover. Uses the same connection settings (ITSM_DB_* environment variables).
 */
public class IntegrationQueries {

    public record Extras(Instant acknowledgedAt, int affectedUsers, String infoRequest, Instant infoRequestedAt) {}

    /** {@code skill} is the technician team that handles the category, stored like technician skills. */
    public record CategoryRow(String code, String label, boolean active, String skill) {}

    public record NotificationRow(long id, String incidentId, String channel, String type, String message,
                                  Instant createdAt, boolean read) {}

    public record AuditRow(long id, String incidentId, Instant at, Long actorId, String actorName, String action,
                           String fromStatus, String toStatus, String description) {}

    public record OutboxRow(long id, String recipientEmail, String incidentId, String type, String message, Instant createdAt) {}

    public String nextIncidentId() {
        return query("SELECT nextval('incident_number_seq')", ps -> {}, rs -> { rs.next(); return "INC-" + rs.getLong(1); });
    }

    public Map<String, Extras> extras() {
        return query("SELECT incident_id, acknowledged_at, affected_users, info_request, info_requested_at FROM incidents", ps -> {}, rs -> {
            Map<String, Extras> map = new HashMap<>();
            while (rs.next()) map.put(rs.getString(1), new Extras(instant(rs.getTimestamp(2)), rs.getInt(3), rs.getString(4), instant(rs.getTimestamp(5))));
            return map;
        });
    }

    public Map<String, Instant> resolvedAt() {
        return query("SELECT incident_id, resolved_at FROM resolutions", ps -> {}, rs -> {
            Map<String, Instant> map = new HashMap<>();
            while (rs.next()) map.put(rs.getString(1), instant(rs.getTimestamp(2)));
            return map;
        });
    }

    public void setAffectedUsers(String incidentId, int affectedUsers) {
        update("UPDATE incidents SET affected_users = ? WHERE incident_id = ?", ps -> { ps.setInt(1, affectedUsers); ps.setString(2, incidentId); });
    }

    public void setAcknowledgedAt(String incidentId, Instant at) {
        update("UPDATE incidents SET acknowledged_at = ? WHERE incident_id = ?", ps -> { ps.setTimestamp(1, Timestamp.valueOf(Mapping.local(at))); ps.setString(2, incidentId); });
    }

    public void setInfoRequest(String incidentId, String question, Instant at) {
        update("UPDATE incidents SET info_request = ?, info_requested_at = ? WHERE incident_id = ?", ps -> {
            ps.setString(1, question); ps.setTimestamp(2, Timestamp.valueOf(Mapping.local(at))); ps.setString(3, incidentId);
        });
    }

    public void clearInfoRequest(String incidentId) {
        update("UPDATE incidents SET info_request = NULL, info_requested_at = NULL WHERE incident_id = ?", ps -> ps.setString(1, incidentId));
    }

    /** Deactivated accounts: they cannot sign in and are never assigned new work. */
    public java.util.Set<Long> inactiveUserIds() {
        return query("SELECT user_id FROM users WHERE active = FALSE", ps -> {}, rs -> {
            java.util.Set<Long> ids = new java.util.HashSet<>();
            while (rs.next()) ids.add(rs.getLong(1));
            return ids;
        });
    }

    public List<CategoryRow> categories() {
        return query("SELECT code, label, active, skill FROM categories ORDER BY label", ps -> {}, rs -> {
            List<CategoryRow> list = new ArrayList<>();
            while (rs.next()) list.add(new CategoryRow(rs.getString(1), rs.getString(2), rs.getBoolean(3), rs.getString(4)));
            return list;
        });
    }

    public boolean updateCategory(String code, String label, Boolean active, String skill) {
        return update("UPDATE categories SET label = COALESCE(?, label), active = COALESCE(?, active), skill = COALESCE(?, skill) WHERE code = ?", ps -> {
            ps.setString(1, label); ps.setObject(2, active, java.sql.Types.BOOLEAN); ps.setString(3, skill); ps.setString(4, code);
        }) > 0;
    }

    /** Adds a category; false if the code is already taken. */
    public boolean createCategory(String code, String label, String skill) {
        return update("INSERT INTO categories (code, label, active, skill) VALUES (?, ?, TRUE, ?) ON CONFLICT (code) DO NOTHING", ps -> {
            ps.setString(1, code); ps.setString(2, label); ps.setString(3, skill);
        }) > 0;
    }

    /** Services a Tatkal booking depends on. */
    public java.util.Set<Long> tatkalServiceIds() {
        return query("SELECT service_id FROM it_services WHERE tatkal_path", ps -> {}, rs -> {
            java.util.Set<Long> ids = new java.util.HashSet<>();
            while (rs.next()) ids.add(rs.getLong(1));
            return ids;
        });
    }

    public void setTatkalPath(long serviceId, boolean onPath) {
        update("UPDATE it_services SET tatkal_path = ? WHERE service_id = ?", ps -> { ps.setBoolean(1, onPath); ps.setLong(2, serviceId); });
    }

    public String setting(String key, String fallback) {
        return query("SELECT setting_value FROM settings WHERE setting_key = ?", ps -> ps.setString(1, key),
            rs -> rs.next() ? rs.getString(1) : fallback);
    }

    public void setSetting(String key, String value) {
        update("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value",
            ps -> { ps.setString(1, key); ps.setString(2, value); });
    }

    public boolean updateService(long serviceId, String name, String category, String criticality) {
        return update("UPDATE it_services SET service_name = ?, category = ?, business_criticality = ? WHERE service_id = ?", ps -> {
            ps.setString(1, name); ps.setString(2, category); ps.setString(3, criticality); ps.setLong(4, serviceId);
        }) > 0;
    }

    public void setSlaViolated(String incidentId) {
        update("UPDATE incidents SET sla_violated = TRUE WHERE incident_id = ?", ps -> ps.setString(1, incidentId));
    }

    public void addNotification(long userId, String incidentId, String channel, String type, String message) {
        update("INSERT INTO notifications (user_id, incident_id, channel, event_type, message) VALUES (?, ?, ?, ?, ?)", ps -> {
            ps.setLong(1, userId); ps.setString(2, incidentId); ps.setString(3, channel); ps.setString(4, type); ps.setString(5, message);
        });
    }

    public List<NotificationRow> notifications(long userId, int limit) {
        return query("SELECT notification_id, incident_id, channel, event_type, message, created_at, read_at FROM notifications "
                + "WHERE user_id = ? AND channel = 'IN_APP' ORDER BY created_at DESC, notification_id DESC LIMIT ?",
            ps -> { ps.setLong(1, userId); ps.setInt(2, limit); },
            rs -> {
                List<NotificationRow> list = new ArrayList<>();
                while (rs.next()) list.add(new NotificationRow(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getString(5), instant(rs.getTimestamp(6)), rs.getTimestamp(7) != null));
                return list;
            });
    }

    public boolean markRead(long notificationId, long userId) {
        return update("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE notification_id = ? AND user_id = ? AND read_at IS NULL",
            ps -> { ps.setLong(1, notificationId); ps.setLong(2, userId); }) > 0;
    }

    public void markAllRead(long userId) {
        update("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL", ps -> ps.setLong(1, userId));
    }

    /** True if this event was already announced for the incident (the SLA monitor uses it to warn once). */
    public boolean hasEvent(String incidentId, String type) {
        return query("SELECT 1 FROM notifications WHERE incident_id = ? AND event_type = ? LIMIT 1",
            ps -> { ps.setString(1, incidentId); ps.setString(2, type); }, ResultSet::next);
    }

    public List<OutboxRow> emailOutbox(int limit) {
        return query("SELECT n.notification_id, u.email, n.incident_id, n.event_type, n.message, n.created_at FROM notifications n "
                + "JOIN users u ON u.user_id = n.user_id WHERE n.channel = 'EMAIL' ORDER BY n.created_at DESC, n.notification_id DESC LIMIT ?",
            ps -> ps.setInt(1, limit),
            rs -> {
                List<OutboxRow> list = new ArrayList<>();
                while (rs.next()) list.add(new OutboxRow(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getString(5), instant(rs.getTimestamp(6))));
                return list;
            });
    }

    /** Audit entries across all incidents; every filter is optional. Text search covers the description and incident title. */
    public List<AuditRow> searchAudit(String text, String action, String incidentId, Long userId, Instant from, Instant to, int limit) {
        String sql = "SELECT a.log_id, a.incident_id, a.created_at, a.performed_by, u.full_name, a.action, a.previous_state, a.new_state, a.description "
                + "FROM audit_logs a LEFT JOIN users u ON u.user_id = a.performed_by LEFT JOIN incidents i ON i.incident_id = a.incident_id "
                + "WHERE (CAST(? AS TEXT) IS NULL OR a.description ILIKE '%' || CAST(? AS TEXT) || '%' OR i.title ILIKE '%' || CAST(? AS TEXT) || '%') "
                + "AND (CAST(? AS TEXT) IS NULL OR a.action = CAST(? AS TEXT)) "
                + "AND (CAST(? AS TEXT) IS NULL OR a.incident_id = CAST(? AS TEXT)) "
                + "AND (CAST(? AS BIGINT) IS NULL OR a.performed_by = CAST(? AS BIGINT)) "
                + "AND (CAST(? AS TIMESTAMP) IS NULL OR a.created_at >= CAST(? AS TIMESTAMP)) "
                + "AND (CAST(? AS TIMESTAMP) IS NULL OR a.created_at < CAST(? AS TIMESTAMP)) "
                + "ORDER BY a.created_at DESC, a.log_id DESC LIMIT ?";
        Timestamp fromTs = from == null ? null : Timestamp.valueOf(Mapping.local(from));
        Timestamp toTs = to == null ? null : Timestamp.valueOf(Mapping.local(to));
        return query(sql, ps -> {
            int i = 1;
            for (int k = 0; k < 3; k++) ps.setString(i++, text == null ? null : text.replace("%", "\\%").replace("_", "\\_"));
            ps.setString(i++, action); ps.setString(i++, action);
            ps.setString(i++, incidentId); ps.setString(i++, incidentId);
            ps.setObject(i++, userId, java.sql.Types.BIGINT); ps.setObject(i++, userId, java.sql.Types.BIGINT);
            ps.setTimestamp(i++, fromTs); ps.setTimestamp(i++, fromTs);
            ps.setTimestamp(i++, toTs); ps.setTimestamp(i++, toTs);
            ps.setInt(i, limit);
        }, rs -> {
            List<AuditRow> list = new ArrayList<>();
            while (rs.next()) list.add(new AuditRow(rs.getLong(1), rs.getString(2), instant(rs.getTimestamp(3)),
                    rs.getObject(4) == null ? null : rs.getLong(4), rs.getString(5), rs.getString(6), rs.getString(7), rs.getString(8), rs.getString(9)));
            return list;
        });
    }

    // ---- small JDBC helpers ----

    private interface Binder { void bind(PreparedStatement ps) throws SQLException; }

    private interface Reader<T> { T read(ResultSet rs) throws SQLException; }

    private <T> T query(String sql, Binder binder, Reader<T> reader) {
        try (Connection c = DatabaseConnection.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            binder.bind(ps);
            try (ResultSet rs = ps.executeQuery()) { return reader.read(rs); }
        } catch (SQLException e) {
            throw new DatabaseException("Query failed: " + sql.split(" ")[0], e);
        }
    }

    private int update(String sql, Binder binder) {
        try (Connection c = DatabaseConnection.getConnection(); PreparedStatement ps = c.prepareStatement(sql)) {
            binder.bind(ps);
            return ps.executeUpdate();
        } catch (SQLException e) {
            throw new DatabaseException("Update failed: " + sql.split(" ")[0], e);
        }
    }

    private static Instant instant(Timestamp ts) { return ts == null ? null : Mapping.instant(ts.toLocalDateTime()); }
}
