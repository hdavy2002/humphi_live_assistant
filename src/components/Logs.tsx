import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ScrollText, Terminal, Search, Filter, Trash2, 
  Download, Copy, Check, LayoutPanelTop, Activity,
  AlertTriangle, CheckCircle2, Cpu, Zap
} from 'lucide-react';
import { useLogs } from '../contexts/LogContext';
import { LogItem } from './LogItem';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const LogsPage: React.FC = () => {
  const { logs, clearLogs } = useLogs();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch = log.message.toLowerCase().includes(search.toLowerCase()) || 
                          (log.details && JSON.stringify(log.details).toLowerCase().includes(search.toLowerCase()));
      const matchFilter = filter === 'all' || log.type === filter;
      return matchSearch && matchFilter;
    });
  }, [logs, search, filter]);

  const stats = useMemo(() => ({
    total: logs.length,
    errors: logs.filter(l => l.type === 'error').length,
    warnings: logs.filter(l => l.type === 'warning').length,
    success: logs.filter(l => l.type === 'received' || l.type === 'info').length,
  }), [logs]);

  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  const copyToClipboard = () => {
    const text = logs.map(l => `[${l.timestamp.toISOString()}] ${l.type.toUpperCase()}: ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadLogs = () => {
    const text = logs.map(l => `[${l.timestamp.toISOString()}] ${l.type.toUpperCase()}: ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `humphi-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-10 min-h-full flex flex-col gap-8">
      {/* Header Area */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/10 shadow-xl backdrop-blur-md">
              <Terminal className="text-cyan-400" size={24} />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight" style={{ fontFamily: "'Comfortaa', sans-serif" }}>
              System <span className="text-cyan-400">Operations</span>
            </h1>
          </div>
          <p className="text-white/40 font-medium ml-1">Real-time infrastructure and AI heartbeat monitor.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={downloadLogs}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
          >
            <Download size={16} />
            Export
          </button>
          <button 
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 border border-cyan-400/50 rounded-xl text-sm font-bold text-black transition-all active:scale-95 shadow-lg shadow-cyan-500/20"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy All'}
          </button>
        </div>
      </header>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: stats.total, icon: Activity, color: 'text-blue-400', bg: 'bg-blue-400/10' },
          { label: 'Critical Errors', value: stats.errors, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10' },
          { label: 'System Health', value: stats.total > 0 ? `${Math.round(((stats.total - stats.errors) / stats.total) * 100)}%` : '100%', icon: Cpu, color: 'text-green-400', bg: 'bg-green-400/10' },
          { label: 'Active Tasks', value: stats.success, icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-5 bg-white/5 border border-white/10 rounded-[24px] backdrop-blur-xl relative overflow-hidden group"
          >
            <div className={cn("absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity", stat.color)}>
              <stat.icon size={48} />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("p-1.5 rounded-lg", stat.bg)}>
                <stat.icon size={16} className={stat.color} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{stat.label}</span>
            </div>
            <div className="text-2xl font-black text-white">{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Main Log Viewer */}
      <div className="flex-1 min-h-[500px] bg-[#0D1117]/80 border border-white/10 rounded-[32px] shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl">
        {/* Toolbar */}
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row items-center gap-4 bg-white/5">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={16} />
            <input 
              type="text" 
              placeholder="Search session logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-white/5 shadow-inner">
            {['all', 'info', 'sent', 'received', 'error'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  filter === f 
                    ? "bg-white/10 text-white shadow-xl" 
                    : "text-white/20 hover:text-white/40"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <button 
            onClick={clearLogs}
            className="p-2.5 text-white/20 hover:text-red-400 transition-colors tooltip"
            title="Clear All Logs"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar scroll-smooth">
          <AnimatePresence mode="popLayout">
            {filteredLogs.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-white/20 gap-4"
              >
                <div className="p-6 bg-white/5 rounded-full border border-white/5">
                  <ScrollText size={48} strokeWidth={1} />
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm tracking-wide">NO LOG ENTRIES FOUND</p>
                  <p className="text-xs opacity-50 mt-1">Start a live session to see real-time data.</p>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col">
                {filteredLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <LogItem log={log} />
                  </motion.div>
                ))}
                <div ref={logEndRef} />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-white/5 bg-black/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Capture Active</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={autoScroll} 
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="sr-only"
              />
              <div className={cn(
                "w-7 h-4 rounded-full transition-colors relative",
                autoScroll ? "bg-cyan-500" : "bg-white/10"
              )}>
                <div className={cn(
                  "absolute top-1 left-1 w-2 h-2 rounded-full bg-white transition-transform",
                  autoScroll ? "translate-x-3" : "translate-x-0"
                )} />
              </div>
              <span className="text-[10px] font-bold text-white/20 group-hover:text-white/40 uppercase tracking-widest transition-colors">Autoscroll</span>
            </label>
          </div>
          <span className="text-[10px] font-medium text-white/10 italic">
            Buffer: {logs.length} / 1000 items
          </span>
        </div>
      </div>
    </div>
  );
};

export default LogsPage;
