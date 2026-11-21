-- Integration migration: run after schema.sql and seed.sql on a new database.
-- Adds what the connected web app needs on top of the original schema. Safe to re-run.

-- SLA response tracking and the number of affected passengers.
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS affected_users INT NOT NULL DEFAULT 0 CHECK (affected_users >= 0);

-- Readable incident numbers continue after the seeded INC-1001 and INC-1002.
CREATE SEQUENCE IF NOT EXISTS incident_number_seq START 1003;

-- Notifications for both channels: IN_APP (shown in the web app) and EMAIL (simulated outbox).
CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    incident_id VARCHAR(25) REFERENCES incidents(incident_id) ON DELETE CASCADE,
    channel VARCHAR(10) NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL')),
    event_type VARCHAR(40) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

-- More demo staff so every incident category has a technician. Passwords are set by the
-- Node API in development (see backend/db/demoPasswords.ts); 'unset' cannot be used to log in.
INSERT INTO users (full_name, email, password_hash, role, department) VALUES
('Station Operations', 'ops@demo.local', 'unset', 'EMPLOYEE', 'Station Operations'),
('Application Support', 'app.tech@demo.local', 'unset', 'TECHNICIAN', 'Application Support'),
('Network Support', 'network.tech@demo.local', 'unset', 'TECHNICIAN', 'Network Operations'),
('Security Operations', 'security.tech@demo.local', 'unset', 'TECHNICIAN', 'Security Operations')
ON CONFLICT (email) DO NOTHING;

INSERT INTO technician_details (technician_id, skill_category, current_workload, experience_years, is_available)
SELECT user_id, skill, 0, years, TRUE FROM (VALUES
    ('app.tech@demo.local', 'APPLICATION', 4),
    ('network.tech@demo.local', 'NETWORK', 5),
    ('security.tech@demo.local', 'SECURITY', 7)
) AS t(email, skill, years) JOIN users USING (email)
ON CONFLICT (technician_id) DO NOTHING;

-- Workload must match the incidents actually assigned (the seed had INC-1002 assigned to a technician with workload 0).
UPDATE technician_details td SET current_workload = (
    SELECT count(*) FROM incidents i
    WHERE i.assigned_technician_id = td.technician_id AND i.status IN ('ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS')
);

-- ---- Admin settings and the technician "request information" step ----

-- Accounts can be deactivated by the IT manager instead of deleted (history keeps its references).
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

-- An open question from the technician to the reporter, cleared when the reporter answers.
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS info_request TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS info_requested_at TIMESTAMP;

-- Categories the IT manager can rename or switch off. Codes match the domain's IncidentCategory
-- (which maps each category to the technician skill that handles it).
CREATE TABLE IF NOT EXISTS categories (
    code VARCHAR(30) PRIMARY KEY,
    label VARCHAR(60) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO categories (code, label) VALUES
('APPLICATION', 'Application'), ('PAYMENT', 'Payment'), ('DATABASE', 'Database'), ('NETWORK', 'Network'),
('SECURITY', 'Security'), ('AUTHENTICATION', 'Authentication'), ('API_INTEGRATION', 'API integration'),
('INFRASTRUCTURE', 'Infrastructure')
ON CONFLICT (code) DO NOTHING;

-- System settings, such as the default assignment strategy.
CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value VARCHAR(200) NOT NULL
);
INSERT INTO settings (setting_key, setting_value) VALUES ('default_assignment_strategy', 'skill')
ON CONFLICT (setting_key) DO NOTHING;
