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

    public record Extras(Instant acknowledgedAt, int affectedUsers) {}

    public record NotificationRow(long id, String incidentId, String channel, String type, String message,
                                  Instant createdAt, boolean read) {}

    public record OutboxRow(long id, String recipientEmail, String incidentId, String type, String message, Instant createdAt) {}

    public String nextIncidentId() {
        return query("SELECT nextval('incident_number_seq')", ps -> {}, rs -> { rs.next(); return "INC-" + rs.getLong(1); });
    }

    public Map<String, Extras> extras() {
        return query("SELECT incident_id, acknowledged_at, affected_users FROM incidents", ps -> {}, rs -> {
            Map<String, Extras> map = new HashMap<>();
            while (rs.next()) map.put(rs.getString(1), new Extras(instant(rs.getTimestamp(2)), rs.getInt(3)));
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
