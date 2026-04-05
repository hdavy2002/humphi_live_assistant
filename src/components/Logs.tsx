import React, { useState, useEffect, useMemo } from 'react';
import {
  Mic, MessageSquare, Zap, DollarSign, Hash,
  ArrowDownLeft, Calendar, ChevronDown, Loader2,
  TrendingUp, Wallet, Activity,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { cn } from '../lib/utils';

// ── Types ───────────────────────────────────────────────────────────
interface UsageLog {
  id: string;
  amount: string;
  type: string;
  status: string;
  duration_secs?: number;
  audio_tokens?: number;
  video_tokens?: number;
  metadata: {
    service?: string;
    model?: string;
    tokens?: { input?: number; output?: number; total?: number };
    inputTokens?: number;
    outputTokens?: number;
    userId?: string;
  } | null;
  created_at: string;
}

// ── Normalize Tinybird rows (snake_case) → UsageLog shape ───────────
function normalizeTinybirdRow(row: any): UsageLog {
  return {
    id:            row.id,
    amount:        String(-(row.cost ?? 0)),
    type:          'usage',
    status:        row.status ?? 'completed',
    created_at:    row.created_at,
    duration_secs: row.duration_secs ?? 0,
    audio_tokens:  row.audio_tokens  ?? 0,
    video_tokens:  row.video_tokens  ?? 0,
    metadata: {
      service:      row.service,
      model:        row.model,
      inputTokens:  row.input_tokens  ?? 0,
      outputTokens: row.output_tokens ?? 0,
      tokens: {
        input:  row.input_tokens  ?? 0,
        output: row.output_tokens ?? 0,
        total:  row.total_tokens  ?? 0,
      },
    },
  };
}

function formatDuration(secs: number): string {
  if (!secs || secs <= 0) return '—';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ── Helpers ─────────────────────────────────────────────────────────
function parseTokens(meta: UsageLog['metadata']) {
  if (!meta) return { input: 0, output: 0, total: 0 };
  const input  = meta.inputTokens  ?? meta.tokens?.input  ?? 0;
  const output = meta.outputTokens ?? meta.tokens?.output ?? 0;
  const total  = meta.tokens?.total ?? (input + output);
  return { input, output, total };
}

function friendlyModel(model?: string): string {
  if (!model) return 'Gemini Live';
  if (model.includes('claude-opus-4-6') || model.includes('claude-opus')) return 'HumPhi 4 31B ✦';
  if (model.includes('gemini-3.1-flash-live') || model.includes('gemini')) return 'Gemini Live';
  if (model.includes('gemma')) return 'HumPhi 4 31B ✦';
  return model.split('/').pop()?.replace(/-/g, ' ') || model;
}

function friendlyService(meta: UsageLog['metadata']): 'live' | 'ai' {
  return meta?.service === 'chat' ? 'ai' : 'live';
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}

// ── Main component ──────────────────────────────────────────────────
const LogsPage: React.FC = () => {
  const { user }      = useUser();
  const { getToken }  = useAuth();

  const [logs, setLogs]       = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<'all' | 'live' | 'ai'>('all');

  useEffect(() => {
    if (!user?.id) return;
    fetchLogs();
  }, [user?.id]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/usage/logs?userId=${user!.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const raw  = Array.isArray(data) ? data : (data?.rows ?? []);
        // Detect Tinybird rows by snake_case field, normalize to UsageLog shape
        setLogs(raw.map((r: any) =>
          r.input_tokens !== undefined ? normalizeTinybirdRow(r) : r
        ));
      }
    } catch {}
    setLoading(false);
  };

  const filtered = useMemo(() =>
    filter === 'all' ? logs : logs.filter(l => friendlyService(l.metadata) === filter),
    [logs, filter]
  );

  // ── Summary stats ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalCost   = logs.reduce((s, l) => s + Math.abs(parseFloat(l.amount || '0')), 0);
    const totalTokens = logs.reduce((s, l) => s + parseTokens(l.metadata).total, 0);
    const liveSessions = logs.filter(l => friendlyService(l.metadata) === 'live').length;
    const aiSessions   = logs.filter(l => friendlyService(l.metadata) === 'ai').length;
    return { totalCost, totalTokens, liveSessions, aiSessions, sessions: logs.length };
  }, [logs]);

  return (
    <div className="p-5 lg:p-8 min-h-full flex flex-col gap-6" style={{ fontFamily: "'Comfortaa', sans-serif" }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header>
        <h1 className="text-2xl md:text-3xl font-black text-[#0D1117] tracking-tight mb-1">
          Usage <span style={{ color: '#FF6619' }}>History</span>
        </h1>
        <p className="text-sm font-semibold text-[#0D1117]/50">
          Every session with Humphi AI — tokens used, cost charged, time and date.
        </p>
      </header>

      {/* ── Summary cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Sessions',
            value: stats.sessions.toString(),
            icon: Activity,
            bg: '#0D1117',
            color: '#22C9E8',
            textColor: '#ffffff',
          },
          {
            label: 'Total Tokens Used',
            value: stats.totalTokens > 0 ? stats.totalTokens.toLocaleString() : '0',
            icon: Hash,
            bg: '#ffffff',
            color: '#22C9E8',
            textColor: '#0D1117',
          },
          {
            label: 'Total Spent',
            value: `$${stats.totalCost.toFixed(6)}`,
            icon: DollarSign,
            bg: '#FF6619',
            color: '#ffffff',
            textColor: '#ffffff',
          },
          {
            label: 'Live / AI',
            value: `${stats.liveSessions} / ${stats.aiSessions}`,
            icon: Zap,
            bg: '#ffffff',
            color: '#FF6619',
            textColor: '#0D1117',
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-5 shadow-lg"
            style={{ background: card.bg, border: card.bg === '#ffffff' ? '2px solid rgba(0,0,0,0.06)' : 'none' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg" style={{ background: `${card.color}20` }}>
                <card.icon size={15} style={{ color: card.color }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: card.bg === '#0D1117' || card.bg === '#FF6619' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.4)' }}>
                {card.label}
              </span>
            </div>
            <div className="text-2xl font-black" style={{ color: card.textColor }}>{card.value}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Log table ───────────────────────────────────────────── */}
      <div className="flex-1 rounded-2xl shadow-xl overflow-hidden" style={{ background: '#ffffff', border: '2px solid rgba(0,0,0,0.06)' }}>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <h2 className="text-sm font-black text-[#0D1117]">Session Log</h2>
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#F1F5F9' }}>
            {(['all', 'live', 'ai'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
                style={{
                  background: filter === f ? '#FF6619' : 'transparent',
                  color:      filter === f ? '#ffffff'  : 'rgba(0,0,0,0.4)',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Column headers */}
        <div className="grid px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ gridTemplateColumns: '1fr 115px 82px 82px 80px 72px 75px 88px', color: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#FAFAFA' }}>
          <span>HumPhi Live</span>
          <span className="text-center">Date &amp; Time</span>
          <span className="text-right">Audio In</span>
          <span className="text-right">Audio Out</span>
          <span className="text-right">Video In</span>
          <span className="text-right">Total</span>
          <span className="text-right">Duration</span>
          <span className="text-right">Cost</span>
        </div>

        {/* Rows */}
        <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3" style={{ color: 'rgba(0,0,0,0.3)' }}>
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm font-semibold">Loading usage history…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#F1F5F9' }}>
                <Activity size={24} style={{ color: 'rgba(0,0,0,0.2)' }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-[#0D1117]/50">No usage recorded yet</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(0,0,0,0.3)' }}>
                  Start a Live Session or Chat to see your usage here.
                </p>
              </div>
            </div>
          ) : (
            filtered.map((log, i) => {
              const tokens   = parseTokens(log.metadata);
              const svc      = friendlyService(log.metadata);
              const model    = friendlyModel(log.metadata?.model);
              const cost     = Math.abs(parseFloat(log.amount || '0'));
              const duration = formatDuration(log.duration_secs ?? 0);
              const { date, time } = formatDate(log.created_at);

              const audioTokens = log.audio_tokens ?? 0;
              const videoTokens = log.video_tokens ?? 0;
              const mediaType   = svc === 'live'
                ? (videoTokens > 0 ? 'audio + video' : 'audio')
                : null;

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="grid items-center px-5 py-3.5 hover:bg-black/[0.02] transition-colors"
                  style={{ gridTemplateColumns: '1fr 115px 82px 82px 80px 72px 75px 88px' }}
                >
                  {/* Service + model */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: svc === 'live' ? 'rgba(255,102,25,0.12)' : 'rgba(34,201,232,0.12)' }}
                    >
                      {svc === 'live'
                        ? <Mic size={14} style={{ color: '#FF6619' }} />
                        : <MessageSquare size={14} style={{ color: '#22C9E8' }} />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0D1117] truncate">{model}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span
                          className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                          style={{
                            background: svc === 'live' ? 'rgba(255,102,25,0.1)' : 'rgba(34,201,232,0.1)',
                            color:      svc === 'live' ? '#FF6619' : '#0AABCA',
                          }}
                        >
                          {svc === 'live' ? 'Live Session' : 'HumPhi AI'}
                        </span>
                        {mediaType && (
                          <span
                            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                            style={{
                              background: videoTokens > 0 ? 'rgba(139,92,246,0.1)' : 'rgba(34,201,232,0.1)',
                              color:      videoTokens > 0 ? '#7c3aed'              : '#0AABCA',
                            }}
                          >
                            {mediaType}
                          </span>
                        )}
                        <span
                          className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                          style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}
                        >
                          {log.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="text-center">
                    <p className="text-xs font-bold text-[#0D1117]">{date}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(0,0,0,0.35)' }}>{time}</p>
                  </div>

                  {/* Audio Input tokens */}
                  <div className="text-right">
                    <span className="text-sm font-bold" style={{ color: audioTokens > 0 ? '#FF6619' : 'rgba(0,0,0,0.25)' }}>
                      {audioTokens > 0 ? audioTokens.toLocaleString() : '—'}
                    </span>
                  </div>

                  {/* Audio Output tokens */}
                  <div className="text-right">
                    <span className="text-sm font-bold" style={{ color: tokens.output > 0 ? '#22C9E8' : 'rgba(0,0,0,0.25)' }}>
                      {tokens.output > 0 ? tokens.output.toLocaleString() : '—'}
                    </span>
                  </div>

                  {/* Video Input tokens */}
                  <div className="text-right">
                    <span className="text-sm font-bold" style={{ color: videoTokens > 0 ? '#7c3aed' : 'rgba(0,0,0,0.25)' }}>
                      {videoTokens > 0 ? videoTokens.toLocaleString() : '—'}
                    </span>
                  </div>

                  {/* Total tokens */}
                  <div className="text-right">
                    <span className="text-sm font-bold" style={{ color: '#0D1117' }}>
                      {tokens.total > 0 ? tokens.total.toLocaleString() : '—'}
                    </span>
                  </div>

                  {/* Duration */}
                  <div className="text-right">
                    <span className="text-sm font-bold text-[#0D1117]">{duration}</span>
                  </div>

                  {/* Cost */}
                  <div className="text-right">
                    <span
                      className="text-sm font-black"
                      style={{ color: cost > 0 ? '#FF6619' : 'rgba(0,0,0,0.25)' }}
                    >
                      {cost > 0 ? `-$${cost.toFixed(6)}` : '$0.000000'}
                    </span>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', background: '#FAFAFA' }}>
            <span className="text-[11px] font-semibold" style={{ color: 'rgba(0,0,0,0.35)' }}>
              {filtered.length} session{filtered.length !== 1 ? 's' : ''} shown
            </span>
            <span className="text-[11px] font-black" style={{ color: '#FF6619' }}>
              Total charged: ${stats.totalCost.toFixed(6)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsPage;
