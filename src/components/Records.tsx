import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { History, TrendingUp, TrendingDown, Clock, Loader2, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Transaction } from '../types';

export default function Records() {
  const { user } = useUser();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'topup' | 'usage'>('all');
  const navigate = useNavigate();

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
              fontWeight: 700,
              fontSize: '1.5rem',
              color: '#1d1c15',
              marginBottom: '0.25rem',
            }}
          >
            Transaction History
          </h1>
          <p style={{ color: '#3e494c', fontSize: '0.875rem' }}>
            All your wallet activity in one place.
          </p>
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: 'flex',
            background: '#f2ede2',
            border: '1px solid rgba(189,200,204,0.25)',
            padding: '3px',
            gap: '2px',
          }}
        >
          {(['all', 'topup', 'usage'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '0.4rem 0.875rem',
                background: filter === f ? '#006879' : 'transparent',
                color: filter === f ? '#ffffff' : '#6e797c',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Comfortaa', system-ui, sans-serif",
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'capitalize',
                transition: 'all 0.15s',
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
          <Loader2 size={28} className="animate-spin" style={{ color: '#bdc8cc' }} />
          <p style={{ color: '#6e797c', fontSize: '0.875rem', fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
            Loading transactions...
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: '5rem 1rem',
            textAlign: 'center',
            background: '#f8f3e7',
            border: '1px solid rgba(189,200,204,0.2)',
          }}
        >
          <History size={36} style={{ margin: '0 auto 1rem', color: '#bdc8cc' }} />
          <p
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: '0.9375rem',
              color: '#6e797c',
              marginBottom: '0.375rem',
            }}
          >
            No Records
          </p>
          <p style={{ color: '#bdc8cc', fontSize: '0.8125rem' }}>
            {filter === 'all'
              ? 'Your transaction history will appear here.'
              : `No ${filter === 'topup' ? 'top-up' : 'usage'} transactions found.`}
          </p>
        </div>
      ) : (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid rgba(189,200,204,0.2)',
            overflow: 'hidden',
          }}
        >
          {/* Table Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
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
              Transaction
            </span>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: '#6e797c',
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
                  padding: '0.875rem 1.25rem',
                  borderBottom: '1px solid rgba(189,200,204,0.15)',
                  cursor: 'default',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.backgroundColor = '#f8f3e7')}
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
                      background: isCredit ? 'rgba(0,104,121,0.1)' : 'rgba(157,67,0,0.1)',
                      color: isCredit ? '#006879' : '#9d4300',
                      flexShrink: 0,
                    }}
                  >
                    {isCredit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  </div>
                  <div>
                    <p
                      style={{
                        fontFamily: "'Comfortaa', system-ui, sans-serif",
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        color: '#1d1c15',
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
                        color: '#6e797c',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
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
                      fontWeight: 700,
                      fontSize: '0.9375rem',
                      color: isCredit ? '#006879' : '#ba1a1a',
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
                      color: '#bdc8cc',
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
