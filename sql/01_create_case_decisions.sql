-- sql/01_create_case_decisions.sql
create table if not exists public.case_decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  analysis_id uuid references public.ai_analysis(id) on delete set null,
  option_id text, -- option identifier (string or numeric)
  decision text not null, -- accept | decline | propose
  user_id uuid references public.users(id),
  note text,
  created_at timestamptz default now()
);
create index if not exists idx_case_decisions_case on public.case_decisions(case_id);
