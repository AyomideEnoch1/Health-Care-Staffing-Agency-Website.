-- ============================================================================
-- Least-Privilege Database Role Configuration
-- Divine Fingers Healthcare Services Inc.
-- Execute once as MySQL root user on provisioning
-- ============================================================================

-- 1. Create Least-Privilege Application User
-- The application only requires standard DML operations (CRUD).
-- DDL operations (ALTER, DROP, CREATE) and dangerous administrative privileges 
-- (FILE, SUPER, GRANT OPTION) are strictly withheld.

CREATE USER IF NOT EXISTS 'df_app_user'@'127.0.0.1' 
  IDENTIFIED WITH caching_sha2_password BY '<REPLACE_WITH_STRONG_RANDOM_PASSWORD_64_CHARS>';

-- Optional: Require TLS if accessing over an internal private network (non-loopback)
-- ALTER USER 'df_app_user'@'127.0.0.1' REQUIRE SSL;

-- 2. Grant Strict DML-Only Privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON `divine_fingers_prod`.* TO 'df_app_user'@'127.0.0.1';

-- Explicit verification: User CANNOT DROP tables, CANNOT ALTER schema, CANNOT load local files.
REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'df_app_user'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE ON `divine_fingers_prod`.* TO 'df_app_user'@'127.0.0.1';

-- 3. Dedicated Migration / Schema User (Used ONLY during deployment / CI migrations)
CREATE USER IF NOT EXISTS 'df_migration_user'@'127.0.0.1'
  IDENTIFIED WITH caching_sha2_password BY '<REPLACE_WITH_SEPARATE_MIGRATION_PASSWORD>';

GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES ON `divine_fingers_prod`.* TO 'df_migration_user'@'127.0.0.1';

FLUSH PRIVILEGES;

-- Verification Queries:
-- SHOW GRANTS FOR 'df_app_user'@'127.0.0.1';
-- SHOW GRANTS FOR 'df_migration_user'@'127.0.0.1';
