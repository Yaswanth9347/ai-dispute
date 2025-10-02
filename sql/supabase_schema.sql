-- create extension if needed and a small notes table for quick tests
create extension if not exists "pgcrypto";

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  title text,
  body text,
  created_at timestamptz default now()
);



-- minimal tables for MVP

create table public.users (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text unique,
  role text,
  created_at timestamptz default now()
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  title text,
  filed_by uuid references public.users(id),
  status text default 'draft', -- draft, open, analyzing, closed, escalated
  case_type text,
  jurisdiction text,
  created_at timestamptz default now()
);

create table public.case_parties (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  user_id uuid references public.users(id),
  role text, -- claimant/respondent
  contact_email text,
  responded boolean default false,
  responded_at timestamptz
);

create table public.statements (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  user_id uuid references public.users(id),
  text text,
  summary text,
  created_at timestamptz default now()
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  uploader_id uuid references public.users(id),
  file_path text,
  sha256 text,
  metadata jsonb,
  ocr_text text,
  transcription text,
  created_at timestamptz default now()
);

create table public.ai_analysis (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete cascade,
  model text,
  analysis jsonb,
  created_at timestamptz default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id),
  actor text,
  action text,
  details jsonb,
  created_at timestamptz default now()
);
