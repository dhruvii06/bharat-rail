DROP TABLE IF EXISTS resolutions, audit_logs, incidents, sla_policies, it_services, technician_details, users CASCADE;

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('EMPLOYEE', 'TECHNICIAN', 'ADMIN')) NOT NULL,
    department VARCHAR(50)
);

CREATE TABLE technician_details (
    technician_id INT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    skill_category VARCHAR(50) NOT NULL,
    current_workload INT DEFAULT 0,
    experience_years INT DEFAULT 1,
    is_available BOOLEAN DEFAULT TRUE
);

CREATE TABLE it_services (
    service_id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    business_criticality VARCHAR(20) CHECK (business_criticality IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')) NOT NULL
);

CREATE TABLE sla_policies (
    sla_id SERIAL PRIMARY KEY,
    priority VARCHAR(5) CHECK (priority IN ('P1', 'P2', 'P3', 'P4')) UNIQUE NOT NULL,
    response_target_mins INT NOT NULL,
    resolution_target_mins INT NOT NULL
);

CREATE TABLE incidents (
    incident_id VARCHAR(25) PRIMARY KEY,
    reporter_id INT REFERENCES users(user_id),
    service_id INT REFERENCES it_services(service_id),
    category VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    impact VARCHAR(20) CHECK (impact IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    urgency VARCHAR(20) CHECK (urgency IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    priority VARCHAR(5) CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
    tatkal_window BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) CHECK (status IN ('NEW', 'CLASSIFIED', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'CLOSED')) DEFAULT 'NEW',
    assigned_technician_id INT REFERENCES users(user_id),
    sla_id INT REFERENCES sla_policies(sla_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sla_response_deadline TIMESTAMP,
    sla_resolution_deadline TIMESTAMP,
    sla_violated BOOLEAN DEFAULT FALSE
);

CREATE TABLE audit_logs (
    log_id SERIAL PRIMARY KEY,
    incident_id VARCHAR(25) REFERENCES incidents(incident_id) ON DELETE CASCADE,
    performed_by INT REFERENCES users(user_id),
    action VARCHAR(100) NOT NULL,
    previous_state VARCHAR(50),
    new_state VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE resolutions (
    resolution_id SERIAL PRIMARY KEY,
    incident_id VARCHAR(25) UNIQUE REFERENCES incidents(incident_id) ON DELETE CASCADE,
    technician_id INT REFERENCES users(user_id),
    root_cause TEXT NOT NULL,
    resolution_summary TEXT NOT NULL,
    resolved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_feedback INT CHECK (user_feedback BETWEEN 1 AND 5)
);

CREATE INDEX idx_incidents_status_priority ON incidents(status, priority);
CREATE INDEX idx_audit_incident_id ON audit_logs(incident_id);