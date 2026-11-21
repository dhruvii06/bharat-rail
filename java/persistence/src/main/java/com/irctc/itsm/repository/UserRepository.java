package com.irctc.itsm.repository;

import com.irctc.itsm.model.Role;
import com.irctc.itsm.model.TechnicianDetail;
import com.irctc.itsm.model.User;
import java.util.List;
import java.util.Optional;

public interface UserRepository {
    User saveUser(User user);
    Optional<User> findById(Long userId);
    Optional<User> findByEmail(String email);
    List<User> findByRole(Role role);
    TechnicianDetail saveTechnicianDetail(TechnicianDetail detail);
    Optional<TechnicianDetail> findTechnicianDetail(Long technicianId);
    List<TechnicianDetail> findAvailableTechniciansBySkill(String skillCategory);
    List<TechnicianDetail> findAllAvailableTechnicians();
}