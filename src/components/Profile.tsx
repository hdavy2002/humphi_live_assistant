import React, { useState, useEffect } from 'react';
import { useUser, UserProfile } from '@clerk/clerk-react';
import { User, Mail, Shield, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, isLoaded } = useUser();
  const [email, setEmail] = useState('');
  const [showClerkProfile, setShowClerkProfile] = useState(false);
  const navigate = useNavigate();

  /* ── Auth state — UNCHANGED ── */
  useEffect(() => {
    if (user) {
      setEmail(user.primaryEmailAddress?.emailAddress || '');
    }
  }, [user]);

  if (!isLoaded)
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <Loader2 size={24} className="animate-spin" style={{ color: '#22C9E8' }} />
        <p style={{ color: '#7a9aa8', fontSize: '0.9rem', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
          Loading profile...
        </p>
      </div>
    );

  if (!user)
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#7a9aa8',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        Please sign in to view your profile.
      </div>
    );

  /* ── Trigger update — UNCHANGED ── */
  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setShowClerkProfile(true);
  };
  void handleUpdate; // suppress unused warning

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 700, margin: '0 auto' }}>
      {/* ── Page Header ─────────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontFamily: "'Sora', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: '1.875rem',
            color: '#0D1117',
            marginBottom: '0.25rem',
            letterSpacing: '-0.03em',
          }}
        >
          Settings
        </h1>
        <p style={{ color: '#1A2232', fontSize: '1rem', fontWeight: 500, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
          Manage your account and preferences.
        </p>
      </div>

      {showClerkProfile ? (
        /* ── Clerk Full Profile ─────────────────────── */
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}
        >
          <UserProfile routing="hash" />
          <button
            onClick={() => setShowClerkProfile(false)}
            className="btn-secondary"
            style={{ fontSize: '0.875rem' }}
          >
            ← Back to Summary
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
        >
          {/* ── Profile Card ────────────────────────── */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0D1117 0%, #1A2232 100%)',
              padding: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              boxShadow: '0 8px 40px rgba(13,17,23,0.25)',
              borderRadius: '12px',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                background: 'rgba(34,201,232,0.12)',
                border: '2px solid rgba(34,201,232,0.30)',
                borderRadius: '9999px',
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt="Profile"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <User size={32} color="#22C9E8" />
              )}
            </div>
            <div>
              <h2
                style={{
                  fontFamily: "'Sora', system-ui, sans-serif",
                  fontWeight: 800,
                  fontSize: '1.375rem',
                  color: '#ffffff',
                  marginBottom: '0.4rem',
                  letterSpacing: '-0.02em',
                }}
              >
                {user.fullName || user.username || email || 'User'}
              </h2>
              <span
                className="badge"
                style={{
                  background: 'rgba(34,201,232,0.15)',
                  color: '#22C9E8',
                  fontSize: '0.65rem',
                  border: '1px solid rgba(34,201,232,0.25)',
                }}
              >
                <Shield size={10} />
                Premium Plan
              </span>
            </div>
          </div>

          {/* ── Account Info ────────────────────────── */}
          <div
            style={{
              background: '#ffffff',
              boxShadow: '0 4px 24px rgba(13,17,23,0.08)',
              overflow: 'hidden',
              borderRadius: '12px',
            }}
          >
            {/* Section header */}
            <div
              style={{
                padding: '0.75rem 1.25rem',
                background: '#0D1117',
                borderBottom: '1px solid rgba(34,201,232,0.12)',
              }}
            >
              <span
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.09em',
                  color: 'rgba(255,255,255,0.40)',
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                }}
              >
                Account Information
              </span>
            </div>

            {/* Email Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                borderBottom: '1px solid #EEF4F7',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: 'rgba(34,201,232,0.10)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#22C9E8',
                    borderRadius: '8px',
                  }}
                >
                  <Mail size={16} />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      color: '#7a9aa8',
                      marginBottom: '0.125rem',
                      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                    }}
                  >
                    Email Address
                  </p>
                  <p
                    style={{
                      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                      fontSize: '0.9375rem',
                      color: '#0D1117',
                      fontWeight: 600,
                    }}
                  >
                    {email}
                  </p>
                </div>
              </div>
              {user.primaryEmailAddress?.verification.status === 'verified' && (
                <CheckCircle2 size={16} color="#22C9E8" />
              )}
            </div>

            {/* User ID Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '1rem 1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: 'rgba(34,201,232,0.10)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#22C9E8',
                    borderRadius: '8px',
                  }}
                >
                  <User size={16} />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      color: '#7a9aa8',
                      marginBottom: '0.125rem',
                      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                    }}
                  >
                    User ID
                  </p>
                  <p
                    style={{
                      fontSize: '0.7rem',
                      fontFamily: 'monospace',
                      color: '#1A2232',
                      wordBreak: 'break-all',
                      fontWeight: 500,
                    }}
                  >
                    {user.id}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Actions ─────────────────────────────── */}
          <div
            style={{
              background: '#ffffff',
              boxShadow: '0 4px 24px rgba(13,17,23,0.08)',
              overflow: 'hidden',
              borderRadius: '12px',
            }}
          >
            <button
              onClick={() => setShowClerkProfile(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #EEF4F7',
                cursor: 'pointer',
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F7FAFC')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Shield size={16} color="#22C9E8" />
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0D1117' }}>
                  Manage Account Settings
                </span>
              </div>
              <ChevronRight size={16} color="#94a3b8" />
            </button>

            <button
              onClick={() => navigate('/wallet')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F7FAFC')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ChevronRight
                  size={16}
                  color="#22C9E8"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0D1117' }}>
                  Wallet & Billing
                </span>
              </div>
              <ChevronRight size={16} color="#94a3b8" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
