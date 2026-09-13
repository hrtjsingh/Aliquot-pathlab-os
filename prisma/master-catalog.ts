/** Pipe-separated catalog: category|name|unit|range|charge|formula */
export const CATALOG_LINES = `
BIOCHEMISTRY|Blood Sugar Fasting (BSF)|mg/dl|70 - 110|50|
BIOCHEMISTRY|Blood Sugar Random (RBS)|mg/dl|70 - 140|50|
BIOCHEMISTRY|Blood Sugar Postmeal (PM)|mg/dl|70 - 140|50|
BIOCHEMISTRY|Glucose|mg/dl|70 - 110|0|
BIOCHEMISTRY|HBA1C|%|4.0 - 5.6|350|
BIOCHEMISTRY|Estimated Average Glucose|mg/dl||0|([HBA1C] * 28.7) - 46.7
BIOCHEMISTRY|Blood Urea|mg/dl|15 - 40|80|
BIOCHEMISTRY|Bun Urea (BUN)|mg/dl|7 - 20|100|[Blood Urea] * 0.467
BIOCHEMISTRY|Blood Urea Nitrogen|mg/dl|7 - 20|0|
BIOCHEMISTRY|BUN/Creatinine Ratio||10 - 20|0|([Blood Urea] * 0.467) / [Sr.Creatinine]
BIOCHEMISTRY|Sr.Creatinine|mg/dl|0.6 - 1.3|250|
BIOCHEMISTRY|Uric Acid|mg/dl|M: 3.5-7.2 / F: 2.6-6.0|200|
BIOCHEMISTRY|Total Cholesterol|mg/dl|< 200|200|
BIOCHEMISTRY|Sr.Triglycerides|mg/dl|< 150|80|
BIOCHEMISTRY|HDL Cholesterol|mg/dl|> 40|100|
BIOCHEMISTRY|LDL Cholesterol|mg/dl|< 100|100|[Total Cholesterol] - [HDL Cholesterol] - ([Sr.Triglycerides] / 5)
BIOCHEMISTRY|VLDL Cholesterol|mg/dl|7 - 35|100|[Sr.Triglycerides] / 5
BIOCHEMISTRY|Total Chol/HDL Ratio||< 5.0|0|[Total Cholesterol] / [HDL Cholesterol]
BIOCHEMISTRY|LDL Chol/HDL Chol Ratio||< 3.5|0|[LDL Cholesterol] / [HDL Cholesterol]
BIOCHEMISTRY|Total Protein|gm/dl|6.0 - 8.3|200|
BIOCHEMISTRY|Sr.Albumin|g/dl|3.5 - 5.5|100|
BIOCHEMISTRY|Sr.Globulin|gm/dl|2.0 - 3.5|0|[Total Protein] - [Sr.Albumin]
BIOCHEMISTRY|A/G Ratio||1.0 - 2.0|0|[Sr.Albumin] / ([Total Protein] - [Sr.Albumin])
BIOCHEMISTRY|Total Bilirubin|mg/dl|0.3 - 1.2|0|
BIOCHEMISTRY|Direct Bilirubin|mg/dl|0.0 - 0.3|0|
BIOCHEMISTRY|Indirect Bilirubin|mg/dl|0.1 - 0.9|0|[Total Bilirubin] - [Direct Bilirubin]
BIOCHEMISTRY|Sr.Bilirubin|mg/dl|0.3 - 1.2|100|
BIOCHEMISTRY|SGOT (AST)|IU/L|< 40|200|
BIOCHEMISTRY|SGPT (ALT)|IU/L|< 40|200|
BIOCHEMISTRY|Serum Alkaline PO4 (ALP)|IU/L|40 - 129|100|
BIOCHEMISTRY|Alk Phosphate|IU/L|40 - 129|200|
BIOCHEMISTRY|Amylase|U/L|25 - 125|100|
BIOCHEMISTRY|Lipase|U/L|13 - 60|500|
BIOCHEMISTRY|Acid Phosphatase|U/L|< 6.5|200|
BIOCHEMISTRY|CPK|U/L|30 - 200|400|
BIOCHEMISTRY|CK-MB|IU/L|< 25|250|
BIOCHEMISTRY|CK-NAC|U/L||200|
BIOCHEMISTRY|LDH|U/L|140 - 280|200|
BIOCHEMISTRY|Sr.Calcium / Total Calcium|mg/dl|8.5 - 10.5|200|
BIOCHEMISTRY|Ionic Calcium|mmol/L|1.10 - 1.35|100|
BIOCHEMISTRY|Sr.Phosphorus|mg/dl|2.5 - 4.5|100|
BIOCHEMISTRY|Sr.Sodium / Na+|mmol/L|135 - 145|200|
BIOCHEMISTRY|Sr.Potassium / K+|mmol/L|3.5 - 5.1|80|
BIOCHEMISTRY|Sr.Chloride / Cl-|mmol/L|98 - 107|100|
BIOCHEMISTRY|Sr.Magnesium|mg/dl|1.7 - 2.2|100|
BIOCHEMISTRY|Insulin Fasting|uU/mL|2.6 - 24.9|700|
BIOCHEMISTRY|Insulin PP|uU/mL||700|
BIOCHEMISTRY|Insulin Random|uU/mL||500|
BIOCHEMISTRY|Homocysteine|umol/L|5 - 15|150|
BIOCHEMISTRY|Ammonia|umol/L|15 - 45|300|
BIOCHEMISTRY|Lactate|mg/dl|4.5 - 19.8|200|
BIOCHEMISTRY|Anion Gap|mmol/L|8 - 16|0|
BIOCHEMISTRY|D-Dimer|ug/mL|< 0.5|1000|
BIOCHEMISTRY|Plasma Osmolality|mmol/L|275 - 295|150|
BIOCHEMISTRY|Troponin I (Qualitative)||Negative|650|
BIOCHEMISTRY|Troponin T||Negative|200|
BIOCHEMISTRY|NT-proBNP|pg/ml|< 125|1200|
BIOCHEMISTRY|Iron|ug/dl|60 - 170|80|
BIOCHEMISTRY|Total Iron Binding Capacity (TIBC)|ug/dl|250 - 450|50|
BIOCHEMISTRY|UIBC|ug/dl||0|
BIOCHEMISTRY|Transferrin Saturation|%|20 - 50|80|
BIOCHEMISTRY|Urine Microalbumin|mg/dl|< 30|80|
BIOCHEMISTRY|Urine Albumin/Creatinine Ratio|ug/mg|< 30|200|
BIOCHEMISTRY|Urine Creatinine|mg/dl||0|
BIOCHEMISTRY|Urine Protein (24 Hrs)|mg/24hrs|< 150|300|
BIOCHEMISTRY|Glucose Tolerance Test (GTT/OGTT)|mg/dl|F: 70-110|500|
BIOCHEMISTRY|pH (ABG)||7.35 - 7.45|0|
BIOCHEMISTRY|pCO2|mmHg|35 - 45|0|
BIOCHEMISTRY|pO2|mmHg|80 - 100|0|
BIOCHEMISTRY|HCO3 (Bicarbonate)|mmol/L|22 - 26|0|
BIOCHEMISTRY|BE (b)|mmol/L|-2 to +2|0|
BIOCHEMISTRY|BE (ecf)|mmol/L|-2 to +2|0|
BIOCHEMISTRY|cTCO2|mmol/L|23 - 27|0|
HAEMATOLOGY|Haemoglobin (Hb)|g/dl|M: 13-17 / F: 12-15|50|
HAEMATOLOGY|Total WBC Count (TLC)|/cumm|4000 - 11000|100|
HAEMATOLOGY|RBC Count|Millions/cumm|M: 4.5-5.5 / F: 3.8-4.8|50|
HAEMATOLOGY|Platelet Count|/cu.mm|150000 - 410000|100|
HAEMATOLOGY|Neutrophils|%|40 - 75|0|
HAEMATOLOGY|Lymphocytes|%|20 - 45|0|
HAEMATOLOGY|Monocytes|%|2 - 10|0|
HAEMATOLOGY|Eosinophils|%|1 - 6|0|
HAEMATOLOGY|Basophils|%|0 - 1|0|
HAEMATOLOGY|Absolute Neutrophils Count|/uL|2000 - 7000|100|
HAEMATOLOGY|Absolute Lymphocytes Count|/uL|1000 - 3000|100|
HAEMATOLOGY|Absolute Monocytes Count|/uL|200 - 1000|100|
HAEMATOLOGY|Absolute Eosinophils Count (AEC)|/uL|20 - 500|100|
HAEMATOLOGY|Absolute Basophils Count|/uL|0 - 100|100|
HAEMATOLOGY|MCV|fl|80 - 100|0|([HCT (PCV) / Haematocrit]*10) / [RBC Count]
HAEMATOLOGY|MCH|pg|27 - 32|0|([Haemoglobin (Hb)]*10) / [RBC Count]
HAEMATOLOGY|MCHC|g/dl|32 - 36|0|([Haemoglobin (Hb)]*100) / [HCT (PCV) / Haematocrit]
HAEMATOLOGY|HCT (PCV) / Haematocrit|%|M: 40-50 / F: 36-46|0|
HAEMATOLOGY|RDW-CV|%|11.5 - 14.5|0|
HAEMATOLOGY|RDW-SD|fl|39 - 46|0|
HAEMATOLOGY|PDW-CV|%||0|
HAEMATOLOGY|PDW-SD|fl||0|
HAEMATOLOGY|MPV|fl|7.5 - 11.5|0|
HAEMATOLOGY|P-LCC|%||0|
HAEMATOLOGY|P-LCR|%||0|
HAEMATOLOGY|ESR 1st Hr|mm/hour|M: 0-15 / F: 0-20|50|
HAEMATOLOGY|ESR 2nd Hr|mm/hour||50|
HAEMATOLOGY|Reticulocyte Count|%|0.5 - 2.5|150|
HAEMATOLOGY|Peripheral Smear Examination|||100|
HAEMATOLOGY|Bleeding Time (BT)|Minutes|2 - 7|50|
HAEMATOLOGY|Clotting Time (CT)|Minutes|4 - 9|50|
HAEMATOLOGY|Prothrombin Time (PT)|Sec|11 - 16|100|
HAEMATOLOGY|Control's Prothrombin Time|Sec||0|
HAEMATOLOGY|Patient's Prothrombin Time|Sec||0|
HAEMATOLOGY|INR||0.8 - 1.2|0|
HAEMATOLOGY|Prothrombin Index|%|70 - 100|0|
HAEMATOLOGY|APTT (PTTK)|Sec|25 - 35|100|
HAEMATOLOGY|Clot Retraction Time|||200|
HAEMATOLOGY|Blood Group & Rh Factor|||50|
HAEMATOLOGY|Rh Factor|||0|
HAEMATOLOGY|MP By Slide||Negative|100|
HAEMATOLOGY|PS for MP||Negative|100|
HAEMATOLOGY|Haemoparasite||Not Seen|0|
HAEMATOLOGY|G6PD|U/gm of Hb|6.0 - 18.0|700|
HAEMATOLOGY|Sickling Test||Negative|200|
HAEMATOLOGY|Hb Electrophoresis|||300|
HAEMATOLOGY|Hemoglobinopathy by HPLC|||800|
HAEMATOLOGY|Hemoglobin A (HbA)|%|> 95|0|
HAEMATOLOGY|Hemoglobin A2 (HbA2)|%|2.0 - 3.5|0|
HAEMATOLOGY|Foetal Haemoglobin (HbF)|%|< 2|0|
HAEMATOLOGY|Hemoglobin S (HbS)|%|0|0|
HAEMATOLOGY|Hb A0 Level|%||0|
HAEMATOLOGY|CD3+ Lymphocyte|%||0|
HAEMATOLOGY|CD4+ T Helper|%||0|
HAEMATOLOGY|CD8+ T Killer|%||0|
HAEMATOLOGY|CD4:CD8 Ratio||1.0 - 4.0|0|
HAEMATOLOGY|Mean Corpuscular Fragility|||0|
HAEMATOLOGY|Osmotic Fragility (RBC)|||400|
SEROLOGY|HIV I & II||Non-Reactive|450|
SEROLOGY|HBsAg||Non-Reactive|250|
SEROLOGY|HCV||Non-Reactive|500|
SEROLOGY|VDRL||Non-Reactive|100|
SEROLOGY|Widal Slide Test||Non-Reactive|100|
SEROLOGY|Widal Tube Test|||0|
SEROLOGY|S.Typhi O||< 1:80|0|
SEROLOGY|S.Typhi H||< 1:80|0|
SEROLOGY|S.Paratyphi A(H)||< 1:80|0|
SEROLOGY|S.Paratyphi B(H)||< 1:80|0|
SEROLOGY|Typhoid IgM||Negative|0|
SEROLOGY|Typhoid IgG||Negative|0|
SEROLOGY|Typhoid By Card||Negative|200|
SEROLOGY|CRP|mg/L|< 6|200|
SEROLOGY|CRP Qualitative||Negative|100|
SEROLOGY|C Reactive Protein (Quantitative)|mg/L|< 6|200|
SEROLOGY|ASO Qualitative||Negative|350|
SEROLOGY|ASO Quantitative|IU/ml|< 200|350|
SEROLOGY|RA Factor|IU/ml|< 20|400|
SEROLOGY|RA Factor (Qualitative)||Negative|100|
SEROLOGY|Malaria By Card Test||Negative|200|
SEROLOGY|Malaria Antigen||Negative|100|
SEROLOGY|Dengue Antigen (NS1)|OD|Negative|550|
SEROLOGY|Dengue IgM Antibody|NTU|Negative|0|
SEROLOGY|Dengue IgG Antibody|NTU|Negative|0|
SEROLOGY|Dengue Test (ELISA)||Negative|550|
SEROLOGY|Chikungunya||Negative|100|
SEROLOGY|Scrub Typhus||Negative|0|
SEROLOGY|Weil Felix Test|||150|
SEROLOGY|Anti Nuclear Antibody (ANA)||Negative|200|
SEROLOGY|HBeAg||Non-Reactive|0|
SEROLOGY|Anti HBe|||0|
SEROLOGY|Hepatitis A Virus IgM|S/Co|Negative|0|
SEROLOGY|Hepatitis E Virus IgM (HEV IgM)|S/Co|Negative|100|
SEROLOGY|HAV Ig-M Antibodies||Negative|100|
SEROLOGY|HEV IgM Antibodies||Negative|100|
SEROLOGY|Leptospira IgM||Negative|300|
SEROLOGY|Leptospira IgG||Negative|100|
SEROLOGY|Herpes Simplex Virus I+2 IgG|IU/ml|Negative|300|
SEROLOGY|Cytomegalovirus IgG|IU/mL|Negative|100|
SEROLOGY|Cytomegalovirus IgM|IU/ml|Negative|100|
SEROLOGY|Rubella IgG|IU/mL|Negative|100|
SEROLOGY|Rubella Antibodies IgM|IU/ml|Negative|0|
SEROLOGY|Toxoplasma IgG|IU/ml|Negative|250|
SEROLOGY|Toxo Plasma Gondii Antibodies IgM|IU/ml|Negative|0|
SEROLOGY|TB (Anti Tuberculosis)-IgG||Negative|100|
SEROLOGY|TB (Anti Tuberculosis)-IgM||Negative|100|
SEROLOGY|H.Pylori||Negative|300|
SEROLOGY|Total IgE|IU/ml|< 100|200|
SEROLOGY|Immunoglobulin M (IgM)|gm/L|0.4 - 2.3|300|
SEROLOGY|SARS COV-19 Antigen Test||Negative|1200|
SEROLOGY|Anti Phospholipid IgM Antibody|U/mL|Negative|450|
SEROLOGY|Anti Phospholipid IgG Antibody|U/mL|Negative|450|
SEROLOGY|Anti Cardiolipin IgM Antibody|U/mL|Negative|500|
SEROLOGY|Anti Cardiolipin IgG Antibody|U/mL|Negative|500|
SEROLOGY|Beta 2 Glycoprotein IgM Antibody|U/mL|Negative|450|
SEROLOGY|Beta 2 Glycoprotein IgG Antibody|U/mL|Negative|450|
SEROLOGY|p-ANCA|U/ml|Negative|50|
SEROLOGY|c-ANCA|U/ml|Negative|80|
SEROLOGY|AMA (Anti Microsomal Antibody)|IU/mL|Negative|50|
SEROLOGY|Plasmodium Falciparum||Negative|0|
SEROLOGY|Plasmodium Vivax||Negative|0|
SEROLOGY|HIV ELISA|S/Co|Non-Reactive|0|
SEROLOGY|Microfileria By Card||Negative|0|
HORMONE|T3|ng/ml|0.8 - 2.0|100|
HORMONE|T4|ug/dl|4.5 - 12.5|100|
HORMONE|TSH|uIU/ml|0.4 - 4.0|300|
HORMONE|Free T3|pg/mL|2.0 - 4.4|100|
HORMONE|Free T4|ng/dl|0.8 - 1.8|100|
HORMONE|Total Thyroxin|||0|
HORMONE|Total Triiodothyronine|||200|
HORMONE|Thyroid Stimulating Hormone||0.4 - 4.0|0|
HORMONE|FSH (Follicle Stimulating Hormone)|mIU/mL|Varies by phase|350|
HORMONE|LH (Lutenising Hormone)|mIU/mL|Varies by phase|700|
HORMONE|Prolactin|ng/ml|M: 2.6-13.1 / F: 4.8-23.3|700|
HORMONE|Progesterone|ng/ml|Varies by phase|300|
HORMONE|Estradiol (E2)|pg/ml|Varies by phase|2200|
HORMONE|Testosterone|ng/ml|M: 2.8-8.0|250|
HORMONE|Beta HCG|mIU/ml|< 5 (non-pregnant)|700|
HORMONE|PTH (Parathyroid Hormone)|pg/ml|15 - 65|1200|
HORMONE|Cortisol Serum (3 to 5 PM)|ug/dL|3 - 17|450|
HORMONE|Cortisol-AM|ug/dL|6 - 23|300|
HORMONE|Anti Mullerian Hormone (AMH)|ng/mL|Varies by age|2200|
HORMONE|Insulin Fasting (Hormone)|uU/mL|2.6 - 24.9|700|
HORMONE|Insulin PP (Hormone)|uU/mL||800|
HORMONE|Insulin Antibodies|U/mL||600|
HORMONE|Sr.DHEAS|ng/ml|Varies by age/sex|1200|
HORMONE|ACTH, Plasma|pg/ml|7.2 - 63.3|1200|
HORMONE|Ferritin|ng/ml|M: 30-400 / F: 15-150|100|
VITAMIN|25-OH Vitamin D (Total)|ng/ml|30 - 100|1000|
VITAMIN|Vitamin D Screen|ng/mL|30 - 100|300|
VITAMIN|Vitamin D Comprehensive|ng/mL|30 - 100|300|
VITAMIN|Vitamin B-12|pg/ml|200 - 900|1200|
VITAMIN|Vitamin K|ng/ml||200|
VITAMIN|Folate Serum (Folic Acid)|ng/mL|3 - 17|300|
URINE|Colour (Urine)||Pale Yellow|0|
URINE|Appearance (Urine)||Clear|0|
URINE|Reaction (pH)||5.0 - 8.0|0|
URINE|Specific Gravity||1.005 - 1.030|0|
URINE|Quantity (Urine)|||0|
URINE|Albumin (Urine)||Nil|0|
URINE|Sugar (Urine)||Nil|0|
URINE|Reducing Sugar (Urine)||Nil|0|
URINE|Ketone (Urine)||Nil|0|
URINE|Bile Salt||Negative|0|
URINE|Bile Pigment||Negative|0|
URINE|Urine Bilirubin||Negative|0|
URINE|Urobilinogen||Normal|0|
URINE|Nitrite||Negative|0|
URINE|Blood (Urine)||Negative|0|
URINE|Occult Blood||Negative|0|
URINE|Pus Cell|/hpf|0 - 5|0|
URINE|RBC's (Urine)|/hpf|0 - 2|0|
URINE|Epithelial Cell|/hpf|Few|0|
URINE|Casts (Urine)||Nil|0|
URINE|Hyaline||Nil|0|
URINE|Granular||Nil|0|
URINE|Cellular||Nil|0|
URINE|Waxy||Nil|0|
URINE|Crystal||Nil|0|
URINE|Calcium Oxalate||Nil|0|
URINE|Triple Phosphate||Nil|0|
URINE|Amorphous Phosphate||Nil|0|
URINE|Amorphous Material||Nil|0|
URINE|Calcium Carbonate||Nil|0|
URINE|Calcium Phosphate||Nil|0|
URINE|Ammonium Urates||Nil|0|
URINE|Urates||Nil|0|
URINE|Urine Uric Acid|||0|
URINE|Urine Calcium|mg/24 hrs|100 - 300|200|
URINE|Bence-Jones Protein||Negative|0|
URINE|Urine Sugar (F)||Nil|0|
URINE|Urine Sugar (PM)||Nil|0|
URINE|Urine Pregnancy Test (UPT)||Negative|100|
URINE|Pregnancy Test||Negative|0|
URINE|Bacteria (Urine)||Nil|0|
URINE|Other Parameters (Urine)|||0|
URINE|Microscopic Examination (Urine)|||0|
URINE|Chemical Examination (Urine)|||0|
URINE|Physical Examination (Urine)|||0|
URINE|24hrs Protein|mg/24hrs|< 150|0|
URINE|Total quantity of urine in 24 hrs|ml||0|
URINE|Urinary Albumin (Qualitative)||Nil|0|
URINE|Sodium Random Urine|mEq/L||400|
STOOL|Colour (Stool)||Brown|0|
STOOL|Consistency||Semi-solid|0|
STOOL|Reducing Sugar (Stool)||Negative|0|
STOOL|Occult Blood (Stool)||Negative|0|
STOOL|Stool Occult Blood||Negative|0|
STOOL|Pus Cell (Stool)|/hpf|0 - 5|0|
STOOL|RBC's (Stool)|/hpf|Nil|0|
STOOL|Epithelial Cells (Stool)||Few|0|
STOOL|Mucus||Absent|0|
STOOL|Macrophages||Nil|0|
STOOL|Vegetable Cells|/hpf||0|
STOOL|Starch Cells|||0|
STOOL|Fat Globules||Nil|0|
STOOL|Undigested Food Particles||Nil|0|
STOOL|Bacteria (Stool)||Normal Flora|0|
STOOL|Cyst||Not Seen|0|
STOOL|Trophozoites||Not Seen|0|
STOOL|Ova||Not Seen|0|
STOOL|Parasites||Not Seen|0|
STOOL|E.Histolytica||Not Seen|100|
STOOL|Entamoeba histolytica||Not Seen|0|
STOOL|Entamoeba coli||Not Seen|0|
STOOL|Giardia Lamblia||Not Seen|0|
STOOL|Trichomonas||Not Seen|0|
STOOL|Ova of Round Worm||Not Seen|0|
STOOL|Ova of Hook Worm||Not Seen|0|
STOOL|Ova Tape Worm||Not Seen|0|
STOOL|Ova of Pin Worm||Not Seen|0|
STOOL|H. Nana||Not Seen|0|
STOOL|Amoebae||Not Seen|0|
STOOL|Physical Examination (Stool)|||0|
STOOL|Chemical Examination (Stool)|||0|
STOOL|Microscopic Examination (Stool)|||0|
SEMEN|Colour (Semen)||Greyish White|0|
SEMEN|Volume|ml|2 - 5|0|
SEMEN|(pH) Reaction||7.2 - 8.0|0|
SEMEN|Odour||Characteristic|0|
SEMEN|Quantity (Semen)|ml||0|
SEMEN|Liquefaction Time|Minutes|< 30|0|
SEMEN|Viscosity||Normal|0|
SEMEN|Total Sperm Count|mill/ml|> 15|0|
SEMEN|Total No Of Spermatozoa|||0|
SEMEN|Motility|%||0|
SEMEN|Active Motile 1hr|%|> 32|0|
SEMEN|Sluggish Motile 1hr|%||0|
SEMEN|Non-Motile 1hr|%||0|
SEMEN|Active Motile 3hr|%||0|
SEMEN|Sluggish Motile 3hr|%||0|
SEMEN|Non-Motile 3hr|%||0|
SEMEN|Active Motile 1/2hr|%||0|
SEMEN|Sluggish Motile 1/2hr|%||0|
SEMEN|Non-Motile 1/2hr|%||0|
SEMEN|Dead|%||0|
SEMEN|Sperm Morphology|||0|
SEMEN|Normal (Morphology)|%|> 4|0|
SEMEN|Abnormal (Morphology)|%||0|
SEMEN|Degenerated Form|%||0|
SEMEN|Pus Cell (Semen)|/hpf|0 - 5|0|
SEMEN|R.B.C (Semen)||Nil|0|
SEMEN|W.B.C (Semen)|||0|
SEMEN|Epithelial Cell (Semen)||Few|0|
SEMEN|Normal Seminal Fluid|||0|
SEMEN|Fructose Test||Positive|0|
SEMEN|Abstinence|||0|
SEMEN|Collection|||0|
SEMEN|Method|||0|
SEMEN|Grade|||0|
SEMEN|Impression (Semen)|||0|
SEMEN|Physical Examination (Semen)|||0|
SEMEN|Chemical Examination (Semen)|||0|
SEMEN|Microscopic Examination (Semen)|||0|
MICROBIOLOGY|Urine Culture||No Growth|300|
MICROBIOLOGY|Blood Culture||No Growth|0|
MICROBIOLOGY|Culture & Sensitivity||No Growth|350|
MICROBIOLOGY|Pus Culture & Sensitivity||No Growth|300|
MICROBIOLOGY|Sterile Culture & Sensitivity Report|||100|
MICROBIOLOGY|Sputum For AFB||Negative|100|
MICROBIOLOGY|Gram Stain|||0|
MICROBIOLOGY|Zeihl Neelson Stain (ZN)||Negative|0|
MICROBIOLOGY|Fluid Examination|||300|
MICROBIOLOGY|Organism Isolated|||0|
MICROBIOLOGY|Organism Quantity|||0|
MICROBIOLOGY|Sensitive To|||0|
MICROBIOLOGY|Resistant To|||0|
MICROBIOLOGY|Found Sensitive To|||0|
MICROBIOLOGY|Found Resistant To|||0|
MICROBIOLOGY|Found Intermediate To|||0|
MICROBIOLOGY|ADA (Adenosine Deaminase)|U/L|< 30|1000|
MICROBIOLOGY|CK - NAC|U/L||200|
MICROBIOLOGY|Escherichia Coli|||0|
MICROBIOLOGY|Klebsiella Pneumoniae|||0|
MICROBIOLOGY|Pseudomonas Species|||0|
MICROBIOLOGY|Staphylococcus Aureus|||0|
MICROBIOLOGY|Streptococcus Species|||0|
MICROBIOLOGY|Enterococcus Species|||0|
MICROBIOLOGY|Acinetobacter Species|||0|
MICROBIOLOGY|Enterobacteriaceae|||0|
MICROBIOLOGY|Salmonella Typhi|||0|
MICROBIOLOGY|Cervico-Vaginal Smear (PAP Smear)|||500|
MICROBIOLOGY|KOH Mount|||0|
MICROBIOLOGY|Skin Scrapping for Fungus|||100|
MICROBIOLOGY|Bacteriological Examination|||0|
SPUTUM|1st Sample (Mucus)|||0|
SPUTUM|1st Sample (Saliva)|||0|
SPUTUM|2nd Sample (Mucus)|||0|
SPUTUM|2nd Sample (Saliva)|||0|
SPUTUM|3rd Sample (Mucus)|||0|
SPUTUM|3rd Sample (Saliva)|||0|
SPUTUM|Nature of Specimen|||0|
SPUTUM|Colour (Sputum)|||0|
SPUTUM|Consistency (Sputum)|||0|
SPUTUM|Odour (Sputum)|||0|
SPUTUM|Blood (Sputum)|||0|
SPUTUM|Gross Description (Sputum)|||0|
SPUTUM|Microscopic Appearance (Sputum)|||0|
TUMOR MARKER|CEA (Carcinoembryonic Antigen)|ng/ml|< 5|800|
TUMOR MARKER|CA-125|U/ml|< 35|1200|
TUMOR MARKER|CA 15.3|U/ml|< 31.3|0|
TUMOR MARKER|AFP (Alpha Fetoprotein)|ng/mL|< 10|100|
TUMOR MARKER|PSA (Prostate Specific Antigen)|ng/ml|< 4|250|
TUMOR MARKER|Clinical History (Tumor)|||0|
TUMOR MARKER|Specimen (Tumor)|||0|
TUMOR MARKER|Gross (Tumor)|||0|
TUMOR MARKER|Impression (Tumor)|||0|
TUMOR MARKER|Advised (Tumor)|||0|
TUMOR MARKER|Slide No (Tumor)|||0|
SPECIAL TEST|IL-6 (Interleukin-6)|pg/ml|< 7|1200|
SPECIAL TEST|Procalcitonin (PCT)|ng/ml|< 0.5|2200|
SPECIAL TEST|Nicotine Metabolites|ng/mL||1200|
SPECIAL TEST|Double Marker|||1250|
SPECIAL TEST|Triple Marker|||1200|
SPECIAL TEST|Quad Marker|||1400|
SPECIAL TEST|NT-proBNP (Special)|pg/ml|< 125|1200|
SPECIAL TEST|CPK-MB (Special)|IU/L|< 25|0|
SPECIAL TEST|AEC (Special)|/cu mm|20 - 500|100|
SPECIAL TEST|Anion Gap (Special)|MMOL/l|8 - 16|0|
SPECIAL TEST|Albumin (Special)|||0|
SPECIAL TEST|Alpha1 Globulin||0.1 - 0.3 g/dl|0|
SPECIAL TEST|Alpha2 Globulin||0.6 - 1.0 g/dl|0|
SPECIAL TEST|Beta Globulin||0.7 - 1.2 g/dl|0|
SPECIAL TEST|Gamma Globulin||0.7 - 1.6 g/dl|0|
SPECIAL TEST|Specimen Identification|||0|
MOLECULAR BIOLOGY|Mycobacterium Tuberculosis Complex||Not Detected|1200|
MOLECULAR BIOLOGY|Nontuberculosis Mycobacteria||Not Detected|0|
MOLECULAR BIOLOGY|TB Nested PCR||Not Detected|0|
HISTOPATH|Histopath|||250|
HISTOPATH|Specimen (Histopath)|||0|
HISTOPATH|Clinical History (Histopath)|||0|
HISTOPATH|Gross Examination (Histopath)|||0|
HISTOPATH|Microscopic Examination (Histopath)|||0|
HISTOPATH|Impression (Histopath)|||0|
HISTOPATH|Advice (Histopath)|||0|
HISTOPATH|Slide No. (Histopath)|||0|
CYTOLOGY|FNAC|||700|
CYTOLOGY|Aspirate|||50|
CYTOLOGY|Micro Scopy (Cytology)|||0|
CYTOLOGY|Impression (Cytology)|||0|
`.trim();
