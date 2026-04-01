-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only see/update their own profile
CREATE POLICY profiles_isolation_policy ON profiles
    FOR ALL
    TO authenticated, anon, public
    USING (id = current_setting('app.user_id', true));

-- Wallets: Users can only see/update their own wallet
CREATE POLICY wallets_isolation_policy ON wallets
    FOR ALL
    TO authenticated, anon, public
    USING (user_id = current_setting('app.user_id', true));

-- Transactions: Filter by wallet ownership
-- We use a subquery to verify the wallet belongs to the current user.
-- High-performance B-Tree index on wallet_id/user_id makes this efficient.
CREATE POLICY transactions_isolation_policy ON transactions
    FOR ALL
    TO authenticated, anon, public
    USING (
        wallet_id IN (
            SELECT id FROM wallets WHERE user_id = current_setting('app.user_id', true)
        )
    );

-- Recordings: Users can only see their own recordings
CREATE POLICY recordings_isolation_policy ON recordings
    FOR ALL
    TO authenticated, anon, public
    USING (user_id = current_setting('app.user_id', true));

-- Memory Sessions: Users can only see their own memory sessions
CREATE POLICY memory_sessions_isolation_policy ON memory_sessions
    FOR ALL
    TO authenticated, anon, public
    USING (user_id = current_setting('app.user_id', true));

-- IMPORTANT: Ensure that the 'service_role' or background tasks can bypass RLS 
-- if they connect with a specific role. Neon typically uses a single 'neondb_owner' 
-- which can bypass RLS by default. If you create more roles, you may need:
-- ALTER TABLE ... FORCE ROW LEVEL SECURITY; 
-- to ensure even owners are restricted (not recommended for this use case).
