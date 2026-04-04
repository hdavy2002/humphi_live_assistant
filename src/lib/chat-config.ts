/**
 * Humphi Chat Design System
 * ─────────────────────────
 * Central source of truth for all chat UI styles across the site.
 */

export const CHAT_STYLES = {
  bubble: {
    /** Soft light orange — user messages */
    user:      'bg-[#FFEDD5] text-[#9A3412] font-medium',
    /** Soft light green — AI/assistant messages */
    assistant: 'bg-[#DCFCE7] text-[#14532D] font-medium',
    /** Shared padding + font size */
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
  image: 'h-20 w-auto max-w-[160px] rounded-2xl border-2 border-black/10 object-cover shadow-lg',

  /** Per-message hover action bar */
  actions: {
    wrap:   'absolute -top-9 flex gap-1 bg-white border border-black/10 rounded-2xl px-2 py-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none group-hover:pointer-events-auto',
    button: 'p-1.5 rounded-xl text-black/40 hover:text-black hover:bg-black/5 transition-colors',
  },

  /** Social share menu */
  shareMenu: {
    wrap: 'absolute -top-28 flex flex-col gap-1 bg-white border border-black/10 rounded-2xl p-2 shadow-xl z-30',
    item: 'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-black/70 hover:text-black hover:bg-black/5 transition-colors cursor-pointer whitespace-nowrap',
  },

  /** Chat input field */
  input: [
    'flex-1 bg-white border border-black/10',
    'rounded-2xl px-4 py-2.5',
    'text-sm text-[#0D1117] placeholder:text-black/30',
    'focus:outline-none focus:border-[#22C9E8]',
    'transition-colors shadow-sm',
  ].join(' '),

  /** Chat container backgrounds */
  container: {
    messages: 'flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-3',
    header:   'shrink-0 px-5 py-3 border-b border-black/8 flex items-center gap-3 bg-white',
    footer:   'shrink-0 px-4 md:px-5 py-3 border-t border-black/8 bg-white',
  },

  /** Typing dot indicator */
  typingDot: 'w-2 h-2 bg-[#22C9E8] rounded-full animate-bounce',
};

// ── Helper: export conversation as plain text ──────────────────────
export function formatChatExport(
  messages: { role: string; content: string }[]
): string {
  return messages
    .map(m => `[${m.role === 'user' ? 'You' : 'HumPhi'}]\n${m.content}`)
    .join('\n\n─────────────────────\n\n');
}

// ── Social share helper ────────────────────────────────────────────
export function getShareLinks(text: string) {
  const encoded = encodeURIComponent(text.slice(0, 500));
  return {
    whatsapp: `https://wa.me/?text=${encoded}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=https://humphi.com&quote=${encoded}`,
    twitter:  `https://twitter.com/intent/tweet?text=${encoded}`,
  };
}
