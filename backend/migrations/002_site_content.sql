USE bpjs_kesehatan;

CREATE TABLE IF NOT EXISTS site_settings (
  settings_id TINYINT NOT NULL DEFAULT 1,
  website_name VARCHAR(100) NOT NULL DEFAULT 'SehatDekat',
  tagline VARCHAR(160) NOT NULL DEFAULT 'Layanan kesehatan lebih dekat',
  homepage_description VARCHAR(500) NOT NULL DEFAULT 'Temukan fasilitas kesehatan, layanan, informasi, dan artikel kesehatan di sekitar Anda.',
  whatsapp_number VARCHAR(20) NOT NULL DEFAULT '081373418699',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (settings_id),
  CONSTRAINT chk_site_settings_singleton CHECK (settings_id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO site_settings (settings_id, website_name, tagline, homepage_description, whatsapp_number)
VALUES (1, 'SehatDekat', 'Layanan kesehatan lebih dekat',
  'Temukan fasilitas kesehatan, layanan, informasi, dan artikel kesehatan di sekitar Anda.',
  '081373418699')
ON DUPLICATE KEY UPDATE settings_id = VALUES(settings_id);

CREATE TABLE IF NOT EXISTS health_contents (
  content_id INT NOT NULL AUTO_INCREMENT,
  content_type ENUM('informasi', 'artikel') NOT NULL,
  title VARCHAR(150) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (content_id),
  KEY idx_health_content_type_published (content_type, is_published, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO health_contents (content_type, title, summary, body, is_published)
SELECT 'informasi', 'Informasi layanan dapat berubah',
  'Pastikan alamat, jam operasional, dan layanan sebelum berkunjung.',
  'Gunakan peta dan direktori untuk menemukan fasilitas. Hubungi fasilitas terkait untuk memastikan alamat, jam operasional, dan ketersediaan layanan terbaru.',
  1
WHERE NOT EXISTS (
  SELECT 1 FROM health_contents WHERE content_type = 'informasi' AND title = 'Informasi layanan dapat berubah'
);

INSERT INTO health_contents (content_type, title, summary, body, is_published)
SELECT 'artikel', 'Memilih fasilitas kesehatan sesuai kebutuhan',
  'Periksa jenis layanan dan informasi resmi fasilitas sebelum berkunjung.',
  'Mulailah dengan mencari jenis layanan yang dibutuhkan. Periksa layanan yang tercantum pada profil fasilitas dan konfirmasikan langsung kepada fasilitas sebelum berangkat, karena informasi dapat berubah. Informasi di situs ini bersifat umum dan bukan pengganti konsultasi tenaga kesehatan.',
  1
WHERE NOT EXISTS (
  SELECT 1 FROM health_contents WHERE content_type = 'artikel' AND title = 'Memilih fasilitas kesehatan sesuai kebutuhan'
);
