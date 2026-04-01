import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { History, ArrowLeft, TrendingUp, TrendingDown, Clock, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Transaction } from '../types';

export default function Records() {
  const { user } = useUser();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const response = await fetch(`/api/wallet/transactions?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(Array.isArray(data) ? data : (data.transactions || []));
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden max-w-[450px] mx-auto border-x border-white/5 shadow-2xl">
      <header className="shrink-0 p-4 border-b border-white/10 bg-[#0d0d0d] flex items-center gap-4">
        <button onClick={() => navigate('/wallet')} className="p-2 hover:bg-white/5 rounded-xl text-white/40 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-bold uppercase tracking-widest">Records</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="h-full flex items-center justify-center text-white/10 italic">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/10 text-center p-8">
            <History size={48} className="mb-4 opacity-20" />
            <h3 className="text-sm font-bold uppercase tracking-widest mb-2">No Records</h3>
            <p className="text-xs max-w-[200px] leading-relaxed">Your transaction history will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <motion.div 
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    tx.type === 'topup' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                  }`}>
                    {tx.type === 'topup' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {tx.type === 'topup' ? 'Wallet Top-up' : 'Usage Charge'}
                    </span>
                    <div className="flex items-center gap-1.5 text-[9px] text-white/30 font-bold uppercase tracking-widest mt-0.5">
                      <Clock size={10} />
                      <span>{new Date(tx.created_at).toLocaleDateString()} {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-sm font-bold ${
                    tx.type === 'topup' ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {tx.type === 'topup' ? '+' : '-'}${tx.amount.toFixed(2)}
                  </span>
                  <span className="text-[8px] text-white/20 uppercase font-black tracking-widest mt-0.5">
                    {tx.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
