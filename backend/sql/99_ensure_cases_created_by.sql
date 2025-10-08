-- Ensure created_by column exists on cases for tests
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);

-- Ensure party_ids array exists if referenced by policies
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS party_ids UUID[] DEFAULT '{}';

-- Ensure created_at exists
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure updated_at exists
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_cases_created_by ON public.cases(created_by);
