package com.irctc.itsm.repository.impl;

import com.irctc.itsm.model.ITService;
import com.irctc.itsm.model.Priority;
import com.irctc.itsm.model.SLAPolicy;
import com.irctc.itsm.model.SeverityLevel;
import com.irctc.itsm.repository.ServiceAndSlaRepository;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class PostgresServiceAndSlaRepository implements ServiceAndSlaRepository {

    @Override
    public ITService saveService(ITService service) {
        String sql = "INSERT INTO it_services (service_name, category, business_criticality) VALUES (?, ?, ?)";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, service.getServiceName());
            ps.setString(2, service.getCategory());
            ps.setString(3, service.getBusinessCriticality().name());
            ps.executeUpdate();
            ResultSet keys = ps.getGeneratedKeys();
            if (keys.next()) service.setServiceId(keys.getLong(1));
            return service;
        } catch (SQLException e) {
            throw new DatabaseException("Failed to save IT service", e);
        }
    }

    @Override
    public Optional<ITService> findServiceById(Long serviceId) {
        String sql = "SELECT * FROM it_services WHERE service_id = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, serviceId);
            ResultSet rs = ps.executeQuery();
            return rs.next() ? Optional.of(mapService(rs)) : Optional.empty();
        } catch (SQLException e) {
            throw new DatabaseException("Failed to fetch IT service", e);
        }
    }

    @Override
    public List<ITService> findAllServices() {
        List<ITService> list = new ArrayList<>();
        String sql = "SELECT * FROM it_services ORDER BY service_id ASC";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ResultSet rs = ps.executeQuery();
            while (rs.next()) list.add(mapService(rs));
            return list;
        } catch (SQLException e) {
            throw new DatabaseException("Failed to list IT services", e);
        }
    }

    @Override
    public SLAPolicy saveOrUpdateSlaPolicy(SLAPolicy policy) {
        String sql = """
            INSERT INTO sla_policies (priority, response_target_mins, resolution_target_mins)
            VALUES (?, ?, ?)
            ON CONFLICT (priority) DO UPDATE SET
            response_target_mins = EXCLUDED.response_target_mins,
            resolution_target_mins = EXCLUDED.resolution_target_mins
            """;
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, policy.getPriority().name());
            ps.setInt(2, policy.getResponseTargetMins());
            ps.setInt(3, policy.getResolutionTargetMins());
            ps.executeUpdate();
            ResultSet keys = ps.getGeneratedKeys();
            if (keys.next()) policy.setSlaId(keys.getLong(1));
            return policy;
        } catch (SQLException e) {
            throw new DatabaseException("Failed to save SLA policy", e);
        }
    }

    @Override
    public Optional<SLAPolicy> findSlaByPriority(Priority priority) {
        String sql = "SELECT * FROM sla_policies WHERE priority = ?";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, priority.name());
            ResultSet rs = ps.executeQuery();
            return rs.next() ? Optional.of(mapSla(rs)) : Optional.empty();
        } catch (SQLException e) {
            throw new DatabaseException("Failed to find SLA policy for: " + priority, e);
        }
    }

    @Override
    public List<SLAPolicy> findAllSlaPolicies() {
        List<SLAPolicy> list = new ArrayList<>();
        String sql = "SELECT * FROM sla_policies ORDER BY sla_id ASC";
        try (Connection conn = DatabaseConnection.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ResultSet rs = ps.executeQuery();
            while (rs.next()) list.add(mapSla(rs));
            return list;
        } catch (SQLException e) {
            throw new DatabaseException("Failed to fetch SLA policies", e);
        }
    }

    private ITService mapService(ResultSet rs) throws SQLException {
        ITService s = new ITService();
        s.setServiceId(((Number) rs.getObject("service_id")).longValue());
        s.setServiceName(rs.getString("service_name"));
        s.setCategory(rs.getString("category"));
        s.setBusinessCriticality(SeverityLevel.valueOf(rs.getString("business_criticality")));
        return s;
    }

    private SLAPolicy mapSla(ResultSet rs) throws SQLException {
        SLAPolicy p = new SLAPolicy();
        p.setSlaId(((Number) rs.getObject("sla_id")).longValue());
        p.setPriority(Priority.valueOf(rs.getString("priority")));
        p.setResponseTargetMins(rs.getInt("response_target_mins"));
        p.setResolutionTargetMins(rs.getInt("resolution_target_mins"));
        return p;
    }
}