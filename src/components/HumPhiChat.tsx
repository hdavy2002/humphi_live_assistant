import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, MessageSquare, Trash2, Copy, Check, Share2,
  Send, ChevronLeft, ChevronRight, Menu, X, Loader2,
  Download,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { CHAT_STYLES, getShareLinks } from '../lib/chat-config';
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

// ── Code block renderer with sticky copy button ─────────────────────
function CodeBlock({ language, children }: { language?: string; children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-white/10 bg-[#0D1117]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] text-white/90 leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}

// ── Markdown renderer using code block component ────────────────────
function MessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        code({ node, className, children, ...props }: any) {
          const isInline = !className;
          const language = className?.replace('language-', '') || '';
          if (isInline) {
            return (
              <code
                className="px-1.5 py-0.5 rounded-md bg-black/30 text-[#22C9E8] text-xs font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <CodeBlock language={language}>
              {String(children).replace(/\n$/, '')}
            </CodeBlock>
          );
        },
        p({ children }) { return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>; },
        ul({ children }) { return <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>; },
        ol({ children }) { return <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>; },
        li({ children }) { return <li className="leading-relaxed">{children}</li>; },
        strong({ children }) { return <strong className="font-bold text-white">{children}</strong>; },
        h1({ children }) { return <h1 className="text-xl font-bold mb-2 mt-3">{children}</h1>; },
        h2({ children }) { return <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>; },
        h3({ children }) { return <h3 className="text-base font-semibold mb-1.5 mt-2">{children}</h3>; },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── Per-message action bar ──────────────────────────────────────────
function MessageActions({
  content,
  onDelete,
}: {
  content: string;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const links = getShareLinks(content);

  return (
    <div className={CHAT_STYLES.actions.wrap}>
      {/* Copy */}
      <button onClick={handleCopy} className={CHAT_STYLES.actions.button} title="Copy">
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>

      {/* Share */}
      <div className="relative">
        <button
          onClick={() => setShareOpen(v => !v)}
          className={CHAT_STYLES.actions.button}
          title="Share"
        >
          <Share2 size={13} />
        </button>

        <AnimatePresence>
          {shareOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 4 }}
              transition={{ duration: 0.12 }}
              className={CHAT_STYLES.shareMenu.wrap}
              onMouseLeave={() => setShareOpen(false)}
            >
              <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={CHAT_STYLES.shareMenu.item}>
                <span className="text-[#25D366] text-base leading-none">●</span> WhatsApp
              </a>
              <a href={links.facebook} target="_blank" rel="noopener noreferrer" className={CHAT_STYLES.shareMenu.item}>
                <span className="text-[#1877F2] text-base leading-none">●</span> Facebook
              </a>
              <a href={links.twitter} target="_blank" rel="noopener noreferrer" className={CHAT_STYLES.shareMenu.item}>
                <span className="text-white text-base leading-none">✕</span> X / Twitter
              </a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Delete */}
      <button onClick={onDelete} className={cn(CHAT_STYLES.actions.button, 'hover:text-red-400')} title="Delete">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Sidebar session group helper ────────────────────────────────────
function groupByDate(sessions: ChatSession[]): Record<string, ChatSession[]> {
  const now = Date.now();
  const DAY = 86_400_000;
  const groups: Record<string, ChatSession[]> = {};

  for (const s of sessions) {
    const diff = now - s.createdAt;
    let label: string;
    if (diff < DAY) label = 'Today';
    else if (diff < 2 * DAY) label = 'Yesterday';
    else if (diff < 7 * DAY) label = 'This week';
    else label = 'Older';
    (groups[label] = groups[label] || []).push(s);
  }
  return groups;
}

// ── Main component ──────────────────────────────────────────────────
export default function HumPhiChat() {
  const { user } = useUser();
  const { getToken } = useAuth();

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // Token/cost tracking
  const [tokenUsage, setTokenUsage] = useState({ input: 0, output: 0 });
  const [sessionCost, setSessionCost] = useState(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const abortRef  = useRef<AbortController | null>(null);

  // ── Load sessions on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    loadSessions();
  }, [user?.id]);

  // ── Auto-scroll ────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // ── Auto-resize textarea ───────────────────────────────────────────
  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = 'auto';
    inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px';
  }, [input]);

  const loadSessions = async () => {
    if (!user?.id) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/chat/sessions?userId=${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) setSessions(await res.json());
    } catch {}
  };

  const loadSession = async (sessionId: string) => {
    if (!user?.id) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/chat/session/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setActiveSessionId(sessionId);
        setTokenUsage({ input: 0, output: 0 });
        setSessionCost(0);
      }
    } catch {}
  };

  const startNewChat = () => {
    abortRef.current?.abort();
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
    setStreamingContent('');
    setTokenUsage({ input: 0, output: 0 });
    setSessionCost(0);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.id) return;
    try {
      const token = await getToken();
      await fetch(`/api/chat/session/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) startNewChat();
    } catch {}
  };

  const deleteMessage = (index: number) => {
    setMessages(prev => prev.filter((_, i) => i !== index));
  };

  // ── Send message ───────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !user?.id) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);
    setStreamingContent('');

    const payload = updatedMessages.map(m => ({ role: m.role, content: m.content }));

    try {
      const token = await getToken();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: payload,
          userId: user.id,
          sessionId: activeSessionId,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Failed to connect to HumPhi. Please try again.', timestamp: Date.now() }]);
        setIsStreaming(false);
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));

            if (evt.type === 'session') {
              setActiveSessionId(evt.sessionId);
              const newSession: ChatSession = { id: evt.sessionId, title: evt.title, createdAt: Date.now() };
              setSessions(prev => [newSession, ...prev.filter(s => s.id !== evt.sessionId)]);
            }

            if (evt.type === 'delta') {
              accumulated += evt.content;
              setStreamingContent(accumulated);
            }

            if (evt.type === 'done') {
              setTokenUsage(prev => ({
                input:  prev.input  + (evt.inputTokens  || 0),
                output: prev.output + (evt.outputTokens || 0),
              }));
              setSessionCost(prev => prev + (evt.cost || 0));
            }

            if (evt.type === 'error') {
              accumulated += `\n\n⚠️ ${evt.message}`;
            }
          } catch {}
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: accumulated, timestamp: Date.now() }]);
      setStreamingContent('');

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Connection interrupted. Please try again.', timestamp: Date.now() }]);
      }
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, activeSessionId, user?.id, getToken]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Sidebar groups ─────────────────────────────────────────────────
  const sessionGroups = groupByDate(sessions);
  const groupOrder    = ['Today', 'Yesterday', 'This week', 'Older'];

  return (
    <div
      className="flex h-full w-full overflow-hidden"
      style={{ background: '#0D1117', fontFamily: "'Comfortaa', sans-serif" }}
    >
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="flex-shrink-0 flex flex-col overflow-hidden"
            style={{
              background: '#0D1117',
              borderRight: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <div className="flex flex-col h-full w-64">
              {/* Sidebar header */}
              <div className="flex items-center justify-between px-4 pt-5 pb-3">
                <span
                  className="font-black text-sm tracking-tight"
                  style={{ color: '#22C9E8' }}
                >
                  hum<span style={{ color: '#FF6619' }}>φ</span> chat
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
              </div>

              {/* New chat */}
              <div className="px-3 pb-3">
                <button
                  onClick={startNewChat}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-colors hover:bg-white/10"
                  style={{ color: '#FF6619', border: '1px solid rgba(255,102,25,0.25)' }}
                >
                  <Plus size={15} />
                  New Chat
                </button>
              </div>

              {/* Session list */}
              <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
                {groupOrder.map(label => {
                  const group = sessionGroups[label];
                  if (!group?.length) return null;
                  return (
                    <div key={label}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 px-2 mb-1.5">
                        {label}
                      </p>
                      <div className="space-y-0.5">
                        {group.map(session => (
                          <button
                            key={session.id}
                            onClick={() => loadSession(session.id)}
                            className={cn(
                              'group w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm transition-colors',
                              activeSessionId === session.id
                                ? 'bg-[#22C9E8]/15 text-white'
                                : 'text-white/60 hover:text-white hover:bg-white/8'
                            )}
                          >
                            <MessageSquare size={13} className="shrink-0 opacity-60" />
                            <span className="flex-1 truncate text-xs leading-snug">{session.title}</span>
                            <button
                              onClick={(e) => deleteSession(session.id, e)}
                              className="shrink-0 opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:text-red-400 transition-all"
                            >
                              <Trash2 size={11} />
                            </button>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {sessions.length === 0 && (
                  <p className="text-xs text-white/20 text-center mt-8 px-4">
                    Your conversations will appear here.
                  </p>
                )}
              </div>

              {/* Sidebar footer — model badge */}
              <div className="px-4 py-3 border-t border-white/7">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(34,201,232,0.07)', border: '1px solid rgba(34,201,232,0.15)' }}
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-black shrink-0"
                    style={{ background: 'linear-gradient(135deg, #22C9E8, #0AABCA)', color: '#0D1117' }}
                  >
                    φ
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-white leading-none">HumPhi 4 31B ✦</p>
                    <p className="text-[9px] text-white/30 mt-0.5">by Humphi</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main chat area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <div
          className="shrink-0 flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: '#0D1117' }}
        >
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          )}

          <div className="flex-1 min-w-0">
            {activeSessionId && sessions.find(s => s.id === activeSessionId) ? (
              <p className="text-sm font-semibold text-white truncate">
                {sessions.find(s => s.id === activeSessionId)?.title}
              </p>
            ) : (
              <p className="text-sm font-semibold text-white/40">New conversation</p>
            )}
          </div>

          {/* Token stats */}
          {(tokenUsage.input + tokenUsage.output > 0) && (
            <div className="flex items-center gap-3 text-[10px] font-bold text-white/40">
              <span>{(tokenUsage.input + tokenUsage.output).toLocaleString()} tok</span>
              <span style={{ color: '#FF6619' }}>${sessionCost.toFixed(4)}</span>
            </div>
          )}

          <button
            onClick={startNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors hover:bg-white/10"
            style={{ color: '#FF6619', border: '1px solid rgba(255,102,25,0.2)' }}
          >
            <Plus size={13} />
            New
          </button>
        </div>

        {/* Messages */}
        <div className={CHAT_STYLES.container.messages} style={{ background: '#0D1117' }}>
          {messages.length === 0 && !isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center py-24 gap-5"
            >
              <div
                className="w-16 h-16 rounded-[22px] flex items-center justify-center text-2xl font-black shadow-2xl"
                style={{ background: 'linear-gradient(135deg, #22C9E8, #0AABCA)', color: '#0D1117' }}
              >
                φ
              </div>
              <div>
                <p className="text-xl font-black text-white mb-2">How can I help you?</p>
                <p className="text-sm text-white/40 max-w-xs">
                  Ask me anything — code, analysis, writing, or just a chat.
                </p>
              </div>
            </motion.div>
          )}

          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={cn('group relative', CHAT_STYLES.row[msg.role])}
            >
              <div
                className={cn(
                  CHAT_STYLES.bubble.base,
                  msg.role === 'user'
                    ? cn(CHAT_STYLES.bubble.user, CHAT_STYLES.bubble.userRounded)
                    : cn(CHAT_STYLES.bubble.assistant, CHAT_STYLES.bubble.assistantRounded),
                  'text-sm'
                )}
              >
                <MessageContent content={msg.content} />
              </div>

              {/* Action bar */}
              <MessageActions
                content={msg.content}
                onDelete={() => deleteMessage(i)}
              />
            </motion.div>
          ))}

          {/* Streaming bubble */}
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('group relative', CHAT_STYLES.row.assistant)}
            >
              <div
                className={cn(
                  CHAT_STYLES.bubble.base,
                  CHAT_STYLES.bubble.assistant,
                  CHAT_STYLES.bubble.assistantRounded,
                  'text-sm'
                )}
              >
                {streamingContent ? (
                  <MessageContent content={streamingContent} />
                ) : (
                  <div className="flex items-center gap-1.5 py-0.5">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className={CHAT_STYLES.typingDot}
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div
          className={CHAT_STYLES.container.footer}
          style={{ background: '#0D1117', borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="flex items-end gap-3 p-3 rounded-2xl"
            style={{ background: '#1A2232', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message HumPhi…"
              disabled={isStreaming}
              className={cn(
                'flex-1 bg-transparent resize-none text-sm text-white placeholder:text-white/30',
                'focus:outline-none leading-relaxed min-h-[20px]',
                'disabled:opacity-50'
              )}
              style={{ maxHeight: 160 }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              className={cn(
                'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all',
                'disabled:opacity-30 disabled:cursor-not-allowed'
              )}
              style={{ background: input.trim() && !isStreaming ? '#FF6619' : 'rgba(255,102,25,0.2)' }}
            >
              {isStreaming
                ? <Loader2 size={16} className="text-white animate-spin" />
                : <Send size={16} className="text-white" />
              }
            </button>
          </div>
          <p className="text-center text-[10px] text-white/20 mt-2">
            HumPhi can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}
