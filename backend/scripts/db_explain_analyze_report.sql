-- ==============================================================================
-- PostgreSQL EXPLAIN ANALYZE Performance Audit Script
-- Verifies zero sequential scans and optimal composite index hits under enterprise load
-- ==============================================================================

-- 1. Appointment Doctor Schedule Lookup
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, patient_id, doctor_id, appointment_date, status
FROM "Appointments"
WHERE doctor_id = 10 AND appointment_date >= CURRENT_DATE
ORDER BY appointment_date ASC
LIMIT 50;

-- 2. IPD Bed Occupancy Active Search
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, patient_id, room_number, bed_number, admission_date, status
FROM "IPDAdmissions"
WHERE hospital_id = 1 AND status = 'ADMITTED';

-- 3. Prescription CDSS Lookup
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, drug_name, patient_group, max_daily_dose_mg
FROM "DoseRangeRules"
WHERE drug_name = 'Paracetamol' AND patient_group = 'Adult';

-- 4. Global Full Text & Trigram Search
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT entity_type, entity_id, uhid, title, subtitle
FROM global_search_index
WHERE hospital_id = 1 AND (content ILIKE '%Ramesh%' OR SIMILARITY(content, 'Ramesh') > 0.15)
LIMIT 20;

-- 5. Audit Log Partition Scan Scoping
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id, user_id, action, entity, created_at
FROM audit_logs
WHERE hospital_id = 1 AND created_at >= '2026-09-01'::TIMESTAMPTZ
ORDER BY created_at DESC
LIMIT 100;
