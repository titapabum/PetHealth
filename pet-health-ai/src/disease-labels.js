const diseaseLabels = {
  bacterial_dermatosis: "โรคผิวหนังจากการติดเชื้อแบคทีเรีย",
  demodicosis: "โรคขี้เรื้อนเปียก (ไรขุมขน)",
  dermatitis: "ผิวหนังอักเสบ",
  fungal_infection: "โรคผิวหนังจากเชื้อรา",
  healthy: "ผิวหนังปกติ",
  hypersensitivity: "ภาวะภูมิไวเกิน (อาการแพ้)",
  skin_infection: "การติดเชื้อที่ผิวหนัง",
  ear_infection: "การติดเชื้อในหู",
  eye_irritation: "การระคายเคืองตา",
};

export function diseaseName(label) {
  const key = String(label ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  return diseaseLabels[key] || label;
}
