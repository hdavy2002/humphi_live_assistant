/**
 * Humphi Chat Design System
 * ─────────────────────────
 * Central source of truth for all chat UI styles across the site.
 * Import CHAT_STYLES wherever you render a chat interface so every
 * chat box looks consistent without re-designing from scratch.
 *
 * Usage:
 *   import { CHAT_STYLES, formatChatExport } from '@/lib/chat-config';
 *   <div className={CHAT_STYLES.bubble.user}>...</div>
 */

// ── Bubble styles ───────────────────────────────────────────────────
export const CHAT_STYLES = {
  bubble: {
    /** Solid teal — user messages. Always clearly distinguishable. */
    user:      'bg-[#0E7490] text-white',
    /** Solid navy-blue — AI/assistant messages. */
    assistant: 'bg-[#1D3557] text-white',
    /** Shared padding + base radius */
    base:      'px-4 py-3 text-sm leading-relaxed max-w-[82%]',
    /** Tail directions */
    userRounded:      'rounded-2xl rounded-br-sm',
    assistantRounded: 'rounded-2xl rounded-bl-sm',
  },

  /** Row that wraps a single bubble (controls alignment) */
  row: {
    user:      'flex flex-col items-end gap-1.5',
    assistant: 'flex flex-col items-start gap-1.5',
  },

  /** Image thumbnails attached to messages */
  image: 'h-20 w-auto max-w-[160px] rounded-2xl border-2 border-white/20 object-cover shadow-lg',

  /** Per-message hover action bar (copy / forward / delete) */
  actions: {
    wrap:    'absolute -top-8 flex gap-1 bg-[#0a0f1a] border border-white/10 rounded-xl px-2 py-1.5 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none group-hover:pointer-events-auto',
    button:  'p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors',
  },

  /** Chat input field */
  input: [
    'flex-1 bg-[#1A2232] border border-white/20',
    'rounded-2xl px-4 py-2.5',
    'text-sm text-white placeholder:text-white/40',
    'focus:outline-none focus:border-[#22C9E8]/50',
    'transition-colors',
  ].join(' '),

  /** Chat container backgrounds */
  container: {
    messages: 'flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-3',
    header:   'shrink-0 px-4 py-2 border-b border-white/10 flex items-center gap-3 bg-[#0D1117]/95 backdrop-blur-md',
    footer:   'shrink-0 px-4 md:px-5 py-3 border-t border-white/10 bg-[#0D1117]/95 backdrop-blur-md',
  },

  /** Loading typing indicator */
  typingDot: 'w-2 h-2 bg-[#22C9E8]/60 rounded-full animate-bounce',
};

// ── Helper: export conversation as plain text ──────────────────────
export function formatChatExport(
  messages: { role: string; content: string }[]
): string {
  return messages
    .map(m => `[${m.role === 'user' ? 'You' : 'HumPhi'}]\n${m.content}`)
    .join('\n\n─────────────────────\n\n');
}
