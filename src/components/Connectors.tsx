import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Mail, FileText, MessageSquare, HardDrive, Calendar, Github,
  CheckCircle2, Plus, ExternalLink, Zap
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────── */
interface Connector {
  id: string;
  name: string;
  description: string;
  icon: React.FC<any>;
  iconColor: string;
  iconBg: string;
  badge?: 'POPULAR' | 'CONNECTED' | 'NEW';
  connected: boolean;
}

/* ── Connector Card ─────────────────────────────────────── */
function ConnectorCard({ connector, onToggle }: { connector: Connector; onToggle: (id: string) => void }) {
  const Icon = connector.icon;

  const badgeStyle: Record<string, React.CSSProperties> = {
    POPULAR: { background: '#0D1117', color: '#FFD60A' },
    CONNECTED: { background: '#22C9E8', color: '#0D1117' },
    NEW: { background: '#FF6619', color: '#ffffff' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: '#ffffff',
        borderRadius: '12px',
        padding: '1.75rem',
        boxShadow: '0 4px 24px rgba(13,17,23,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        position: 'relative',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(13,17,23,0.14)' } as any}
    >
      {/* Badge */}
      {connector.badge && (
        <span
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            padding: '0.25rem 0.7rem',
            borderRadius: '999px',
            fontSize: '0.6rem',
            fontWeight: 800,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            ...badgeStyle[connector.badge],
          }}

        >
          {connector.badge}
        </span>
      )}

      {/* Icon */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          background: connector.iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: connector.iconColor,
        }}
      >
        <Icon size={22} />
      </div>

      {/* Name */}
      <div>
        <h3
          style={{
            fontWeight: 800,
            fontSize: '1.0625rem',
            color: '#0D1117',
            marginBottom: '0.5rem',
            letterSpacing: '-0.02em',
          }}
        >
          {connector.name}
        </h3>
        <p
          style={{
            fontSize: '0.875rem',
            color: '#4a6070',
            lineHeight: 1.6,
            fontWeight: 500,
          }}
        >
          {connector.description}
        </p>

      </div>

      {/* Action Button */}
      <button
        onClick={() => onToggle(connector.id)}
        style={{
          marginTop: 'auto',
          padding: '0.7rem 1.25rem',
          borderRadius: '999px',
          border: connector.connected ? '2px solid #22C9E8' : 'none',
          background: connector.connected
            ? 'transparent'
            : 'linear-gradient(135deg, #0D1117, #1A2232)',
          color: connector.connected ? '#22C9E8' : '#ffffff',
          fontWeight: 700,
          fontSize: '0.875rem',
          cursor: 'pointer',

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          transition: 'all 0.18s',
        }}
      >
        {connector.connected ? (
          <>
            <CheckCircle2 size={15} />
            Manage Connection
          </>
        ) : (
          <>
            <Plus size={15} />
            Connect
          </>
        )}
      </button>
    </motion.div>
  );
}

/* ── Main Page ──────────────────────────────────────────── */
const INITIAL_CONNECTORS: Connector[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Let humφ AI draft replies, summarize threads, and organize your inbox with intelligent context.',
    icon: Mail,
    iconColor: '#FF6619',
    iconBg: 'rgba(255,102,25,0.10)',
    badge: 'POPULAR',
    connected: false,
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Sync your knowledge base. humφ can search your pages and append new ideas directly to your workspaces.',
    icon: FileText,
    iconColor: '#0D1117',
    iconBg: 'rgba(13,17,23,0.08)',
    badge: 'CONNECTED',
    connected: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Enable real-time collaboration. humφ can monitor channels and provide instant summaries for missed discussions.',
    icon: MessageSquare,
    iconColor: '#7C3AED',
    iconBg: 'rgba(124,58,237,0.10)',
    connected: false,
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    description: 'Grant access to your documents. humφ reads PDFs, sheets, and slides to provide deeper analytical insights.',
    icon: HardDrive,
    iconColor: '#22C9E8',
    iconBg: 'rgba(34,201,232,0.10)',
    connected: false,
  },
  {
    id: 'outlook',
    name: 'Outlook',
    description: 'Perfect for enterprise users. Manage your calendar and professional emails through a single voice interface.',
    icon: Calendar,
    iconColor: '#0078D4',
    iconBg: 'rgba(0,120,212,0.10)',
    connected: false,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'For the builders. Let humφ track pull requests, summarize code changes, and help with documentation.',
    icon: Github,
    iconColor: '#0D1117',
    iconBg: 'rgba(13,17,23,0.08)',
    badge: 'NEW',
    connected: false,
  },
];

export default function Connectors() {
  const [connectors, setConnectors] = useState<Connector[]>(INITIAL_CONNECTORS);
  const [search, setSearch] = useState('');

  const toggle = (id: string) => {
    setConnectors((prev) =>
      prev.map((c) => (c.id === id ? { ...c, connected: !c.connected, badge: !c.connected ? 'CONNECTED' : undefined } : c))
    );
  };

  const filtered = connectors.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  const connectedCount = connectors.filter((c) => c.connected).length;

  return (
    <div className="p-4 pt-16 md:pt-8 md:p-8" style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* ── Header ───────────────────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
          <h1
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: '1.875rem',
              color: '#0D1117',
              letterSpacing: '-0.03em',
            }}
          >
            Connectors Library
          </h1>
          {connectedCount > 0 && (
            <span
              style={{
                background: 'rgba(34,201,232,0.15)',
                color: '#0D1117',
                fontFamily: "'Comfortaa', system-ui, sans-serif",
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '0.35rem 1rem',
                borderRadius: '999px',
                border: '1.5px solid rgba(34,201,232,0.30)',
              }}
            >
              {connectedCount} connected
            </span>
          )}
        </div>
        <p
          style={{
            fontFamily: "'Comfortaa', system-ui, sans-serif",
            color: '#1A2232',
            fontSize: '1rem',
            fontWeight: 500,
            maxWidth: 560,
            lineHeight: 1.65,
          }}
        >
          Bridge the gap between your world and humφ AI. Seamlessly integrate your favourite tools to give your assistant context and power.
        </p>
      </div>

      {/* ── Search ───────────────────────────────────────── */}
      <div style={{ position: 'relative', marginBottom: '2rem', maxWidth: 420 }}>
        <span
          style={{
            position: 'absolute',
            left: '1rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#7a9aa8',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </span>
        <input
          type="text"
          placeholder="Search connectors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            paddingLeft: '2.5rem',
            paddingRight: '1rem',
            paddingTop: '0.75rem',
            paddingBottom: '0.75rem',
            border: '1.5px solid #E2EBF0',
            borderRadius: '999px',
            background: '#ffffff',
            fontFamily: "'Comfortaa', system-ui, sans-serif",
            fontSize: '0.9rem',
            fontWeight: 500,
            color: '#0D1117',
            outline: 'none',
            boxSizing: 'border-box',
            boxShadow: '0 2px 12px rgba(13,17,23,0.06)',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#22C9E8')}
          onBlur={(e) => (e.target.style.borderColor = '#E2EBF0')}
        />
      </div>

      {/* ── Grid ─────────────────────────────────────────── */}
      <div className="grid grid-connectors" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px,100%), 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        {filtered.map((connector, i) => (
          <motion.div key={connector.id} transition={{ delay: i * 0.06 }}>
            <ConnectorCard connector={connector} onToggle={toggle} />
          </motion.div>
        ))}
      </div>

      {/* ── Custom API Bridge CTA ─────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        style={{
          background: 'linear-gradient(135deg, #0D1117 0%, #1A2232 100%)',
          borderRadius: '16px',
          padding: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.5rem',
          boxShadow: '0 12px 48px rgba(13,17,23,0.30)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            right: '-60px',
            top: '-60px',
            width: 200,
            height: 200,
            background: 'radial-gradient(circle, rgba(34,201,232,0.15) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <span
            style={{
              display: 'inline-block',
              background: 'rgba(34,201,232,0.15)',
              color: '#22C9E8',
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              fontSize: '0.65rem',
              fontWeight: 800,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              marginBottom: '1rem',
              border: '1px solid rgba(34,201,232,0.25)',
            }}
          >
            Coming Soon
          </span>
          <h2
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: '1.5rem',
              color: '#ffffff',
              letterSpacing: '-0.03em',
              marginBottom: '0.75rem',
            }}
          >
            The Custom API Bridge
          </h2>
          <p
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontSize: '0.9375rem',
              color: 'rgba(255,255,255,0.65)',
              maxWidth: 440,
              lineHeight: 1.65,
              fontWeight: 500,
            }}
          >
            Can't find your tool? We're building a secure gateway for you to connect any custom API endpoint. humφ will learn your proprietary data structures automatically.
          </p>
          <button
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.75rem',
              background: 'transparent',
              border: '2px solid rgba(255,255,255,0.25)',
              borderRadius: '999px',
              color: '#ffffff',
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.18s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(34,201,232,0.15)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#22C9E8';
              (e.currentTarget as HTMLButtonElement).style.color = '#22C9E8';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)';
              (e.currentTarget as HTMLButtonElement).style.color = '#ffffff';
            }}
          >
            <ExternalLink size={15} />
            Join Waitlist
          </button>
        </div>

        <div
          className="connector-cta-icon"
          style={{
            position: 'relative',
            zIndex: 1,
            width: 120,
            height: 120,
            background: 'rgba(34,201,232,0.08)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(34,201,232,0.15)',
            flexShrink: 0,
          }}
        >
          <Zap size={52} color="rgba(34,201,232,0.35)" strokeWidth={1.5} />
        </div>
      </motion.div>
    </div>
  );
}
