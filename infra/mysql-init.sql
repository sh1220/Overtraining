CREATE DATABASE IF NOT EXISTS overtraining DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE overtraining;

CREATE TABLE users (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    age           INT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE fitbit_tokens (
    user_id        BIGINT PRIMARY KEY,
    access_token   TEXT NOT NULL,
    refresh_token  TEXT NOT NULL,
    fitbit_user_id VARCHAR(50) NOT NULL,
    scope          VARCHAR(255),
    expires_at     DATETIME NOT NULL,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE oauth_states (
    state      VARCHAR(64) PRIMARY KEY,
    user_id    BIGINT NOT NULL,
    code_verifier VARCHAR(128) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE workout_sessions (
    id             BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id        BIGINT NOT NULL,
    started_at     DATETIME NOT NULL,
    ended_at       DATETIME NULL,
    status         ENUM('active','ended','aborted') NOT NULL DEFAULT 'active',
    max_risk_score INT DEFAULT 0,
    final_verdict  ENUM('OK','CAUTION','STOP') NULL,
    INDEX idx_user_started (user_id, started_at DESC),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE alerts (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    session_id  BIGINT NOT NULL,
    ts          DATETIME DEFAULT CURRENT_TIMESTAMP,
    level       ENUM('INFO','WARNING','CRITICAL') NOT NULL,
    risk_score  INT NOT NULL,
    message     VARCHAR(255) NOT NULL,
    INDEX idx_session_ts (session_id, ts),
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id)
) ENGINE=InnoDB;

CREATE TABLE daily_fitbit_snapshot (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id     BIGINT NOT NULL,
    date        DATE NOT NULL,
    sleep_score INT NULL,
    resting_hr  INT NULL,
    hrv_ms      INT NULL,
    fetched_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_date (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE edge_devices (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    device_id    VARCHAR(50) UNIQUE NOT NULL,
    api_key_hash VARCHAR(255) NOT NULL,
    user_id      BIGINT NULL,
    last_seen    DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
