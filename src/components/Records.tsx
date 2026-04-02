import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { History, TrendingUp, TrendingDown, Clock, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Transaction } from '../types';

export default function Records() {
  const { user } = useUser();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'topup' | 'usage'>('all');

  /* ── Data fetching — UNCHANGED ── */
  useEffect(() => {
    if (user) fetchTransactions();
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/wallet/transactions?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setTransactions(Array.isArray(data) ? data : data.transactions || []);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = transactions.filter((tx) => {
    if (filter === 'all') return true;
    if (filter === 'topup') return tx.type === 'topup' || tx.type === 'TOP_UP';
    return tx.type !== 'topup' && tx.type !== 'TOP_UP';
  });

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 800, margin: '0 auto' }}>
      {/* ── Page Header ───────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: '1.875rem',
              color: '#0D1117',
              marginBottom: '0.25rem',
              letterSpacing: '-0.03em',
            }}
          >
            Transaction History
          </h1>
          <p style={{ color: '#1A2232', fontSize: '1rem', fontWeight: 500, fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
            All your wallet activity in one place.
          </p>
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: 'flex',
            background: '#0D1117',
            border: '1.5px solid rgba(34,201,232,0.20)',
            padding: '3px',
            gap: '2px',
            borderRadius: '12px',
          }}
        >
          {(['all', 'topup', 'usage'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.4rem 0.9rem',
                background: filter === f ? '#22C9E8' : 'transparent',
                color: filter === f ? '#0D1117' : 'rgba(255,255,255,0.50)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Comfortaa', system-ui, sans-serif",
                fontSize: '0.8125rem',
                fontWeight: 700,
                textTransform: 'capitalize',
                transition: 'all 0.15s',
                borderRadius: '9px',
              }}
            >
              {f === 'all' ? 'All' : f === 'topup' ? 'Top-ups' : 'Usage'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────── */}
      {loading ? (
        <div
          style={{
            padding: '5rem 1rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <Loader2 size={28} className="animate-spin" style={{ color: '#22C9E8' }} />
          <p style={{ color: '#7a9aa8', fontSize: '0.9rem', fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
            Loading transactions...
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: '5rem 1rem',
            textAlign: 'center',
            background: '#ffffff',
            boxShadow: '0 4px 24px rgba(13,17,23,0.08)',
            borderRadius: '12px',
          }}
        >
          <History size={36} style={{ margin: '0 auto 1rem', color: '#E2EBF0' }} />
          <p
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: '1rem',
              color: '#0D1117',
              marginBottom: '0.375rem',
            }}
          >
            No Records
          </p>
          <p style={{ color: '#7a9aa8', fontSize: '0.875rem', fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
            {filter === 'all'
              ? 'Your transaction history will appear here.'
              : `No ${filter === 'topup' ? 'top-up' : 'usage'} transactions found.`}
          </p>
        </div>
      ) : (
        <div
          style={{
            background: '#ffffff',
            boxShadow: '0 4px 24px rgba(13,17,23,0.08)',
            overflow: 'hidden',
            borderRadius: '12px',
          }}
        >
          {/* Table Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
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
                fontFamily: "'Comfortaa', system-ui, sans-serif",
              }}
            >
              Transaction
            </span>
            <span
              style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.09em',
                color: 'rgba(255,255,255,0.40)',
                fontFamily: "'Comfortaa', system-ui, sans-serif",
              }}
            >
              Amount
            </span>
          </div>

          {/* Rows */}
          {filtered.map((tx, idx) => {
            const isCredit = tx.type === 'topup' || tx.type === 'TOP_UP';
            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid #EEF4F7',
                  cursor: 'default',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.backgroundColor = '#F7FAFC')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.backgroundColor = '')}
              >
                {/* Left */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isCredit ? 'rgba(34,201,232,0.10)' : 'rgba(255,102,25,0.10)',
                      color: isCredit ? '#22C9E8' : '#FF6619',
                      flexShrink: 0,
                      borderRadius: '8px',
                    }}
                  >
                    {isCredit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  </div>
                  <div>
                    <p
                      style={{
                        fontFamily: "'Comfortaa', system-ui, sans-serif",
                        fontWeight: 600,
                        fontSize: '0.9375rem',
                        color: '#0D1117',
                        marginBottom: '0.2rem',
                      }}
                    >
                      {isCredit ? 'Wallet Top-up' : 'Usage Charge'}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        color: '#7a9aa8',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        fontFamily: "'Comfortaa', system-ui, sans-serif",
                      }}
                    >
                      <Clock size={10} />
                      <span>
                        {new Date(tx.created_at).toLocaleDateString()}{' '}
                        {new Date(tx.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right */}
                <div style={{ textAlign: 'right' }}>
                  <p
                    style={{
                      fontFamily: "'Comfortaa', system-ui, sans-serif",
                      fontWeight: 800,
                      fontSize: '1rem',
                      color: isCredit ? '#22C9E8' : '#FF6619',
                    }}
                  >
                    {isCredit ? '+' : '-'}${tx.amount.toFixed(2)}
                  </p>
                  <span
                    style={{
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: '#C2D4DC',
                      fontFamily: "'Comfortaa', system-ui, sans-serif",
                    }}
                  >
                    {tx.status}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
