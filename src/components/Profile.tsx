import React, { useState, useEffect } from 'react';
import { useUser, UserProfile } from '@clerk/clerk-react';
import { User, Mail, Lock, ArrowLeft, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, isLoaded } = useUser();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [showClerkProfile, setShowClerkProfile] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      setEmail(user.primaryEmailAddress?.emailAddress || '');
    }
  }, [user]);

  if (!isLoaded) return <div className="h-screen flex items-center justify-center text-white/10 italic">Loading profile...</div>;
  if (!user) return <div className="h-screen flex items-center justify-center text-white/10 italic">Please sign in to view your profile.</div>;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowClerkProfile(true);
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
        {showClerkProfile ? (
          <div className="flex flex-col items-center">
            <UserProfile routing="hash" />
            <button 
              onClick={() => setShowClerkProfile(false)}
              className="mt-4 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
            >
              Back to Summary
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col items-center py-8">
              <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-4 shadow-2xl overflow-hidden">
                {user.imageUrl ? (
                  <img src={user.imageUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="text-white/20" size={48} />
                )}
              </div>
              <h2 className="text-lg font-bold tracking-tight">{user.fullName || user.username || email}</h2>
              <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mt-1">User Profile</p>
            </div>

            <div className="space-y-6">
              <div className="p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="text-white/20" size={18} />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Email Address</span>
                      <span className="text-sm font-medium">{email}</span>
                    </div>
                  </div>
                  {user.primaryEmailAddress?.verification.status === 'verified' && (
                    <CheckCircle2 size={16} className="text-green-500" />
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <User className="text-white/20" size={18} />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">User ID</span>
                    <span className="text-[10px] font-mono break-all text-white/60">{user.id}</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowClerkProfile(true)}
                className="w-full bg-white text-black hover:bg-white/90 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl"
              >
                <Save size={18} />
                <span>Manage Account Settings</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
