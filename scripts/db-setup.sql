-- One-time Neon setup. Run as the project owner in the Neon SQL editor on branch `main`,
-- BEFORE running any service migrations. Then create branch `dev` from `main`.
-- Replace every <generated-…> with a long random password (at least 16 characters).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS resume;
CREATE SCHEMA IF NOT EXISTS interview;
CREATE SCHEMA IF NOT EXISTS report;

CREATE ROLE auth_svc      LOGIN PASSWORD '<generated-auth-password>';
CREATE ROLE resume_svc    LOGIN PASSWORD '<generated-resume-password>';
CREATE ROLE interview_svc LOGIN PASSWORD '<generated-interview-password>';
CREATE ROLE report_svc    LOGIN PASSWORD '<generated-report-password>';

-- auth
GRANT USAGE ON SCHEMA auth TO auth_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO auth_svc;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO auth_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO auth_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT USAGE, SELECT ON SEQUENCES TO auth_svc;
ALTER ROLE auth_svc SET search_path = auth;

-- resume (also needs public for the pgvector type and operators)
GRANT USAGE ON SCHEMA resume TO resume_svc;
GRANT USAGE ON SCHEMA public TO resume_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA resume TO resume_svc;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA resume TO resume_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA resume GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO resume_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA resume GRANT USAGE, SELECT ON SEQUENCES TO resume_svc;
ALTER ROLE resume_svc SET search_path = resume, public;

-- interview
GRANT USAGE ON SCHEMA interview TO interview_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA interview TO interview_svc;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA interview TO interview_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA interview GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO interview_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA interview GRANT USAGE, SELECT ON SEQUENCES TO interview_svc;
ALTER ROLE interview_svc SET search_path = interview;

-- report
GRANT USAGE ON SCHEMA report TO report_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA report TO report_svc;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA report TO report_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA report GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO report_svc;
ALTER DEFAULT PRIVILEGES IN SCHEMA report GRANT USAGE, SELECT ON SEQUENCES TO report_svc;
ALTER ROLE report_svc SET search_path = report;
