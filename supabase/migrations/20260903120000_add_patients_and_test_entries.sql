-- Patients and their blood test entries, owned per-user with RLS.

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  birth_date date not null,
  gender text not null check (gender in ('female', 'male')),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.patients to authenticated;
grant all on public.patients to service_role;
alter table public.patients enable row level security;

create policy "Users manage own patients"
  on public.patients for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index patients_user_id_idx on public.patients (user_id);

create table public.test_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  mcv numeric,
  hb numeric,
  iron numeric,
  tibc numeric,
  ferritin numeric,
  tsh numeric,
  reticulocytes numeric,
  retic_index numeric,
  bilirubin_indirect numeric,
  creatinine numeric,
  b12 numeric,
  folate numeric,
  epo numeric,
  morphology text,
  notes text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.test_entries to authenticated;
grant all on public.test_entries to service_role;
alter table public.test_entries enable row level security;

create policy "Users manage own test entries"
  on public.test_entries for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index test_entries_patient_id_idx on public.test_entries (patient_id);
create index test_entries_user_id_idx on public.test_entries (user_id);
create index test_entries_date_idx on public.test_entries (date);
