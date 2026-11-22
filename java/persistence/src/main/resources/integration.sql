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

-- Each category is handled by one technician team (skill). New categories added by the IT manager
-- choose their team; the eight standard categories are handled by the team of the same name.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS skill VARCHAR(30);
UPDATE categories SET skill = code WHERE skill IS NULL;
ALTER TABLE categories ALTER COLUMN skill SET NOT NULL;

-- Services a Tatkal booking depends on. Only incidents on these services get the Tatkal-window P1 override.
ALTER TABLE it_services ADD COLUMN IF NOT EXISTS tatkal_path BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE it_services SET tatkal_path = TRUE
WHERE service_name IN ('TATKAL_BOOKING_ENGINE', 'UPI_PAYMENT_GATEWAY', 'NGET_CORE_DATABASE') AND tatkal_path = FALSE;

-- System settings, such as the default assignment strategy.
CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value VARCHAR(200) NOT NULL
);
INSERT INTO settings (setting_key, setting_value) VALUES ('default_assignment_strategy', 'skill')
ON CONFLICT (setting_key) DO NOTHING;

-- ---- Customer accounts and first-login password change ----

-- Members of the public register as CUSTOMER; EMPLOYEE, TECHNICIAN and ADMIN accounts are created by the IT manager.
-- (Databases set up before the rename used PASSENGER; those rows become CUSTOMER.)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'CUSTOMER' WHERE role = 'PASSENGER';
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('EMPLOYEE', 'TECHNICIAN', 'ADMIN', 'CUSTOMER'));

-- Accounts created by the IT manager start with a temporary password that must be changed at first sign-in.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users SET email = 'customer@demo.local', full_name = 'Demo Customer', department = 'Customer'
WHERE email = 'passenger@demo.local' AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'customer@demo.local');
INSERT INTO users (full_name, email, password_hash, role, department) VALUES
('Demo Customer', 'customer@demo.local', 'unset', 'CUSTOMER', 'Customer')
ON CONFLICT (email) DO NOTHING;
