import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { User, Mail, Lock, ArrowLeft, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setEmail(user.email || '');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const updates: any = {};
      if (email) updates.email = email;
      if (password) updates.password = password;

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;

      setSuccess('Profile updated successfully!');
      setPassword('');
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
        <h1 className="text-sm font-bold uppercase tracking-widest">Profile</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-8">
        <div className="flex flex-col items-center py-8">
          <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-4 shadow-2xl">
            <User className="text-white/20" size={48} />
          </div>
          <h2 className="text-lg font-bold tracking-tight">{email}</h2>
          <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mt-1">User Profile</p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-white/60">
              <Mail size={14} />
              <h3 className="text-[10px] font-bold uppercase tracking-widest">Update Email</h3>
            </div>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-white/60">
              <Lock size={14} />
              <h3 className="text-[10px] font-bold uppercase tracking-widest">Update Password</h3>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                placeholder="New Password"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-400 text-xs">
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl"
          >
            {loading ? 'Updating...' : (
              <>
                <Save size={18} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
