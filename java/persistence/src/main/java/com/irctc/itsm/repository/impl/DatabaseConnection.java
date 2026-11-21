package com.irctc.itsm.repository.impl;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
public class DatabaseConnection {
    public static Connection getConnection() throws SQLException {
        String password = System.getenv("ITSM_DB_PASSWORD");
        if (password == null || password.isBlank()) throw new SQLException("Set ITSM_DB_PASSWORD before connecting.");
        return DriverManager.getConnection(
            System.getenv().getOrDefault("ITSM_DB_URL", "jdbc:postgresql://localhost:5432/irctc_itsm"),
            System.getenv().getOrDefault("ITSM_DB_USER", "itsm_user"), password);
    }
}
