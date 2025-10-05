create table if not exists public.case_settlement_signatures (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid references public.case_settlements(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  user_id uuid references public.users(id),
  signature_type text, -- 'image' or 'text'
  signature_data text, -- base64 image or plain text
  uploaded_at timestamptz default now()
);
create index if not exists idx_settlement_signatures_settlement on public.case_settlement_signatures(settlement_id);
