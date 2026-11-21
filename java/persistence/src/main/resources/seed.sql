INSERT INTO sla_policies (priority, response_target_mins, resolution_target_mins) VALUES
('P1', 5, 30),
('P2', 15, 120),
('P3', 60, 480),
('P4', 240, 1440);

INSERT INTO it_services (service_name, category, business_criticality) VALUES
('TATKAL_BOOKING_ENGINE', 'APPLICATION', 'CRITICAL'),
('UPI_PAYMENT_GATEWAY', 'PAYMENT', 'CRITICAL'),
('NGET_CORE_DATABASE', 'DATABASE', 'CRITICAL'),
('PNR_ENQUIRY_API', 'NETWORK', 'HIGH'),
('E_CATERING_PORTAL', 'APPLICATION', 'MEDIUM');

INSERT INTO users (full_name, email, password_hash, role, department) VALUES
('Rajesh Sharma', 'rajesh.admin@irctc.co.in', 'hash_admin123', 'ADMIN', 'IT Operations'),
('Ananya Verma', 'ananya.tech@irctc.co.in', 'hash_tech123', 'TECHNICIAN', 'Payment Systems'),
('Vikram Singh', 'vikram.tech@irctc.co.in', 'hash_tech123', 'TECHNICIAN', 'Database Admin'),
('Priya Nair', 'priya.emp@irctc.co.in', 'hash_emp123', 'EMPLOYEE', 'Customer Support');

INSERT INTO technician_details (technician_id, skill_category, current_workload, experience_years, is_available) VALUES
(2, 'PAYMENT', 1, 6, TRUE),
(3, 'DATABASE', 0, 8, TRUE);

INSERT INTO incidents (incident_id, reporter_id, service_id, category, title, description, impact, urgency, priority, tatkal_window, status, assigned_technician_id, sla_id, sla_response_deadline, sla_resolution_deadline) VALUES
('INC-1001', 4, 2, 'PAYMENT', 'UPI Payment Gateway Timeout during Tatkal', 'Users debited via UPI without PNR generation during 10:00 AM AC Tatkal window.', 'CRITICAL', 'CRITICAL', 'P1', TRUE, 'IN_PROGRESS', 2, 1, NOW() + INTERVAL '5 minutes', NOW() + INTERVAL '30 minutes'),
('INC-1002', 4, 4, 'NETWORK', 'PNR Status Delay', 'PNR status API taking >10s to refresh.', 'MEDIUM', 'HIGH', 'P2', FALSE, 'ASSIGNED', 3, 2, NOW() + INTERVAL '15 minutes', NOW() + INTERVAL '2 hours');

INSERT INTO audit_logs (incident_id, performed_by, action, previous_state, new_state, description) VALUES
('INC-1001', 4, 'INCIDENT_CREATED', NULL, 'NEW', 'Reported UPI failure during Tatkal window'),
('INC-1001', 1, 'PRIORITY_ASSIGNED', 'NEW', 'CLASSIFIED', 'Auto-escalated to P1 due to Tatkal window + Payment impact'),
('INC-1001', 1, 'TECHNICIAN_ASSIGNED', 'CLASSIFIED', 'ASSIGNED', 'Assigned to Payment Specialist Ananya Verma');