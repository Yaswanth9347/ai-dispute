-- sql/02_create_case_settlements.sql
create table if not exists public.case_settlements (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  analysis_id uuid references public.ai_analysis(id),
  option_id text,
  file_path text,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);
create index if not exists idx_case_settlements_case on public.case_settlements(case_id);
