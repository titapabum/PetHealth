-- Reference labels only; no fake users, predictions, or model versions.
BEGIN;
INSERT INTO disease_classes (code, name_th, name_en, is_healthy) VALUES
    ('bacterial_dermatosis', 'โรคผิวหนังติดเชื้อแบคทีเรีย', 'Bacterial Dermatosis', false),
    ('demodicosis', 'โรคเรื้อนเปียก', 'Demodicosis', false),
    ('dermatitis', 'โรคผิวหนังอักเสบ', 'Dermatitis', false),
    ('fungal_infection', 'โรคผิวหนังติดเชื้อรา', 'Fungal Infection', false),
    ('healthy', 'ผิวหนังปกติ', 'Healthy', true),
    ('hypersensitivity', 'โรคผิวหนังจากภาวะภูมิไวเกิน', 'Hypersensitivity', false)
ON CONFLICT (code) DO NOTHING;
COMMIT;
