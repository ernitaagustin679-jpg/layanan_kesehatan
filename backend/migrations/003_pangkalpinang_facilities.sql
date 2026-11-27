USE bpjs_kesehatan;

-- Addresses and coordinates are from the matching public Google Maps listings.
-- Listings are marked for verification because current services and hours have not been confirmed.
-- RSUD: https://www.google.com/maps/search/?api=1&query=RSUD+Depati+Hamzah+Pangkalpinang
INSERT INTO health_facilities
  (facility_name, facility_type, address, status, location)
SELECT 'RSUD Depati Hamzah', 'Rumah Sakit',
  'Jl. Soekarno Hatta, Bukitbesar, Kec. Girimaya, Kota Pangkal Pinang, Kepulauan Bangka Belitung 33684',
  'Perlu Verifikasi', ST_SRID(POINT(106.1246522, -2.1438264), 4326)
WHERE NOT EXISTS (
  SELECT 1 FROM health_facilities WHERE facility_name = 'RSUD Depati Hamzah'
);

-- Mitra Medika: https://www.google.com/maps/search/?api=1&query=RSU+Mitra+Medika+Pangkalpinang
INSERT INTO health_facilities
  (facility_name, facility_type, address, status, location)
SELECT 'RSU Mitra Medika Pangkalpinang', 'Rumah Sakit',
  'Jl. Basuki Rahmat No. 888, Bukitintan, Kec. Girimaya, Kota Pangkal Pinang, Kepulauan Bangka Belitung 33141',
  'Perlu Verifikasi', ST_SRID(POINT(106.1161162, -2.1389975), 4326)
WHERE NOT EXISTS (
  SELECT 1 FROM health_facilities WHERE facility_name = 'RSU Mitra Medika Pangkalpinang'
);

-- Primaya: https://primayahospital.com/rumah-sakit/bhakti-wara/
INSERT INTO health_facilities
  (facility_name, facility_type, address, status, location)
SELECT 'Primaya Hospital Bhakti Wara', 'Rumah Sakit',
  'Jl. Solihin GP No. 180, Kelurahan Gajah Mada, Kec. Rangkui, Kota Pangkal Pinang, Kepulauan Bangka Belitung 33139',
  'Perlu Verifikasi', ST_SRID(POINT(106.0981352, -2.1439169), 4326)
WHERE NOT EXISTS (
  SELECT 1 FROM health_facilities WHERE facility_name = 'Primaya Hospital Bhakti Wara'
);
