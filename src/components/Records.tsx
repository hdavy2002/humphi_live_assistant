import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Monitor, Clock, Calendar, Download, Play, Trash2, Cloud, Loader2, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Recording } from '../types';
import { cn } from '../lib/utils';

export default function Records() {
  const { user } = useUser();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'syncing' | 'cloud'>('all');
  const [search, setSearch] = useState('');

  // Mock data for recordings
  useEffect(() => {
    const mockRecordings: Recording[] = [
      {
        id: '1',
        user_id: user?.id || 'guest',
        title: 'Project Alpha Design Review',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        duration: '12:45',
        sync_status: 'cloud',
        bunny_stream_id: 'vid_123',
        size_bytes: 45000000
      },
      {
        id: '2',
        user_id: user?.id || 'guest',
        title: 'System Debugging Session',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        duration: '05:22',
        sync_status: 'syncing',
        size_bytes: 12000000
      },
      {
        id: '3',
        user_id: user?.id || 'guest',
        title: 'Client Demo - Phase 1',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        duration: '24:10',
        sync_status: 'cloud',
        bunny_stream_id: 'vid_456',
        size_bytes: 120000000
      }
    ];

    const timer = setTimeout(() => {
      setRecordings(mockRecordings);
      setLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, [user]);

  const filtered = recordings.filter((rec) => {
    const matchesSearch = rec.title.toLowerCase().includes(search.toLowerCase());
    if (filter === 'all') return matchesSearch;
    return matchesSearch && rec.sync_status === filter;
  });

  return (
    <div className="p-4 pt-16 md:pt-8 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* ── Page Header ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold text-[#0D1117] tracking-tighter" style={{ fontFamily: "'Comfortaa', sans-serif" }}>
            My <span className="text-[#FF6619]">Recordings</span>
          </h1>
          <p className="text-[#0D1117]/60 font-bold mt-1 text-lg">Access and manage your synced screen captures.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 w-full sm:min-w-[320px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0D1117]/40" size={20} />
            <input 
              type="text" 
              placeholder="Search recordings..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border-2 border-black/10 rounded-2xl py-3 pl-12 pr-4 text-sm text-[#0D1117] placeholder:text-[#0D1117]/30 focus:outline-none focus:border-[#22C9E8] transition-all font-bold shadow-sm"
            />
          </div>

          <div className="flex items-center gap-1 p-1.5 bg-[#0D1117] rounded-2xl border-2 border-black/20 shadow-xl">
            {(['all', 'syncing', 'cloud'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                  filter === f 
                    ? "bg-[#22C9E8] text-[#0D1117] shadow-md scale-105" 
                    : "text-white/40 hover:text-white/60 hover:bg-white/5"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────── */}
      {loading ? (
        <div className="py-32 flex flex-col items-center gap-4">
          <Loader2 size={40} className="animate-spin text-[#22C9E8]" />
          <p className="text-[#0D1117]/40 font-bold text-sm tracking-widest uppercase">Initializing recording library...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center bg-[#0D1117] border-4 border-black/20 rounded-[48px] shadow-2xl">
          <div className="w-20 h-20 bg-[#22C9E8]/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border-2 border-[#22C9E8]/20">
            <Monitor size={40} className="text-[#22C9E8]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">No Recordings Found</h2>
          <p className="text-white/40 max-w-sm mx-auto px-4 font-medium">Your screen captures will appear here once you start sharing in a live session.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filtered.map((rec, i) => (
              <motion.div
                key={rec.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.05 }}
                className="group relative flex flex-col bg-[#0D1117] border-2 border-black/20 rounded-[32px] overflow-hidden shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300"
              >
                {/* Thumbnail Area */}
                <div className="relative aspect-video bg-[#1A2232] group-hover:bg-[#22C9E8]/5 transition-colors overflow-hidden border-b-2 border-black/20">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Monitor size={64} className="text-[#22C9E8]/10 group-hover:text-[#22C9E8]/20 transition-colors" />
                  </div>
                  
                  {/* Status Badge */}
                  <div className={cn(
                    "absolute top-4 left-4 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 backdrop-blur-md border border-white/10",
                    rec.sync_status === 'cloud' ? "bg-green-500/20 text-green-400" : "bg-[#FF6619]/20 text-[#FF6619]"
                  )}>
                    {rec.sync_status === 'cloud' ? <Cloud size={10} /> : <Loader2 size={10} className="animate-spin" />}
                    {rec.sync_status === 'cloud' ? 'Synced' : 'Syncing'}
                  </div>

                  {/* Play Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-14 h-14 bg-[#FFD60A] rounded-full flex items-center justify-center text-black shadow-2xl transform scale-90 group-hover:scale-100 transition-transform cursor-pointer border-2 border-black">
                      <Play size={24} fill="currentColor" className="ml-1" />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-5">
                  <div className="space-y-2">
                    <h3 className="font-bold text-white text-xl truncate leading-tight tracking-tight" style={{ fontFamily: "'Comfortaa', sans-serif" }}>
                      {rec.title}
                    </h3>
                    <div className="flex items-center gap-4 text-white/40 text-[11px] font-bold uppercase tracking-widest">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-[#22C9E8]" />
                        {new Date(rec.timestamp).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} className="text-[#22C9E8]" />
                        {rec.duration}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <button className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white transition-all border border-white/5 hover:border-white/20 group/btn" title="Download">
                        <Download size={18} className="group-hover/btn:scale-110 transition-transform" />
                      </button>
                      <button className="p-3 bg-white/5 hover:bg-red-500/10 rounded-2xl text-white/60 hover:text-red-500 transition-all border border-white/5 hover:border-red-500/20 group/trash" title="Delete">
                        <Trash2 size={18} className="group-trash/btn:scale-110 transition-transform" />
                      </button>
                    </div>
                    
                    {rec.sync_status === 'syncing' ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] text-[#22C9E8] font-bold animate-pulse tracking-tighter">BG UPLOADING...</span>
                        <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
                           <div className="h-full bg-[#22C9E8] w-2/3 animate-progress" />
                        </div>
                      </div>
                    ) : (
                       <button className="text-[10px] font-bold text-[#22C9E8] hover:text-[#22C9E8]/80 transition-colors uppercase tracking-widest flex items-center gap-1 group/link">
                         View Details <Play size={8} className="group-hover/link:translate-x-1 transition-transform" />
                       </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
