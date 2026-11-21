package com.irctc.itsm.repository.impl;

import com.irctc.itsm.model.Role;
import com.irctc.itsm.model.TechnicianDetail;
import com.irctc.itsm.model.User;
import com.irctc.itsm.repository.UserRepository;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class PostgresUserRepository implements UserRepository {

    @Override
    public User saveUser(User user) {
        String sql = "INSERT INTO users (full_name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, user.getFullName());
            ps.setString(2, user.getEmail());
            ps.setString(3, user.getPasswordHash());
            ps.setString(4, user.getRole().name());
            ps.setString(5, user.getDepartment());
            ps.executeUpdate();
            ResultSet keys = ps.getGeneratedKeys();
            if (keys.next()) user.setUserId(keys.getLong(1));
            return user;
        } catch (SQLException e) {
            throw new DatabaseException("Failed to save user: " + user.getEmail(), e);
        }
    }

    @Override
    public Optional<User> findById(Long userId) {
        String sql = "SELECT * FROM users WHERE user_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, userId);
            ResultSet rs = ps.executeQuery();
            return rs.next() ? Optional.of(mapUser(rs)) : Optional.empty();
        } catch (SQLException e) {
            throw new DatabaseException("Failed to find user by ID: " + userId, e);
        }
    }

    @Override
    public Optional<User> findByEmail(String email) {
        String sql = "SELECT * FROM users WHERE email = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, email);
            ResultSet rs = ps.executeQuery();
            return rs.next() ? Optional.of(mapUser(rs)) : Optional.empty();
        } catch (SQLException e) {
            throw new DatabaseException("Failed to find user by email: " + email, e);
        }
    }

    @Override
    public List<User> findByRole(Role role) {
        List<User> list = new ArrayList<>();
        String sql = "SELECT * FROM users WHERE role = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, role.name());
            ResultSet rs = ps.executeQuery();
            while (rs.next()) list.add(mapUser(rs));
            return list;
        } catch (SQLException e) {
            throw new DatabaseException("Failed to fetch users by role: " + role, e);
        }
    }

    @Override
    public TechnicianDetail saveTechnicianDetail(TechnicianDetail detail) {
        String sql = """
            INSERT INTO technician_details (technician_id, skill_category, current_workload, experience_years, is_available)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (technician_id) DO UPDATE SET
            skill_category = EXCLUDED.skill_category, current_workload = EXCLUDED.current_workload,
            experience_years = EXCLUDED.experience_years, is_available = EXCLUDED.is_available
            """;
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, detail.getTechnicianId());
            ps.setString(2, detail.getSkillCategory());
            ps.setInt(3, detail.getCurrentWorkload());
            ps.setInt(4, detail.getExperienceYears());
            ps.setBoolean(5, detail.isAvailable());
            ps.executeUpdate();
            return detail;
        } catch (SQLException e) {
            throw new DatabaseException("Failed to save technician details", e);
        }
    }

    @Override
    public Optional<TechnicianDetail> findTechnicianDetail(Long technicianId) {
        String sql = "SELECT * FROM technician_details WHERE technician_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, technicianId);
            ResultSet rs = ps.executeQuery();
            return rs.next() ? Optional.of(mapTech(rs)) : Optional.empty();
        } catch (SQLException e) {
            throw new DatabaseException("Failed to fetch technician details", e);
        }
    }

    @Override
    public List<TechnicianDetail> findAvailableTechniciansBySkill(String skillCategory) {
        List<TechnicianDetail> list = new ArrayList<>();
        String sql = "SELECT * FROM technician_details WHERE is_available = TRUE AND skill_category = ? ORDER BY current_workload ASC, experience_years DESC";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, skillCategory);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) list.add(mapTech(rs));
            return list;
        } catch (SQLException e) {
            throw new DatabaseException("Failed to query technicians by skill", e);
        }
    }

    @Override
    public List<TechnicianDetail> findAllAvailableTechnicians() {
        List<TechnicianDetail> list = new ArrayList<>();
        String sql = "SELECT * FROM technician_details WHERE is_available = TRUE ORDER BY current_workload ASC";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ResultSet rs = ps.executeQuery();
            while (rs.next()) list.add(mapTech(rs));
            return list;
        } catch (SQLException e) {
            throw new DatabaseException("Failed to fetch available technicians", e);
        }
    }

    private User mapUser(ResultSet rs) throws SQLException {
        User u = new User();
        u.setUserId(((Number) rs.getObject("user_id")).longValue());
        u.setFullName(rs.getString("full_name"));
        u.setEmail(rs.getString("email"));
        u.setPasswordHash(rs.getString("password_hash"));
        u.setRole(Role.valueOf(rs.getString("role")));
        u.setDepartment(rs.getString("department"));
        return u;
    }

    private TechnicianDetail mapTech(ResultSet rs) throws SQLException {
        TechnicianDetail td = new TechnicianDetail();
        td.setTechnicianId(((Number) rs.getObject("technician_id")).longValue());
        td.setSkillCategory(rs.getString("skill_category"));
        td.setCurrentWorkload(rs.getInt("current_workload"));
        td.setExperienceYears(rs.getInt("experience_years"));
        td.setAvailable(rs.getBoolean("is_available"));
        return td;
    }
}