package com.railway.itsm.service;

import com.irctc.itsm.model.AuditLog;
import com.irctc.itsm.repository.impl.DatabaseConnection;
import com.irctc.itsm.repository.impl.PostgresAuditLogRepository;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Checks the unit of work against a real database (needs ITSM_DB_* like the service; run by npm run test:e2e).
 * A command that fails part-way must leave nothing behind; a successful one must commit everything.
 */
public final class TransactionCheck {
    private static int passed;

    public static void main(String[] args) throws Exception {
        PostgresAuditLogRepository audit = new PostgresAuditLogRepository();
        String marker = "tx-check-" + System.nanoTime();

        try {
            DatabaseConnection.inTransaction(() -> {
                audit.save(new AuditLog("INC-1001", null, "TX_CHECK", null, null, marker + "-a"));
                audit.save(new AuditLog("INC-1001", null, "TX_CHECK", null, null, marker + "-b"));
                throw new IllegalStateException("simulated failure after two writes");
            });
        } catch (IllegalStateException expected) { }
        check(count(marker + "%") == 0, "a failure part-way rolls back every write of the command");

        try {
            DatabaseConnection.inTransaction(() -> {
                audit.save(new AuditLog("INC-1001", null, "TX_CHECK", null, null, marker + "-c"));
                return audit.save(new AuditLog("NO-SUCH-INCIDENT", null, "TX_CHECK", null, null, marker + "-d"));   // foreign key fails
            });
        } catch (RuntimeException expected) { }
        check(count(marker + "%") == 0, "a database error in a later step also rolls back the earlier step");

        DatabaseConnection.inTransaction(() -> {
            audit.save(new AuditLog("INC-1001", null, "TX_CHECK", null, null, marker + "-e"));
            return DatabaseConnection.inTransaction(() -> audit.save(new AuditLog("INC-1001", null, "TX_CHECK", null, null, marker + "-f")));
        });
        check(count(marker + "%") == 2, "a successful command commits all its writes, including a nested unit of work");

        audit.save(new AuditLog("INC-1001", null, "TX_CHECK", null, null, marker + "-g"));
        check(count(marker + "-g") == 1, "outside a unit of work each repository call still commits on its own");

        try (Connection c = plain(); PreparedStatement ps = c.prepareStatement("DELETE FROM audit_logs WHERE action = 'TX_CHECK'")) { ps.executeUpdate(); }
        System.out.println("\ntransactions: " + passed + " passed, 0 failed");
    }

    private static void check(boolean ok, String name) {
        if (!ok) { System.out.println("FAIL  " + name); System.out.println("\ntransactions: " + passed + " passed, 1 failed"); System.exit(1); }
        passed++;
        System.out.println("PASS  " + name);
    }

    private static int count(String pattern) throws SQLException {
        try (Connection c = plain(); PreparedStatement ps = c.prepareStatement("SELECT count(*) FROM audit_logs WHERE description LIKE ?")) {
            ps.setString(1, pattern);
            try (ResultSet rs = ps.executeQuery()) { rs.next(); return rs.getInt(1); }
        }
    }

    /** A connection outside any unit of work, to see only committed data. */
    private static Connection plain() throws SQLException {
        return DriverManager.getConnection(System.getenv().getOrDefault("ITSM_DB_URL", "jdbc:postgresql://localhost:5432/irctc_itsm"),
                System.getenv().getOrDefault("ITSM_DB_USER", "itsm_user"), System.getenv("ITSM_DB_PASSWORD"));
    }
}
