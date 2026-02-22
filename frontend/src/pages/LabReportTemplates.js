import React, { useState, useEffect, useCallback } from 'react';
import { labReportTemplateAPI } from '../services/api';
import { toast } from 'react-toastify';

const CATEGORIES = ['Blood', 'Urine', 'Stool', 'Imaging', 'Pathology', 'Microbiology', 'Biochemistry', 'Serology', 'Other'];
const FIELD_TYPES = ['number', 'text', 'select'];

const BLANK_FIELD = { key: '', label: '', unit: '', normalRange: '', normalMin: '', normalMax: '', type: 'number', options: '' };
const BLANK_TPL = { name: '', category: '', description: '', fields: [] };

// Auto-generate key from label: "Haemoglobin (HGB)" → "haemoglobin_hgb"
const labelToKey = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Pre-built common templates the admin can load as a starting point
const STARTER_TEMPLATES = [
  {
    name: 'Complete Blood Count (CBC)',
    category: 'Blood',
    description: 'Full blood count with differential',
    fields: [
      { key: 'haemoglobin', label: 'Haemoglobin', unit: 'g/dL', normalRange: '12-16', normalMin: 12, normalMax: 16, type: 'number', options: '' },
      { key: 'rbc', label: 'RBC', unit: 'x10⁶/µL', normalRange: '4.5-5.5', normalMin: 4.5, normalMax: 5.5, type: 'number', options: '' },
      { key: 'wbc', label: 'WBC', unit: 'x10³/µL', normalRange: '4.5-11.0', normalMin: 4.5, normalMax: 11.0, type: 'number', options: '' },
      { key: 'platelets', label: 'Platelets', unit: 'x10³/µL', normalRange: '150-400', normalMin: 150, normalMax: 400, type: 'number', options: '' },
      { key: 'hematocrit', label: 'Hematocrit (HCT)', unit: '%', normalRange: '36-46', normalMin: 36, normalMax: 46, type: 'number', options: '' },
      { key: 'mcv', label: 'MCV', unit: 'fL', normalRange: '80-100', normalMin: 80, normalMax: 100, type: 'number', options: '' },
      { key: 'mchc', label: 'MCHC', unit: 'g/dL', normalRange: '32-36', normalMin: 32, normalMax: 36, type: 'number', options: '' },
    ],
  },
  {
    name: 'Liver Function Test (LFT)',
    category: 'Biochemistry',
    description: 'Liver enzymes and bilirubin panel',
    fields: [
      { key: 'total_bilirubin', label: 'Total Bilirubin', unit: 'mg/dL', normalRange: '0.2-1.2', normalMin: 0.2, normalMax: 1.2, type: 'number', options: '' },
      { key: 'direct_bilirubin', label: 'Direct Bilirubin', unit: 'mg/dL', normalRange: '0-0.4', normalMin: 0, normalMax: 0.4, type: 'number', options: '' },
      { key: 'sgot', label: 'SGOT (AST)', unit: 'U/L', normalRange: '10-40', normalMin: 10, normalMax: 40, type: 'number', options: '' },
      { key: 'sgpt', label: 'SGPT (ALT)', unit: 'U/L', normalRange: '7-56', normalMin: 7, normalMax: 56, type: 'number', options: '' },
      { key: 'alkaline_phosphatase', label: 'Alkaline Phosphatase', unit: 'U/L', normalRange: '44-147', normalMin: 44, normalMax: 147, type: 'number', options: '' },
      { key: 'total_protein', label: 'Total Protein', unit: 'g/dL', normalRange: '6.0-8.3', normalMin: 6.0, normalMax: 8.3, type: 'number', options: '' },
      { key: 'albumin', label: 'Albumin', unit: 'g/dL', normalRange: '3.5-5.0', normalMin: 3.5, normalMax: 5.0, type: 'number', options: '' },
    ],
  },
  {
    name: 'Kidney Function Test (KFT)',
    category: 'Biochemistry',
    description: 'Renal function panel',
    fields: [
      { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', normalRange: '0.6-1.2', normalMin: 0.6, normalMax: 1.2, type: 'number', options: '' },
      { key: 'urea', label: 'Urea (BUN)', unit: 'mg/dL', normalRange: '7-20', normalMin: 7, normalMax: 20, type: 'number', options: '' },
      { key: 'uric_acid', label: 'Uric Acid', unit: 'mg/dL', normalRange: '3.5-7.2', normalMin: 3.5, normalMax: 7.2, type: 'number', options: '' },
      { key: 'sodium', label: 'Sodium (Na+)', unit: 'mEq/L', normalRange: '136-145', normalMin: 136, normalMax: 145, type: 'number', options: '' },
      { key: 'potassium', label: 'Potassium (K+)', unit: 'mEq/L', normalRange: '3.5-5.0', normalMin: 3.5, normalMax: 5.0, type: 'number', options: '' },
    ],
  },
  {
    name: 'Urine Routine & Microscopy',
    category: 'Urine',
    description: 'Urine physical, chemical and microscopy examination',
    fields: [
      { key: 'colour', label: 'Colour', unit: '', normalRange: 'Pale yellow', normalMin: '', normalMax: '', type: 'text', options: '' },
      { key: 'appearance', label: 'Appearance', unit: '', normalRange: 'Clear', normalMin: '', normalMax: '', type: 'select', options: 'Clear,Turbid,Hazy,Milky' },
      { key: 'ph', label: 'pH', unit: '', normalRange: '4.5-8.0', normalMin: 4.5, normalMax: 8.0, type: 'number', options: '' },
      { key: 'specific_gravity', label: 'Specific Gravity', unit: '', normalRange: '1.005-1.030', normalMin: 1.005, normalMax: 1.030, type: 'number', options: '' },
      { key: 'protein', label: 'Protein', unit: '', normalRange: 'Negative', normalMin: '', normalMax: '', type: 'select', options: 'Negative,Trace,1+,2+,3+' },
      { key: 'glucose', label: 'Glucose', unit: '', normalRange: 'Negative', normalMin: '', normalMax: '', type: 'select', options: 'Negative,Trace,1+,2+,3+' },
      { key: 'pus_cells', label: 'Pus Cells', unit: '/HPF', normalRange: '0-5', normalMin: 0, normalMax: 5, type: 'number', options: '' },
      { key: 'rbc_micro', label: 'RBC', unit: '/HPF', normalRange: '0-2', normalMin: 0, normalMax: 2, type: 'number', options: '' },
    ],
  },
  {
    name: 'Blood Sugar (Fasting / PP)',
    category: 'Biochemistry',
    description: 'Glucose tolerance profile',
    fields: [
      { key: 'fasting_glucose', label: 'Fasting Blood Sugar', unit: 'mg/dL', normalRange: '70-100', normalMin: 70, normalMax: 100, type: 'number', options: '' },
      { key: 'pp_glucose', label: 'Post-Prandial (2hr) Sugar', unit: 'mg/dL', normalRange: '< 140', normalMin: '', normalMax: 140, type: 'number', options: '' },
      { key: 'hba1c', label: 'HbA1c', unit: '%', normalRange: '< 5.7', normalMin: '', normalMax: 5.7, type: 'number', options: '' },
    ],
  },
  // ── Lipid Profile ──────────────────────────────────────────────────────────
  {
    name: 'Lipid Profile',
    category: 'Biochemistry',
    description: 'Cholesterol and triglyceride panel',
    fields: [
      { key: 'total_cholesterol', label: 'Total Cholesterol', unit: 'mg/dL', normalRange: '< 200', normalMin: '', normalMax: 200, type: 'number', options: '' },
      { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', normalRange: '< 150', normalMin: '', normalMax: 150, type: 'number', options: '' },
      { key: 'hdl', label: 'HDL Cholesterol', unit: 'mg/dL', normalRange: '> 40', normalMin: 40, normalMax: '', type: 'number', options: '' },
      { key: 'ldl', label: 'LDL Cholesterol', unit: 'mg/dL', normalRange: '< 100', normalMin: '', normalMax: 100, type: 'number', options: '' },
      { key: 'vldl', label: 'VLDL Cholesterol', unit: 'mg/dL', normalRange: '5-40', normalMin: 5, normalMax: 40, type: 'number', options: '' },
      { key: 'cholesterol_hdl_ratio', label: 'Total/HDL Ratio', unit: '', normalRange: '< 5.0', normalMin: '', normalMax: 5.0, type: 'number', options: '' },
    ],
  },
  // ── Thyroid Function Test ───────────────────────────────────────────────────
  {
    name: 'Thyroid Function Test (TFT)',
    category: 'Biochemistry',
    description: 'T3, T4 and TSH panel',
    fields: [
      { key: 'tsh', label: 'TSH', unit: 'mIU/L', normalRange: '0.4-4.0', normalMin: 0.4, normalMax: 4.0, type: 'number', options: '' },
      { key: 'free_t3', label: 'Free T3', unit: 'pg/mL', normalRange: '2.3-4.2', normalMin: 2.3, normalMax: 4.2, type: 'number', options: '' },
      { key: 'free_t4', label: 'Free T4', unit: 'ng/dL', normalRange: '0.8-1.8', normalMin: 0.8, normalMax: 1.8, type: 'number', options: '' },
      { key: 'total_t3', label: 'Total T3', unit: 'ng/dL', normalRange: '80-200', normalMin: 80, normalMax: 200, type: 'number', options: '' },
      { key: 'total_t4', label: 'Total T4', unit: 'µg/dL', normalRange: '5.0-12.0', normalMin: 5.0, normalMax: 12.0, type: 'number', options: '' },
    ],
  },
  // ── Cardiac Markers ────────────────────────────────────────────────────────
  {
    name: 'Cardiac Markers',
    category: 'Biochemistry',
    description: 'Troponin, CK-MB and cardiac enzyme panel',
    fields: [
      { key: 'troponin_i', label: 'Troponin I', unit: 'ng/mL', normalRange: '< 0.04', normalMin: '', normalMax: 0.04, type: 'number', options: '' },
      { key: 'ckmb', label: 'CK-MB', unit: 'U/L', normalRange: '0-25', normalMin: 0, normalMax: 25, type: 'number', options: '' },
      { key: 'ck_total', label: 'CK Total (CPK)', unit: 'U/L', normalRange: '30-200', normalMin: 30, normalMax: 200, type: 'number', options: '' },
      { key: 'ldh', label: 'LDH', unit: 'U/L', normalRange: '120-246', normalMin: 120, normalMax: 246, type: 'number', options: '' },
      { key: 'sgot_cardiac', label: 'SGOT (AST)', unit: 'U/L', normalRange: '10-40', normalMin: 10, normalMax: 40, type: 'number', options: '' },
      { key: 'bnp', label: 'BNP', unit: 'pg/mL', normalRange: '< 100', normalMin: '', normalMax: 100, type: 'number', options: '' },
    ],
  },
  // ── Coagulation Profile ────────────────────────────────────────────────────
  {
    name: 'Coagulation Profile (PT/INR)',
    category: 'Blood',
    description: 'Prothrombin time, INR and clotting profile',
    fields: [
      { key: 'pt', label: 'Prothrombin Time (PT)', unit: 'seconds', normalRange: '11-13.5', normalMin: 11, normalMax: 13.5, type: 'number', options: '' },
      { key: 'inr', label: 'INR', unit: '', normalRange: '0.8-1.2', normalMin: 0.8, normalMax: 1.2, type: 'number', options: '' },
      { key: 'aptt', label: 'APTT', unit: 'seconds', normalRange: '26-35', normalMin: 26, normalMax: 35, type: 'number', options: '' },
      { key: 'fibrinogen', label: 'Fibrinogen', unit: 'mg/dL', normalRange: '200-400', normalMin: 200, normalMax: 400, type: 'number', options: '' },
      { key: 'bleeding_time', label: 'Bleeding Time', unit: 'minutes', normalRange: '1-3', normalMin: 1, normalMax: 3, type: 'number', options: '' },
      { key: 'clotting_time', label: 'Clotting Time', unit: 'minutes', normalRange: '3-7', normalMin: 3, normalMax: 7, type: 'number', options: '' },
    ],
  },
  // ── Serum Electrolytes ─────────────────────────────────────────────────────
  {
    name: 'Serum Electrolytes',
    category: 'Biochemistry',
    description: 'Na, K, Cl and bicarbonate panel',
    fields: [
      { key: 'sodium', label: 'Sodium (Na+)', unit: 'mEq/L', normalRange: '136-145', normalMin: 136, normalMax: 145, type: 'number', options: '' },
      { key: 'potassium', label: 'Potassium (K+)', unit: 'mEq/L', normalRange: '3.5-5.0', normalMin: 3.5, normalMax: 5.0, type: 'number', options: '' },
      { key: 'chloride', label: 'Chloride (Cl-)', unit: 'mEq/L', normalRange: '98-106', normalMin: 98, normalMax: 106, type: 'number', options: '' },
      { key: 'bicarbonate', label: 'Bicarbonate (HCO3-)', unit: 'mEq/L', normalRange: '22-29', normalMin: 22, normalMax: 29, type: 'number', options: '' },
      { key: 'calcium', label: 'Serum Calcium', unit: 'mg/dL', normalRange: '8.5-10.5', normalMin: 8.5, normalMax: 10.5, type: 'number', options: '' },
      { key: 'phosphate', label: 'Serum Phosphate', unit: 'mg/dL', normalRange: '2.5-4.5', normalMin: 2.5, normalMax: 4.5, type: 'number', options: '' },
      { key: 'magnesium', label: 'Serum Magnesium', unit: 'mg/dL', normalRange: '1.7-2.2', normalMin: 1.7, normalMax: 2.2, type: 'number', options: '' },
    ],
  },
  // ── Iron Studies ───────────────────────────────────────────────────────────
  {
    name: 'Iron Studies',
    category: 'Blood',
    description: 'Serum iron, TIBC and ferritin for anaemia workup',
    fields: [
      { key: 'serum_iron', label: 'Serum Iron', unit: 'µg/dL', normalRange: '60-170', normalMin: 60, normalMax: 170, type: 'number', options: '' },
      { key: 'tibc', label: 'TIBC', unit: 'µg/dL', normalRange: '250-370', normalMin: 250, normalMax: 370, type: 'number', options: '' },
      { key: 'transferrin_saturation', label: 'Transferrin Saturation', unit: '%', normalRange: '20-50', normalMin: 20, normalMax: 50, type: 'number', options: '' },
      { key: 'ferritin', label: 'Serum Ferritin', unit: 'ng/mL', normalRange: '12-150', normalMin: 12, normalMax: 150, type: 'number', options: '' },
      { key: 'esr', label: 'ESR', unit: 'mm/hr', normalRange: '0-20', normalMin: 0, normalMax: 20, type: 'number', options: '' },
    ],
  },
  // ── ESR & CRP ──────────────────────────────────────────────────────────────
  {
    name: 'ESR & CRP (Inflammation Markers)',
    category: 'Blood',
    description: 'Erythrocyte sedimentation rate and C-reactive protein',
    fields: [
      { key: 'esr', label: 'ESR', unit: 'mm/1st hr', normalRange: '0-20', normalMin: 0, normalMax: 20, type: 'number', options: '' },
      { key: 'crp', label: 'CRP (C-Reactive Protein)', unit: 'mg/L', normalRange: '< 5.0', normalMin: '', normalMax: 5.0, type: 'number', options: '' },
      { key: 'wbc', label: 'WBC Count', unit: 'x10³/µL', normalRange: '4.5-11.0', normalMin: 4.5, normalMax: 11.0, type: 'number', options: '' },
    ],
  },
  // ── Dengue Panel ───────────────────────────────────────────────────────────
  {
    name: 'Dengue Panel',
    category: 'Serology',
    description: 'NS1 antigen, IgM/IgG antibody and platelet count',
    fields: [
      { key: 'ns1_antigen', label: 'NS1 Antigen', unit: '', normalRange: 'Negative', normalMin: '', normalMax: '', type: 'select', options: 'Negative,Positive' },
      { key: 'dengue_igm', label: 'Dengue IgM Antibody', unit: '', normalRange: 'Negative', normalMin: '', normalMax: '', type: 'select', options: 'Negative,Positive,Equivocal' },
      { key: 'dengue_igg', label: 'Dengue IgG Antibody', unit: '', normalRange: 'Negative', normalMin: '', normalMax: '', type: 'select', options: 'Negative,Positive,Equivocal' },
      { key: 'platelets', label: 'Platelet Count', unit: 'x10³/µL', normalRange: '150-400', normalMin: 150, normalMax: 400, type: 'number', options: '' },
      { key: 'haematocrit', label: 'Haematocrit (PCV)', unit: '%', normalRange: '36-46', normalMin: 36, normalMax: 46, type: 'number', options: '' },
    ],
  },
  // ── Malaria ────────────────────────────────────────────────────────────────
  {
    name: 'Malaria Rapid Test (RDT)',
    category: 'Serology',
    description: 'Malaria parasite antigen rapid detection',
    fields: [
      { key: 'p_falciparum', label: 'P. falciparum (HRP-2)', unit: '', normalRange: 'Negative', normalMin: '', normalMax: '', type: 'select', options: 'Negative,Positive' },
      { key: 'p_vivax', label: 'P. vivax', unit: '', normalRange: 'Negative', normalMin: '', normalMax: '', type: 'select', options: 'Negative,Positive' },
      { key: 'malaria_overall', label: 'Overall Result', unit: '', normalRange: 'Negative', normalMin: '', normalMax: '', type: 'select', options: 'Negative,P. falciparum Positive,P. vivax Positive,Mixed Infection' },
      { key: 'smear_result', label: 'Peripheral Smear (if done)', unit: '', normalRange: 'No parasites seen', normalMin: '', normalMax: '', type: 'text', options: '' },
    ],
  },
  // ── Widal Test (Typhoid) ───────────────────────────────────────────────────
  {
    name: 'Widal Test (Typhoid)',
    category: 'Serology',
    description: 'Antibody titres for Salmonella typhi and paratyphi',
    fields: [
      { key: 's_typhi_o', label: 'S. typhi O', unit: 'titre', normalRange: '< 1:80', normalMin: '', normalMax: '', type: 'select', options: 'Negative (<1:20),1:20,1:40,1:80,1:160,1:320,1:640' },
      { key: 's_typhi_h', label: 'S. typhi H', unit: 'titre', normalRange: '< 1:80', normalMin: '', normalMax: '', type: 'select', options: 'Negative (<1:20),1:20,1:40,1:80,1:160,1:320,1:640' },
      { key: 's_paratyphi_ao', label: 'S. paratyphi AO', unit: 'titre', normalRange: '< 1:80', normalMin: '', normalMax: '', type: 'select', options: 'Negative (<1:20),1:20,1:40,1:80,1:160,1:320,1:640' },
      { key: 's_paratyphi_bh', label: 'S. paratyphi BH', unit: 'titre', normalRange: '< 1:80', normalMin: '', normalMax: '', type: 'select', options: 'Negative (<1:20),1:20,1:40,1:80,1:160,1:320,1:640' },
      { key: 'interpretation', label: 'Interpretation', unit: '', normalRange: 'Negative', normalMin: '', normalMax: '', type: 'select', options: 'Negative,Suspicious (repeat after 5-7 days),Positive — Typhoid likely' },
    ],
  },
  // ── Stool Routine & Microscopy ─────────────────────────────────────────────
  {
    name: 'Stool Routine & Microscopy',
    category: 'Stool',
    description: 'Physical, chemical and microscopic stool examination',
    fields: [
      { key: 'consistency', label: 'Consistency', unit: '', normalRange: 'Formed', normalMin: '', normalMax: '', type: 'select', options: 'Formed,Semi-formed,Loose,Watery,Mucoid' },
      { key: 'colour', label: 'Colour', unit: '', normalRange: 'Brown', normalMin: '', normalMax: '', type: 'text', options: '' },
      { key: 'blood', label: 'Blood', unit: '', normalRange: 'Absent', normalMin: '', normalMax: '', type: 'select', options: 'Absent,Present (occult),Present (frank)' },
      { key: 'mucus', label: 'Mucus', unit: '', normalRange: 'Absent', normalMin: '', normalMax: '', type: 'select', options: 'Absent,Present' },
      { key: 'pus_cells', label: 'Pus Cells', unit: '/HPF', normalRange: '0-5', normalMin: 0, normalMax: 5, type: 'number', options: '' },
      { key: 'rbc', label: 'RBC', unit: '/HPF', normalRange: 'Nil', normalMin: 0, normalMax: 0, type: 'number', options: '' },
      { key: 'ova_cysts', label: 'Ova / Cysts / Parasites', unit: '', normalRange: 'Absent', normalMin: '', normalMax: '', type: 'select', options: 'Absent,Present — specify in notes' },
      { key: 'bacteria', label: 'Bacteria', unit: '', normalRange: 'Normal flora', normalMin: '', normalMax: '', type: 'text', options: '' },
    ],
  },
  // ── Vitamin D & B12 ────────────────────────────────────────────────────────
  {
    name: 'Vitamin D & B12',
    category: 'Biochemistry',
    description: '25-OH Vitamin D, Vitamin B12 and Folate levels',
    fields: [
      { key: 'vitamin_d', label: '25-OH Vitamin D', unit: 'ng/mL', normalRange: '30-100', normalMin: 30, normalMax: 100, type: 'number', options: '' },
      { key: 'vitamin_b12', label: 'Vitamin B12', unit: 'pg/mL', normalRange: '211-911', normalMin: 211, normalMax: 911, type: 'number', options: '' },
      { key: 'folate', label: 'Serum Folate', unit: 'ng/mL', normalRange: '2.7-17.0', normalMin: 2.7, normalMax: 17.0, type: 'number', options: '' },
    ],
  },
  // ── Blood Group ────────────────────────────────────────────────────────────
  {
    name: 'Blood Group & Rh Typing',
    category: 'Blood',
    description: 'ABO blood group and Rh factor determination',
    fields: [
      { key: 'blood_group', label: 'Blood Group (ABO)', unit: '', normalRange: '—', normalMin: '', normalMax: '', type: 'select', options: 'A,B,AB,O' },
      { key: 'rh_factor', label: 'Rh Factor', unit: '', normalRange: '—', normalMin: '', normalMax: '', type: 'select', options: 'Positive,Negative' },
      { key: 'blood_group_full', label: 'Final Blood Group', unit: '', normalRange: '—', normalMin: '', normalMax: '', type: 'text', options: '' },
    ],
  },
  // ── Semen Analysis ─────────────────────────────────────────────────────────
  {
    name: 'Semen Analysis',
    category: 'Other',
    description: 'WHO 2010 criteria semen analysis for fertility workup',
    fields: [
      { key: 'volume', label: 'Volume', unit: 'mL', normalRange: '≥ 1.5', normalMin: 1.5, normalMax: '', type: 'number', options: '' },
      { key: 'ph', label: 'pH', unit: '', normalRange: '7.2-8.0', normalMin: 7.2, normalMax: 8.0, type: 'number', options: '' },
      { key: 'concentration', label: 'Sperm Concentration', unit: 'million/mL', normalRange: '≥ 15', normalMin: 15, normalMax: '', type: 'number', options: '' },
      { key: 'total_count', label: 'Total Sperm Count', unit: 'million', normalRange: '≥ 39', normalMin: 39, normalMax: '', type: 'number', options: '' },
      { key: 'total_motility', label: 'Total Motility (PR+NP)', unit: '%', normalRange: '≥ 40', normalMin: 40, normalMax: 100, type: 'number', options: '' },
      { key: 'progressive_motility', label: 'Progressive Motility (PR)', unit: '%', normalRange: '≥ 32', normalMin: 32, normalMax: 100, type: 'number', options: '' },
      { key: 'morphology', label: 'Normal Morphology (Kruger)', unit: '%', normalRange: '≥ 4', normalMin: 4, normalMax: 100, type: 'number', options: '' },
      { key: 'vitality', label: 'Vitality (Live sperm)', unit: '%', normalRange: '≥ 58', normalMin: 58, normalMax: 100, type: 'number', options: '' },
    ],
  },
];

export default function LabReportTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // template being edited
  const [form, setForm] = useState(BLANK_TPL);
  const [fieldDraft, setFieldDraft] = useState(BLANK_FIELD);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await labReportTemplateAPI.getAll({ search: search || undefined, category: catFilter || undefined });
      setTemplates(res.data || []);
    } catch { toast.error('Failed to load templates'); }
    finally { setLoading(false); }
  }, [search, catFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK_TPL);
    setFieldDraft(BLANK_FIELD);
    setModalOpen(true);
  };

  const openEdit = (tpl) => {
    setEditing(tpl);
    setForm({ name: tpl.name, category: tpl.category || '', description: tpl.description || '', fields: tpl.fields || [] });
    setFieldDraft(BLANK_FIELD);
    setModalOpen(true);
  };

  const loadStarter = (starter) => {
    setForm(f => ({ ...f, name: starter.name, category: starter.category, description: starter.description, fields: starter.fields }));
  };

  const addField = () => {
    if (!fieldDraft.label.trim()) return toast.error('Field label is required');
    const key = fieldDraft.key.trim() || labelToKey(fieldDraft.label);
    if (form.fields.find(f => f.key === key)) return toast.error('A field with this key already exists');
    const newField = {
      ...fieldDraft,
      key,
      normalMin: fieldDraft.normalMin !== '' ? Number(fieldDraft.normalMin) : '',
      normalMax: fieldDraft.normalMax !== '' ? Number(fieldDraft.normalMax) : '',
    };
    setForm(f => ({ ...f, fields: [...f.fields, newField] }));
    setFieldDraft(BLANK_FIELD);
  };

  const removeField = (key) => setForm(f => ({ ...f, fields: f.fields.filter(ff => ff.key !== key) }));

  const moveField = (key, dir) => {
    setForm(f => {
      const idx = f.fields.findIndex(ff => ff.key === key);
      if (idx < 0) return f;
      const next = [...f.fields];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return f;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return { ...f, fields: next };
    });
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Template name is required');
    if (!form.fields.length) return toast.error('Add at least one field');
    setSaving(true);
    try {
      if (editing) {
        await labReportTemplateAPI.update(editing.id, form);
        toast.success('Template updated');
      } else {
        await labReportTemplateAPI.create(form);
        toast.success('Template created');
      }
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const del = async (tpl) => {
    if (!window.confirm(`Delete template "${tpl.name}"?`)) return;
    try {
      await labReportTemplateAPI.delete(tpl.id);
      toast.success('Template deleted');
      load();
    } catch { toast.error('Delete failed'); }
  };

  const grouped = templates.reduce((acc, t) => {
    const cat = t.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>Lab Report Templates</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            Define structured templates so lab technicians fill values instead of free text
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          + New Template
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder="Search templates..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 13, width: 220 }}
        />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 12px', fontSize: 13 }}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Template list grouped by category */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>Loading templates...</div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: '#f8fafc', borderRadius: 12, border: '2px dashed #e2e8f0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧪</div>
          <div style={{ fontWeight: 600, color: '#475569', marginBottom: 6 }}>No templates yet</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>Create templates like CBC, LFT, Urine Routine so lab techs can fill structured values</div>
          <button onClick={openCreate} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            Create First Template
          </button>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>{cat}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {list.map(tpl => (
                <div key={tpl.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 15 }}>{tpl.name}</div>
                      {tpl.description && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{tpl.description}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openEdit(tpl)}
                        style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#2563eb', fontWeight: 600 }}>
                        Edit
                      </button>
                      <button onClick={() => del(tpl)}
                        style={{ background: '#fff1f2', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#dc2626', fontWeight: 600 }}>
                        Delete
                      </button>
                    </div>
                  </div>
                  {/* Fields preview */}
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {(tpl.fields || []).slice(0, 5).map(f => (
                      <span key={f.key} style={{ display: 'inline-block', background: '#f1f5f9', borderRadius: 4, padding: '2px 7px', marginRight: 4, marginBottom: 4 }}>
                        {f.label}{f.unit ? ` (${f.unit})` : ''}
                      </span>
                    ))}
                    {(tpl.fields || []).length > 5 && (
                      <span style={{ color: '#94a3b8' }}>+{tpl.fields.length - 5} more</span>
                    )}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: '#94a3b8' }}>{(tpl.fields || []).length} fields</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '32px 16px', overflowY: 'auto' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 760, boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
            {/* Modal header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
                {editing ? `Edit: ${editing.name}` : 'New Lab Report Template'}
              </h2>
              <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <form onSubmit={save} style={{ padding: 24 }}>
              {/* Starter templates (only when creating) */}
              {!editing && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Quick Start — Load a Preset</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {STARTER_TEMPLATES.map(s => (
                      <button key={s.name} type="button" onClick={() => loadStarter(s)}
                        style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: '#1d4ed8', fontWeight: 500 }}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Basic info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Template Name *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Complete Blood Count"
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 14, background: '#fff', boxSizing: 'border-box' }}>
                    <option value="">-- Select --</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short description of this test panel"
                  style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              {/* Existing fields table */}
              {form.fields.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Fields ({form.fields.length})
                  </div>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Label', 'Unit', 'Normal Range', 'Type', 'Actions'].map(h => (
                            <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {form.fields.map((f, idx) => (
                          <tr key={f.key} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 500, color: '#1e293b' }}>{f.label}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{f.unit || '—'}</td>
                            <td style={{ padding: '8px 12px', color: '#64748b' }}>{f.normalRange || '—'}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ background: f.type === 'number' ? '#dbeafe' : f.type === 'select' ? '#fef3c7' : '#f0fdf4', color: f.type === 'number' ? '#1d4ed8' : f.type === 'select' ? '#92400e' : '#15803d', borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600 }}>
                                {f.type}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button type="button" onClick={() => moveField(f.key, -1)} disabled={idx === 0}
                                  style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 4, width: 24, height: 24, cursor: 'pointer', fontSize: 11, color: '#64748b' }}>↑</button>
                                <button type="button" onClick={() => moveField(f.key, 1)} disabled={idx === form.fields.length - 1}
                                  style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 4, width: 24, height: 24, cursor: 'pointer', fontSize: 11, color: '#64748b' }}>↓</button>
                                <button type="button" onClick={() => removeField(f.key)}
                                  style={{ background: '#fff1f2', border: 'none', borderRadius: 4, width: 24, height: 24, cursor: 'pointer', fontSize: 13, color: '#dc2626' }}>×</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Add new field */}
              <div style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1', borderRadius: 10, padding: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>+ Add Field</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3 }}>Label *</label>
                    <input value={fieldDraft.label} onChange={e => setFieldDraft(f => ({ ...f, label: e.target.value, key: labelToKey(e.target.value) }))}
                      placeholder="e.g. Haemoglobin"
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3 }}>Unit</label>
                    <input value={fieldDraft.unit} onChange={e => setFieldDraft(f => ({ ...f, unit: e.target.value }))}
                      placeholder="g/dL"
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3 }}>Normal Range</label>
                    <input value={fieldDraft.normalRange} onChange={e => setFieldDraft(f => ({ ...f, normalRange: e.target.value }))}
                      placeholder="12-16"
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3 }}>Type</label>
                    <select value={fieldDraft.type} onChange={e => setFieldDraft(f => ({ ...f, type: e.target.value }))}
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, background: '#fff', boxSizing: 'border-box' }}>
                      {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3 }}>Min (for auto flag)</label>
                    <input type="number" step="any" value={fieldDraft.normalMin} onChange={e => setFieldDraft(f => ({ ...f, normalMin: e.target.value }))}
                      placeholder="e.g. 12"
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3 }}>Max (for auto flag)</label>
                    <input type="number" step="any" value={fieldDraft.normalMax} onChange={e => setFieldDraft(f => ({ ...f, normalMax: e.target.value }))}
                      placeholder="e.g. 16"
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  {fieldDraft.type === 'select' && (
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3 }}>Options (comma separated)</label>
                      <input value={fieldDraft.options} onChange={e => setFieldDraft(f => ({ ...f, options: e.target.value }))}
                        placeholder="Positive,Negative,Trace"
                        style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  )}
                </div>
                <button type="button" onClick={addField}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Add Field
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setModalOpen(false)}
                  style={{ border: '1px solid #d1d5db', background: '#fff', borderRadius: 8, padding: '9px 20px', fontSize: 14, cursor: 'pointer', color: '#374151' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 24px', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving...' : editing ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
