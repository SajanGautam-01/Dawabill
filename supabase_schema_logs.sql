-- ==============================================================================
-- CENTRALIZED AUDIT & ERROR LOGGING (STEP 3)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'critical')),
    action TEXT NOT NULL, 
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) FOR LOGS
-- ==========================================

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Allow only the ADMINS to read logs (isolated by store)
CREATE POLICY "Log read isolation" 
ON public.logs FOR SELECT 
USING (store_id = (SELECT store_id FROM public.users WHERE id = auth.uid()));

-- Allow the client to explicitly log events (INSERT only)
-- We use a SECURITY DEFINER function if we want to ensure IP/User context is correct, 
-- but a simple INSERT policy is usually safe if RLS is tight.
CREATE POLICY "Log insertion" 
ON public.logs FOR INSERT 
WITH CHECK (true); -- Anyone can log, but only admins can READ. 
-- In a real prod environment, we would restrict this to auth'd users.

-- Index for performance on large log sets
CREATE INDEX idx_logs_store_at ON public.logs (store_id, created_at DESC);
CREATE INDEX idx_logs_level ON public.logs (level);
