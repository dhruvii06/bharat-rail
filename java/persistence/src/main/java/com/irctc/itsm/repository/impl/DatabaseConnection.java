package com.irctc.itsm.repository.impl;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.function.Supplier;

/**
 * Opens connections from the ITSM_DB_* settings. Inside {@link #inTransaction} every repository call on
 * the same thread shares one connection, so a use case that touches several tables (create an incident,
 * write its history, store its notifications) commits or rolls back as a single unit of work.
 */
public class DatabaseConnection {
    private static final ThreadLocal<Unit> CURRENT = new ThreadLocal<>();

    private static final class Unit {
        final Connection real;
        boolean rollbackOnly;
        Unit(Connection real) { this.real = real; }
    }

    public static Connection getConnection() throws SQLException {
        Unit unit = CURRENT.get();
        return unit == null ? open() : shared(unit);
    }

    private static Connection open() throws SQLException {
        String password = System.getenv("ITSM_DB_PASSWORD");
        if (password == null || password.isBlank()) throw new SQLException("Set ITSM_DB_PASSWORD before connecting.");
        return DriverManager.getConnection(
            System.getenv().getOrDefault("ITSM_DB_URL", "jdbc:postgresql://localhost:5432/irctc_itsm"),
            System.getenv().getOrDefault("ITSM_DB_USER", "itsm_user"), password);
    }

    /**
     * Runs the work in one database transaction. Repositories keep their own try-with-resources and
     * commit/rollback calls; while a unit of work is open those calls are deferred to it, and a rollback
     * requested by any of them makes the whole unit roll back. Nested calls join the outer unit.
     */
    public static <T> T inTransaction(Supplier<T> work) {
        if (CURRENT.get() != null) return work.get();
        Unit unit;
        try {
            unit = new Unit(open());
            unit.real.setAutoCommit(false);
        } catch (SQLException e) {
            throw new DatabaseException("Could not start a transaction", e);
        }
        CURRENT.set(unit);
        try {
            T result = work.get();
            if (unit.rollbackOnly) {
                unit.real.rollback();
                throw new DatabaseException("The change was rolled back because one of its steps failed", null);
            }
            unit.real.commit();
            return result;
        } catch (SQLException e) {
            quietRollback(unit);
            throw new DatabaseException("Transaction failed", e);
        } catch (RuntimeException | Error e) {
            quietRollback(unit);
            throw e;
        } finally {
            CURRENT.remove();
            try { unit.real.close(); } catch (SQLException ignored) { }
        }
    }

    private static void quietRollback(Unit unit) {
        try { unit.real.rollback(); } catch (SQLException ignored) { }
    }

    /** The unit's connection, with close/commit/rollback/auto-commit left to the unit of work. */
    private static Connection shared(Unit unit) {
        return (Connection) Proxy.newProxyInstance(Connection.class.getClassLoader(), new Class<?>[] { Connection.class },
            (proxy, method, args) -> {
                switch (method.getName()) {
                    case "close", "commit", "setAutoCommit": return null;
                    case "rollback":
                        if (args == null || args.length == 0) { unit.rollbackOnly = true; return null; }
                        break;
                    case "isClosed": return false;
                    case "getAutoCommit": return false;
                    default: break;
                }
                try {
                    return method.invoke(unit.real, args);
                } catch (InvocationTargetException e) {
                    throw e.getCause();
                }
            });
    }
}
