import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Wallet as WalletIcon, CreditCard, ArrowLeft, Plus, History, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export default function Wallet() {
  const [balance, setBalance] = useState<number>(0);
  const [amount, setAmount] = useState<string>('10');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    fetchBalance();
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      verifySession(sessionId);
    }
  }, [searchParams]);

  const fetchBalance = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('wallet_balance')
      .eq('id', user.id)
      .maybeSingle();

    if (error) console.error("Error fetching balance:", error);
    if (data) setBalance(data.wallet_balance);
    else setBalance(0);
  };

  const verifySession = async (sessionId: string) => {
    setVerifying(true);
    try {
      const response = await fetch(`/api/verify-session?sessionId=${sessionId}`);
      const data = await response.json();
      if (data.success) {
        await fetchBalance();
        navigate('/wallet', { replace: true });
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleTopUp = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 2) {
      setError('Minimum top-up is 2 USD');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numAmount, userId: user.id }),
      });

      const session = await response.json();
      if (session.error) throw new Error(session.error);

      // Redirect to Stripe Checkout
      const stripe = (window as any).Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
      const { error } = await stripe.redirectToCheckout({ sessionId: session.id });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden max-w-[450px] mx-auto border-x border-white/5 shadow-2xl">
      <header className="shrink-0 p-4 border-b border-white/10 bg-[#0d0d0d] flex items-center gap-4">
        <button onClick={() => navigate('/')} className="p-2 hover:bg-white/5 rounded-xl text-white/40 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-bold uppercase tracking-widest">Wallet</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Balance Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-8 shadow-2xl shadow-blue-600/20 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <WalletIcon size={120} />
          </div>
          <div className="relative z-10">
            <p className="text-white/60 text-[10px] uppercase font-bold tracking-widest mb-2">Available Balance</p>
            <h2 className="text-4xl font-bold tracking-tight">${balance.toFixed(2)}</h2>
          </div>
        </motion.div>

        {verifying && (
          <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400 text-xs animate-pulse">
            <CreditCard size={16} />
            <span>Verifying your payment...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Top Up Form */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-white/60">
            <Plus size={14} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest">Top Up Wallet</h3>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {['5', '10', '20', '50', '100', '200'].map((val) => (
              <button 
                key={val}
                onClick={() => setAmount(val)}
                className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                  amount === val ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                }`}
              >
                ${val}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-[9px] uppercase font-bold tracking-widest text-white/30 px-1">Custom Amount (Min $2)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-sm">$</span>
              <input 
                type="number"
                min="2"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-8 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                placeholder="0.00"
              />
            </div>
          </div>

          <button 
            onClick={handleTopUp}
            disabled={loading || verifying}
            className="w-full bg-white text-black hover:bg-white/90 disabled:opacity-50 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl"
          >
            {loading ? 'Redirecting...' : (
              <>
                <CreditCard size={18} />
                <span>Top Up Now</span>
              </>
            )}
          </button>
        </div>

        <div className="pt-8 border-t border-white/5">
          <button 
            onClick={() => navigate('/records')}
            className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <History size={18} className="text-white/40 group-hover:text-white transition-colors" />
              <span className="text-xs font-bold uppercase tracking-wider">Transaction History</span>
            </div>
            <ArrowLeft size={16} className="rotate-180 text-white/20 group-hover:text-white transition-colors" />
          </button>
        </div>
      </main>
    </div>
  );
}
