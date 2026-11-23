CREATE DATABASE IF NOT EXISTS bpjs_kesehatan
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE bpjs_kesehatan;

CREATE TABLE IF NOT EXISTS health_facilities (
  facility_id INT NOT NULL AUTO_INCREMENT,
  facility_name VARCHAR(150) NOT NULL,
  facility_type VARCHAR(50) NOT NULL,
  address TEXT NOT NULL,
  phone_number VARCHAR(20) DEFAULT NULL,
  status ENUM('Aktif', 'Tidak Aktif', 'Perlu Verifikasi') NOT NULL DEFAULT 'Perlu Verifikasi',
  location POINT NOT NULL SRID 4326,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (facility_id),
  KEY idx_facilities_name (facility_name),
  KEY idx_facilities_type_status (facility_type, status),
  SPATIAL KEY idx_location (location)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS facility_services (
  service_id INT NOT NULL AUTO_INCREMENT,
  facility_id INT NOT NULL,
  service_name VARCHAR(120) NOT NULL,
  description TEXT DEFAULT NULL,
  PRIMARY KEY (service_id),
  KEY idx_services_facility (facility_id),
  KEY idx_services_name (service_name),
  CONSTRAINT fk_services_facility FOREIGN KEY (facility_id)
    REFERENCES health_facilities (facility_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS users (
  user_id INT NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'masyarakat') NOT NULL DEFAULT 'masyarakat',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
