import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, MessageSquare, Trash2, Copy, Check, Share2,
  Send, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { getShareLinks } from '../lib/chat-config';
import { cn } from '../lib/utils';

// ── Types ──────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}
interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
}

// ── Code block with copy button ─────────────────────────────────────
function CodeBlock({ language, children }: { language?: string; children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative my-3 rounded-xl overflow-hidden shadow-md" style={{ background: '#1A2232', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ background: '#0D1117', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {language || 'code'}
        </span>
        <button
          onClick={() => { navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

// ── Markdown ────────────────────────────────────────────────────────
function MessageContent({ content, isUser }: { content: string; isUser?: boolean }) {
  const textColor  = isUser ? '#ffffff' : '#0D1117';
  const codeColor  = isUser ? '#FFE0CC' : '#C2410C';
  const codeBg     = isUser ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.07)';

  return (
    <ReactMarkdown
      components={{
        code({ className, children, ...props }: any) {
          const isInline = !className;
          if (isInline) {
            return (
              <code style={{ background: codeBg, color: codeColor, padding: '1px 5px', borderRadius: 5, fontSize: 12, fontFamily: 'monospace' }} {...props}>
                {children}
              </code>
            );
          }
          return <CodeBlock language={className?.replace('language-', '') || ''}>{String(children).replace(/\n$/, '')}</CodeBlock>;
        },
        p({ children })      { return <p style={{ color: textColor, marginBottom: 6, lineHeight: 1.65 }}>{children}</p>; },
        ul({ children })     { return <ul style={{ color: textColor, paddingLeft: 20, marginBottom: 6 }}>{children}</ul>; },
        ol({ children })     { return <ol style={{ color: textColor, paddingLeft: 20, marginBottom: 6 }}>{children}</ol>; },
        li({ children })     { return <li style={{ color: textColor, lineHeight: 1.6 }}>{children}</li>; },
        strong({ children }) { return <strong style={{ color: textColor, fontWeight: 700 }}>{children}</strong>; },
        h1({ children })     { return <h1 style={{ color: textColor, fontSize: 18, fontWeight: 700, margin: '10px 0 6px' }}>{children}</h1>; },
        h2({ children })     { return <h2 style={{ color: textColor, fontSize: 16, fontWeight: 700, margin: '8px 0 5px' }}>{children}</h2>; },
        h3({ children })     { return <h3 style={{ color: textColor, fontSize: 14, fontWeight: 600, margin: '6px 0 4px' }}>{children}</h3>; },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── Per-message actions ─────────────────────────────────────────────
function MessageActions({ content, isUser, onDelete }: { content: string; isUser: boolean; onDelete: () => void }) {
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const links = getShareLinks(content);

  return (
    <div
      className="absolute -top-9 flex gap-1 rounded-2xl px-2 py-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none group-hover:pointer-events-auto"
      style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.10)' }}
    >
      <button onClick={() => { navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
        className="p-1.5 rounded-xl transition-colors hover:bg-black/5" title="Copy"
        style={{ color: copied ? '#16a34a' : 'rgba(0,0,0,0.4)' }}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      <div className="relative">
        <button onClick={() => setShareOpen(v => !v)} className="p-1.5 rounded-xl hover:bg-black/5 transition-colors" title="Share"
          style={{ color: 'rgba(0,0,0,0.4)' }}>
          <Share2 size={13} />
        </button>
        <AnimatePresence>
          {shareOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 4 }} transition={{ duration: 0.1 }}
              className="absolute -top-28 left-0 flex flex-col gap-0.5 rounded-2xl p-2 shadow-xl z-30"
              style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.10)', minWidth: 140 }}
              onMouseLeave={() => setShareOpen(false)}
            >
              {[
                { href: links.whatsapp, dot: '#25D366', label: 'WhatsApp' },
                { href: links.facebook, dot: '#1877F2', label: 'Facebook' },
                { href: links.twitter,  dot: '#000000', label: 'X / Twitter' },
              ].map(item => (
                <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold hover:bg-black/5 transition-colors"
                  style={{ color: 'rgba(0,0,0,0.7)' }}>
                  <span style={{ color: item.dot, fontSize: 16, lineHeight: 1 }}>●</span>{item.label}
                </a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <button onClick={onDelete} className="p-1.5 rounded-xl hover:bg-red-50 transition-colors" title="Delete"
        style={{ color: 'rgba(0,0,0,0.4)' }}>
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Date grouping ───────────────────────────────────────────────────
function groupByDate(sessions: ChatSession[]) {
  const now = Date.now(), DAY = 86_400_000;
  const g: Record<string, ChatSession[]> = {};
  for (const s of sessions) {
    const d = now - s.createdAt;
    const label = d < DAY ? 'Today' : d < 2*DAY ? 'Yesterday' : d < 7*DAY ? 'This week' : 'Older';
    (g[label] = g[label] || []).push(s);
  }
  return g;
}

// ── Main ────────────────────────────────────────────────────────────
export default function HumPhiChat() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions]       = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [input, setInput]             = useState('');
  const [isStreaming, setIsStreaming]  = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [tokenUsage, setTokenUsage]   = useState({ input: 0, output: 0 });
  const [sessionCost, setSessionCost] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const abortRef  = useRef<AbortController | null>(null);

  useEffect(() => { if (user?.id) loadSessions(); }, [user?.id]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingContent]);
  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px';
  }, [input]);

  const loadSessions = async () => {
    if (!user?.id) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/chat/sessions?userId=${user.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setSessions(await res.json());
    } catch {}
  };

  const loadSession = async (id: string) => {
    if (!user?.id) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/chat/session/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const d = await res.json(); setMessages(d.messages || []); setActiveSessionId(id); setTokenUsage({ input:0, output:0 }); setSessionCost(0); }
    } catch {}
  };

  const startNewChat = () => {
    abortRef.current?.abort();
    setActiveSessionId(null); setMessages([]); setInput(''); setStreamingContent('');
    setTokenUsage({ input:0, output:0 }); setSessionCost(0);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    const token = await getToken();
    await fetch(`/api/chat/session/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setSessions(p => p.filter(s => s.id !== id));
    if (activeSessionId === id) startNewChat();
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !user?.id) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated); setInput(''); setIsStreaming(true); setStreamingContent('');

    try {
      const token = await getToken();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated.map(m => ({ role: m.role, content: m.content })), userId: user.id, sessionId: activeSessionId }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setMessages(p => [...p, { role: 'assistant', content: '⚠️ Failed to connect. Please try again.' }]);
        setIsStreaming(false); return;
      }

      const reader = res.body.getReader(), decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const e = JSON.parse(line.slice(6));
            if (e.type === 'session') { setActiveSessionId(e.sessionId); setSessions(p => [{ id: e.sessionId, title: e.title, createdAt: Date.now() }, ...p.filter(s => s.id !== e.sessionId)]); }
            if (e.type === 'delta')   { acc += e.content; setStreamingContent(acc); }
            if (e.type === 'done')    { setTokenUsage(p => ({ input: p.input + (e.inputTokens||0), output: p.output + (e.outputTokens||0) })); setSessionCost(p => p + (e.cost||0)); }
            if (e.type === 'error')   { acc += `\n\n⚠️ ${e.message}`; }
          } catch {}
        }
      }
      setMessages(p => [...p, { role: 'assistant', content: acc }]);
      setStreamingContent('');
    } catch (err: any) {
      if (err.name !== 'AbortError') setMessages(p => [...p, { role: 'assistant', content: '⚠️ Connection lost. Please try again.' }]);
    } finally { setIsStreaming(false); }
  }, [input, isStreaming, messages, activeSessionId, user?.id, getToken]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const groups = groupByDate(sessions);
  const groupOrder = ['Today', 'Yesterday', 'This week', 'Older'];
  const activeTitle = sessions.find(s => s.id === activeSessionId)?.title;

  // ── Render ─────────────────────────────────────────────────────
  // Parent (main-scroll in App.tsx) already has background: #22C9E8 (teal)
  // We just need to fill the height and lay out the sidebar + white card
  return (
    <div
      className="flex overflow-hidden"
      style={{ height: '100dvh', fontFamily: "'Comfortaa', sans-serif" }}
    >
      {/* ── Dark Sidebar ──────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            key="sb"
            initial={{ width: 0, opacity: 0 }} animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="flex-shrink-0 overflow-hidden"
            style={{ background: '#0D1117', borderRight: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex flex-col h-full w-[260px]">
              {/* Logo row */}
              <div className="flex items-center justify-between px-4 pt-5 pb-3">
                <span className="font-black text-sm" style={{ color: '#22C9E8' }}>
                  hum<span style={{ color: '#FF6619' }}>φ</span> chat
                </span>
                <button onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-white/10 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <ChevronLeft size={15} />
                </button>
              </div>

              {/* New Chat button */}
              <div className="px-3 pb-3">
                <button onClick={startNewChat}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: '#FF6619' }}>
                  <Plus size={15} /> New Chat
                </button>
              </div>

              {/* Session list */}
              <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
                {groupOrder.map(label => {
                  const group = groups[label];
                  if (!group?.length) return null;
                  return (
                    <div key={label}>
                      <p className="px-2 mb-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                      <div className="space-y-0.5">
                        {group.map(s => (
                          <button key={s.id} onClick={() => loadSession(s.id)}
                            className="group w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs transition-colors"
                            style={{ background: activeSessionId === s.id ? 'rgba(34,201,232,0.15)' : 'transparent', color: activeSessionId === s.id ? '#fff' : 'rgba(255,255,255,0.5)' }}
                          >
                            <MessageSquare size={12} className="shrink-0 opacity-50" />
                            <span className="flex-1 truncate">{s.title}</span>
                            <span onClick={(e: any) => deleteSession(s.id, e)}
                              className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:text-red-400 transition-all cursor-pointer">
                              <Trash2 size={11} />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {sessions.length === 0 && (
                  <p className="text-xs text-center mt-8 px-4" style={{ color: 'rgba(255,255,255,0.2)', lineHeight: 1.7 }}>
                    Your conversations<br />will appear here.
                  </p>
                )}
              </div>

              {/* Model badge */}
              <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(34,201,232,0.08)', border: '1px solid rgba(34,201,232,0.15)' }}>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black shrink-0"
                    style={{ background: 'linear-gradient(135deg,#22C9E8,#0AABCA)', color: '#0D1117' }}>φ</div>
                  <div>
                    <p className="text-[10px] font-black text-white leading-none">HumPhi 4 31B ✦</p>
                    <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>by Humphi</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main area — white card on teal (teal comes from parent) ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-4">
        {/* White rounded card */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-2xl shadow-xl" style={{ background: '#ffffff' }}>

          {/* Top bar */}
          <div className="shrink-0 flex items-center gap-3 px-5 py-3"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#ffffff' }}>
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-xl hover:bg-black/5 transition-colors"
                style={{ color: 'rgba(0,0,0,0.3)' }}>
                <ChevronRight size={15} />
              </button>
            )}
            <div className="flex-1 min-w-0">
              {activeTitle
                ? <p className="text-sm font-bold truncate" style={{ color: '#0D1117' }}>{activeTitle}</p>
                : <p className="text-sm font-semibold" style={{ color: 'rgba(0,0,0,0.3)' }}>New conversation</p>
              }
            </div>
            {(tokenUsage.input + tokenUsage.output > 0) && (
              <div className="flex items-center gap-3 text-[11px] font-bold" style={{ color: 'rgba(0,0,0,0.35)' }}>
                <span>{(tokenUsage.input + tokenUsage.output).toLocaleString()} tok</span>
                <span style={{ color: '#FF6619' }}>${sessionCost.toFixed(4)}</span>
              </div>
            )}
            <button onClick={startNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: '#FF6619' }}>
              <Plus size={13} /> New
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4" style={{ background: '#F4F9FA' }}>
            {messages.length === 0 && !isStreaming && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full text-center py-24 gap-5">
                <div className="w-16 h-16 rounded-[22px] flex items-center justify-center text-2xl font-black shadow-lg text-white"
                  style={{ background: 'linear-gradient(135deg,#22C9E8,#0AABCA)' }}>φ</div>
                <div>
                  <p className="text-xl font-black mb-2" style={{ color: '#0D1117' }}>How can I help you?</p>
                  <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'rgba(0,0,0,0.4)' }}>
                    Ask me anything — code, analysis, writing, or just a chat.
                  </p>
                </div>
              </motion.div>
            )}

            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className={cn('group relative flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div className="relative max-w-[80%]">
                  <div
                    className="px-4 py-3 rounded-2xl text-sm shadow-sm"
                    style={msg.role === 'user'
                      ? { background: '#FF6619', borderRadius: '18px 18px 4px 18px' }
                      : { background: '#ffffff', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '18px 18px 18px 4px' }
                    }
                  >
                    <MessageContent content={msg.content} isUser={msg.role === 'user'} />
                  </div>
                  <MessageActions
                    content={msg.content}
                    isUser={msg.role === 'user'}
                    onDelete={() => setMessages(p => p.filter((_, j) => j !== i))}
                  />
                </div>
              </motion.div>
            ))}

            {/* Streaming */}
            {isStreaming && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                <div className="max-w-[80%] px-4 py-3 rounded-2xl text-sm shadow-sm"
                  style={{ background: '#ffffff', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '18px 18px 18px 4px' }}>
                  {streamingContent
                    ? <MessageContent content={streamingContent} isUser={false} />
                    : (
                      <div className="flex items-center gap-1.5 py-0.5">
                        {[0,1,2].map(idx => (
                          <div key={idx} className="w-2 h-2 rounded-full animate-bounce"
                            style={{ background: '#22C9E8', animationDelay: `${idx*0.15}s` }} />
                        ))}
                      </div>
                    )
                  }
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)', background: '#ffffff' }}>
            <div className="flex items-end gap-3 px-3 py-2.5 rounded-2xl"
              style={{ background: '#F1F5F9', border: '1.5px solid rgba(0,0,0,0.09)' }}>
              <textarea
                ref={inputRef} rows={1} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message HumPhi…"
                disabled={isStreaming}
                className="flex-1 bg-transparent resize-none focus:outline-none leading-relaxed min-h-[22px] disabled:opacity-50"
                style={{ fontSize: 14, color: '#0D1117', maxHeight: 160 }}
              />
              <button onClick={sendMessage} disabled={!input.trim() || isStreaming}
                className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30 active:scale-95"
                style={{ background: input.trim() && !isStreaming ? '#FF6619' : 'rgba(255,102,25,0.2)' }}>
                {isStreaming
                  ? <Loader2 size={16} className="text-white animate-spin" />
                  : <Send size={16} className="text-white" />
                }
              </button>
            </div>
            <p className="text-center mt-2 text-[10px]" style={{ color: 'rgba(0,0,0,0.25)' }}>
              HumPhi can make mistakes. Verify important information.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
