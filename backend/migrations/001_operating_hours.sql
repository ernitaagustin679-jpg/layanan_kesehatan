USE bpjs_kesehatan;

CREATE TABLE IF NOT EXISTS facility_operating_hours (
  operating_hour_id INT NOT NULL AUTO_INCREMENT,
  facility_id INT NOT NULL,
  day_of_week TINYINT NOT NULL COMMENT 'ISO weekday: Monday=1, Sunday=7',
  slot_number TINYINT NOT NULL DEFAULT 1,
  opens_at TIME DEFAULT NULL,
  closes_at TIME DEFAULT NULL,
  is_closed TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (operating_hour_id),
  UNIQUE KEY uq_facility_weekday_slot (facility_id, day_of_week, slot_number),
  CONSTRAINT fk_hours_facility FOREIGN KEY (facility_id)
    REFERENCES health_facilities (facility_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_hours_day CHECK (day_of_week BETWEEN 1 AND 7),
  CONSTRAINT chk_hours_slot CHECK (slot_number BETWEEN 1 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS facility_operating_exceptions (
  exception_id INT NOT NULL AUTO_INCREMENT,
  facility_id INT NOT NULL,
  exception_date DATE NOT NULL,
  slot_number TINYINT NOT NULL DEFAULT 1,
  opens_at TIME DEFAULT NULL,
  closes_at TIME DEFAULT NULL,
  is_closed TINYINT(1) NOT NULL DEFAULT 0,
  note VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (exception_id),
  UNIQUE KEY uq_facility_exception_slot (facility_id, exception_date, slot_number),
  KEY idx_exception_date (exception_date),
  CONSTRAINT fk_exceptions_facility FOREIGN KEY (facility_id)
    REFERENCES health_facilities (facility_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_exception_slot CHECK (slot_number BETWEEN 1 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
