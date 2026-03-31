-- Fix: Allow service_role to INSERT into transactions (needed for API writes)
-- The API writes transactions using the postgres/service_role, RLS blocks anon/authenticated inserts
-- Run this in your Supabase SQL Editor

-- Allow service role to insert transactions (API-initiated top-ups)
CREATE POLICY "Service role can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (true);

-- Allow service role to update profile balances 
CREATE POLICY "Service role can update profiles" ON public.profiles
  FOR UPDATE USING (true);

-- Verify the column was added successfully
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'transactions'
ORDER BY ordinal_position;
