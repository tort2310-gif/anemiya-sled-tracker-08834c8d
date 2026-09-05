-- Expand test_entries with the diagnostic detail fields identified while
-- comparing the app's logic against the reference algorithm (АНЕМИЯ_Алгоритм.pdf,
-- О. Терехова, 2024): structured Hb-electrophoresis/sideroblasts/UZI results
-- (previously only captured as free text and lost on save), lead exposure labs,
-- secondary endocrine workup, liver panel, and HUS/TTP markers (platelets, LDH).

alter table public.test_entries
  add column electrophoresis text check (electrophoresis in ('alpha_norm', 'beta_high')),
  add column sideroblasts boolean,
  add column lead_blood numeric,
  add column lead_urine numeric,
  add column urea numeric,
  add column uric_acid numeric,
  add column total_protein numeric,
  add column gfr numeric,
  add column ft3 numeric,
  add column ft4 numeric,
  add column uzi_finding text check (uzi_finding in ('normal', 'abdominal', 'renal', 'adrenal', 'liver')),
  add column aldosterone numeric,
  add column renin numeric,
  add column acth numeric,
  add column prolactin numeric,
  add column cortisol numeric,
  add column c_peptide numeric,
  add column glucose numeric,
  add column hba1c numeric,
  add column alt numeric,
  add column ast numeric,
  add column bilirubin_direct numeric,
  add column hemolysis_trigger text check (hemolysis_trigger in ('drug', 'g6pd', 'viral', 'autoimmune', 'unknown')),
  add column platelets numeric,
  add column ldh numeric,
  add column organomegaly text check (organomegaly in ('none', 'spleen', 'liver', 'both'));
