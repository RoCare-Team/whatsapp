-- ============================================================
-- WhatsApp SaaS Platform - Complete MySQL Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS whatsapp_saas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE whatsapp_saas;

-- ============================================================
-- 1. USERS TABLE
-- ============================================================
CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,          -- bcrypt hash
  role        ENUM('admin','agent') DEFAULT 'admin',
  is_active   TINYINT(1) DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB;

-- ============================================================
-- 2. WORKSPACES TABLE (multi-tenant)
-- ============================================================
CREATE TABLE workspaces (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  owner_id             INT NOT NULL,
  name                 VARCHAR(150) NOT NULL,
  phone_number_id      VARCHAR(100),          -- Meta WABA Phone Number ID
  waba_id              VARCHAR(100),          -- WhatsApp Business Account ID
  access_token         TEXT,                  -- Meta API Access Token (encrypted)
  verify_token         VARCHAR(100),          -- Webhook verify token
  webhook_secret       VARCHAR(100),
  plan                 ENUM('free','pro','enterprise') DEFAULT 'free',
  is_active            TINYINT(1) DEFAULT 1,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_owner (owner_id)
) ENGINE=InnoDB;

-- ============================================================
-- 3. WORKSPACE MEMBERS (agents per workspace)
-- ============================================================
CREATE TABLE workspace_members (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  workspace_id INT NOT NULL,
  user_id      INT NOT NULL,
  role         ENUM('admin','agent') DEFAULT 'agent',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_workspace_user (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)      REFERENCES users(id)      ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 4. CONTACTS (CRM Leads)
-- ============================================================
CREATE TABLE contacts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  workspace_id INT NOT NULL,
  name         VARCHAR(150),
  phone        VARCHAR(20) NOT NULL,           -- international format e.g. 919876543210
  email        VARCHAR(150),
  city         VARCHAR(100),
  source       VARCHAR(100),                   -- e.g. website, campaign, manual
  status       ENUM('new','contacted','converted','lost') DEFAULT 'new',
  tags         JSON,                           -- ["vip","hot-lead"]
  notes        TEXT,
  opted_in     TINYINT(1) DEFAULT 0,           -- WhatsApp opt-in flag
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_workspace_phone (workspace_id, phone),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  INDEX idx_phone  (phone),
  INDEX idx_status (status),
  INDEX idx_ws     (workspace_id)
) ENGINE=InnoDB;

-- ============================================================
-- 5. TEMPLATES
-- ============================================================
CREATE TABLE templates (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  workspace_id     INT NOT NULL,
  name             VARCHAR(100) NOT NULL,
  language         VARCHAR(10) DEFAULT 'en',
  category         ENUM('UTILITY','MARKETING','AUTHENTICATION') DEFAULT 'UTILITY',
  status           ENUM('PENDING','APPROVED','REJECTED','PAUSED') DEFAULT 'PENDING',
  header_type      ENUM('TEXT','IMAGE','DOCUMENT','VIDEO') DEFAULT 'TEXT',
  header_content   TEXT,
  body_text        TEXT NOT NULL,
  footer_text      VARCHAR(255),
  buttons          JSON,                       -- array of button objects
  variables        JSON,                       -- ["{{1}}","{{2}}"] placeholders
  meta_template_id VARCHAR(100),              -- ID returned by Meta after submission
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  INDEX idx_ws_template (workspace_id, status)
) ENGINE=InnoDB;

-- ============================================================
-- 6. MESSAGES
-- ============================================================
CREATE TABLE messages (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  workspace_id    INT NOT NULL,
  contact_id      INT,
  wamid           VARCHAR(200) UNIQUE,         -- WhatsApp Message ID from Meta
  replied_to_wamid VARCHAR(200) NULL,          -- wamid of the message this is a reply to
  direction       ENUM('inbound','outbound') NOT NULL,
  type            ENUM('text','image','document','audio','video','template','interactive','reaction','unknown') DEFAULT 'text',
  content         TEXT,                        -- JSON or plain text
  template_id     INT,
  campaign_id     INT,
  status          ENUM('queued','sent','delivered','read','failed') DEFAULT 'queued',
  error_message   TEXT,
  sent_at         TIMESTAMP NULL,
  delivered_at    TIMESTAMP NULL,
  read_at         TIMESTAMP NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id)   REFERENCES contacts(id)   ON DELETE SET NULL,
  FOREIGN KEY (template_id)  REFERENCES templates(id)  ON DELETE SET NULL,
  INDEX idx_ws_contact  (workspace_id, contact_id),
  INDEX idx_wamid       (wamid),
  INDEX idx_status      (status),
  INDEX idx_created     (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- 7. CAMPAIGNS
-- ============================================================
CREATE TABLE campaigns (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  workspace_id    INT NOT NULL,
  name            VARCHAR(150) NOT NULL,
  template_id     INT NOT NULL,
  campaign_type   ENUM('broadcast','api','drip','transactional') DEFAULT 'broadcast',
  status          ENUM('draft','scheduled','running','paused','completed','failed') DEFAULT 'draft',
  scheduled_at    TIMESTAMP NULL,
  started_at      TIMESTAMP NULL,
  completed_at    TIMESTAMP NULL,
  total_contacts  INT DEFAULT 0,
  sent_count      INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  read_count      INT DEFAULT 0,
  failed_count    INT DEFAULT 0,
  template_vars   JSON,                        -- variable mapping for bulk send
  created_by      INT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id)  REFERENCES templates(id)  ON DELETE RESTRICT,
  FOREIGN KEY (created_by)   REFERENCES users(id)      ON DELETE SET NULL,
  INDEX idx_ws_status (workspace_id, status)
) ENGINE=InnoDB;

-- campaign <-> contact pivot
CREATE TABLE campaign_contacts (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  campaign_id  INT NOT NULL,
  contact_id   INT NOT NULL,
  message_id   BIGINT,
  status       ENUM('pending','sent','delivered','read','failed') DEFAULT 'pending',
  error        TEXT,
  sent_at      TIMESTAMP NULL,
  UNIQUE KEY uq_camp_contact (campaign_id, contact_id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)  ON DELETE CASCADE,
  FOREIGN KEY (contact_id)  REFERENCES contacts(id)   ON DELETE CASCADE,
  FOREIGN KEY (message_id)  REFERENCES messages(id)   ON DELETE SET NULL,
  INDEX idx_campaign (campaign_id),
  INDEX idx_status   (status)
) ENGINE=InnoDB;

-- ============================================================
-- 8. CHATBOT RULES
-- ============================================================
CREATE TABLE chatbot_rules (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  workspace_id  INT NOT NULL,
  trigger_type  ENUM('keyword','contains','starts_with','exact','any') DEFAULT 'keyword',
  trigger_value VARCHAR(500),                  -- keyword or pattern
  response_type ENUM('text','template','flow') DEFAULT 'text',
  response_text TEXT,
  response_template_id INT,
  flow_data     JSON,                          -- multi-step flow definition
  priority      INT DEFAULT 0,                 -- higher = checked first
  is_active     TINYINT(1) DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id)           REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (response_template_id)   REFERENCES templates(id)  ON DELETE SET NULL,
  INDEX idx_ws_active (workspace_id, is_active, priority)
) ENGINE=InnoDB;

-- ============================================================
-- 9. WEBHOOK LOGS (for debugging)
-- ============================================================
CREATE TABLE webhook_logs (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  workspace_id INT,
  event_type   VARCHAR(100),
  payload      LONGTEXT,                       -- raw JSON from Meta
  processed    TINYINT(1) DEFAULT 0,
  error        TEXT,
  received_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ws_event  (workspace_id, event_type),
  INDEX idx_processed (processed)
) ENGINE=InnoDB;

-- ============================================================
-- 10. TAGS (reusable contact tags)
-- ============================================================
CREATE TABLE tags (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  workspace_id INT NOT NULL,
  name         VARCHAR(100) NOT NULL,
  color        VARCHAR(20) DEFAULT '#22c55e',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ws_tag (workspace_id, name),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- SAMPLE SEED DATA (optional - for testing)
-- ============================================================
-- INSERT INTO users (name, email, password, role)
-- VALUES ('Admin User', 'admin@example.com', '$2a$10$HASHED_PASSWORD', 'admin');
