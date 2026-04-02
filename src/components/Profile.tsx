import React, { useState, useEffect } from 'react';
import { useUser, UserProfile } from '@clerk/clerk-react';
import { User, Mail, Shield, ChevronRight, CheckCircle2, Loader2, LogOut } from 'lucide-react';
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
        <Loader2 size={24} className="animate-spin" style={{ color: '#bdc8cc' }} />
        <p style={{ color: '#6e797c', fontSize: '0.875rem', fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
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
          color: '#6e797c',
          fontFamily: "'Comfortaa', system-ui, sans-serif",
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

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 700, margin: '0 auto' }}>
      {/* ── Page Header ─────────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontFamily: "'Comfortaa', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: '1.5rem',
            color: '#1d1c15',
            marginBottom: '0.25rem',
          }}
        >
          Settings
        </h1>
        <p style={{ color: '#3e494c', fontSize: '0.875rem' }}>
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
            className="btn-ghost"
            style={{ fontSize: '0.8125rem' }}
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
              background: 'var(--gradient-primary)',
              padding: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                background: 'rgba(255,255,255,0.15)',
                border: '2px solid rgba(255,255,255,0.3)',
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
                <User size={32} color="rgba(255,255,255,0.6)" />
              )}
            </div>
            <div>
              <h2
                style={{
                  fontFamily: "'Comfortaa', system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: '1.25rem',
                  color: '#ffffff',
                  marginBottom: '0.25rem',
                }}
              >
                {user.fullName || user.username || email || 'User'}
              </h2>
              <span
                className="badge"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  fontSize: '0.65rem',
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
              border: '1px solid rgba(189,200,204,0.2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '0.625rem 1.25rem',
                background: '#f8f3e7',
                borderBottom: '1px solid rgba(189,200,204,0.2)',
              }}
            >
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  color: '#6e797c',
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
                borderBottom: '1px solid rgba(189,200,204,0.15)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: 'rgba(0,104,121,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#006879',
                  }}
                >
                  <Mail size={16} />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#6e797c',
                      marginBottom: '0.125rem',
                    }}
                  >
                    Email Address
                  </p>
                  <p
                    style={{
                      fontFamily: "'Comfortaa', system-ui, sans-serif",
                      fontSize: '0.875rem',
                      color: '#1d1c15',
                      fontWeight: 500,
                    }}
                  >
                    {email}
                  </p>
                </div>
              </div>
              {user.primaryEmailAddress?.verification.status === 'verified' && (
                <CheckCircle2 size={16} color="#006879" />
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
                    background: 'rgba(0,104,121,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#006879',
                  }}
                >
                  <User size={16} />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#6e797c',
                      marginBottom: '0.125rem',
                    }}
                  >
                    User ID
                  </p>
                  <p
                    style={{
                      fontSize: '0.7rem',
                      fontFamily: 'monospace',
                      color: '#3e494c',
                      wordBreak: 'break-all',
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
              background: '#f8f3e7',
              border: '1px solid rgba(189,200,204,0.2)',
              overflow: 'hidden',
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
                borderBottom: '1px solid rgba(189,200,204,0.2)',
                cursor: 'pointer',
                fontFamily: "'Comfortaa', system-ui, sans-serif",
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ede8dc')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Shield size={16} color="#006879" />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1d1c15' }}>
                  Manage Account Settings
                </span>
              </div>
              <ChevronRight size={16} color="#bdc8cc" />
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
                fontFamily: "'Comfortaa', system-ui, sans-serif",
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ede8dc')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ChevronRight
                  size={16}
                  color="#006879"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1d1c15' }}>
                  Wallet & Billing
                </span>
              </div>
              <ChevronRight size={16} color="#bdc8cc" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
