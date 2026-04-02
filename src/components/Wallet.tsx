import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
  Wallet as WalletIcon, CreditCard, Plus, History,
  AlertCircle, Loader2, ChevronRight, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

/* ── Initialize Stripe (unchanged) ────────────────────────── */
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

/* ──────────────────────────────────────────────────────────
   CHECKOUT FORM (Stripe Elements) — logic unchanged
   ──────────────────────────────────────────────────────────*/
function CheckoutForm({
  clientSecret,
  paymentIntentId,
  onCancel,
  onSuccess,
}: {
  clientSecret: string;
  paymentIntentId: string;
  onCancel: () => void;
  onSuccess: (newBalance: number) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Payment submission — UNCHANGED ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'An error occurred');
      setLoading(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        const response = await fetch('/api/verify-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId }),
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          setError(data.error || `Verification failed (${response.status})`);
        } else if (data.success) {
          onSuccess(data.newBalance);
        } else {
          setError('Unexpected response from server.');
        }
      } catch {
        setError('Payment confirmed but balance update failed. Please contact support.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Stripe Payment Element */}
      <div
        style={{
          background: '#ffffff',
          border: '1.5px solid rgba(34,201,232,0.25)',
          padding: '1rem',
        }}
      >
        <PaymentElement options={{ layout: 'tabs' }} />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.875rem',
            background: 'rgba(255,102,25,0.08)',
            border: '1px solid rgba(255,102,25,0.20)',
            color: '#FF6619',
            fontSize: '0.8125rem',
          }}
        >
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="btn-secondary"
          style={{ flex: 1, justifyContent: 'center', padding: '0.875rem' }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !stripe}
          className="btn-primary"
          style={{ flex: 1, justifyContent: 'center', padding: '0.875rem' }}
        >
          {loading ? <Loader2 size={17} className="animate-spin" /> : <>
            <Check size={17} /> Confirm Payment
          </>}
        </button>
      </div>
    </form>
  );
}

/* ──────────────────────────────────────────────────────────
   WALLET PAGE
   ──────────────────────────────────────────────────────────*/
export default function Wallet() {
  const { user } = useUser();
  const [balance, setBalance] = useState<number>(0);
  const [amount, setAmount] = useState<string>('10');
  const [loading, setLoading] = useState(false);
  const [verifying] = useState(false);
  const [checkoutData, setCheckoutData] = useState<{ clientSecret: string; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  /* ── Data fetching — UNCHANGED ── */
  useEffect(() => {
    if (user) fetchBalance();
  }, [user]);

  const fetchBalance = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/wallet/profile?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setBalance(data.walletBalance || 0);
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
      setBalance(0);
    }
  };

  const handleTopUp = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 2) {
      setError('Minimum top-up is $2'); return;
    }
    setLoading(true);
    setError(null);
    try {
      if (!user) throw new Error('User not authenticated');
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numAmount, userId: user.id }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setCheckoutData({ clientSecret: data.clientSecret, id: data.id });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      if (!user) throw new Error('User not authenticated');
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to create portal session');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPortalLoading(false);
    }
  };

  const onSuccess = (newBalance: number) => {
    setBalance(newBalance);
    setCheckoutData(null);
    const toast = document.createElement('div');
    toast.className = 'toast-success';
    toast.innerText = '✓ Top-up Successful!';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const presets = ['5', '10', '20', '50', '100', '200'];

  return (
    <div className="p-4 pt-16 md:pt-8 md:p-8" style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* ── Page Header ───────────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
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
          Wallet & Billing
        </h1>
        <p style={{ color: '#1A2232', fontSize: '1rem', fontWeight: 500, fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
          Manage your balance and payment methods.
        </p>
      </div>

      {/* ── Balance Card ──────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, #0D1117 0%, #1A2232 100%)',
          padding: '2rem',
          marginBottom: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(13,17,23,0.30)',
        }}
      >
        {/* Decorative watermark */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            padding: '1.5rem',
            opacity: 0.06,
          }}
        >
          <WalletIcon size={100} color="#22C9E8" />
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p
            style={{
              color: 'rgba(255,255,255,0.50)',
              fontSize: '0.65rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.09em',
              marginBottom: '0.5rem',
            }}
          >
            Available Balance
          </p>
          <h2
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: '2.75rem',
              color: '#ffffff',
              lineHeight: 1,
            }}
          >
            ${balance.toFixed(2)}
          </h2>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {!checkoutData ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
          >
            {/* Error Banner */}
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.875rem',
                  background: 'rgba(255,102,25,0.08)',
                  border: '1px solid rgba(255,102,25,0.20)',
                  color: '#FF6619',
                  fontSize: '0.8125rem',
                }}
              >
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {/* Top Up Section */}
            <div
              style={{
                background: '#ffffff',
                padding: '1.5rem',
                boxShadow: '0 4px 24px rgba(13,17,23,0.10)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                }}
              >
                <Plus size={14} color="#22C9E8" />
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.09em',
                    color: '#7a9aa8',
                  }}
                >
                  Top Up Wallet
                </span>
              </div>

              {/* Amount Presets */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '0.5rem',
                  marginBottom: '1rem',
                }}
              >
                {presets.map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val)}
                    style={{
                      padding: '0.75rem',
                      background: amount === val ? 'linear-gradient(135deg, #0D1117, #1A2232)' : '#F7FAFC',
                      color: amount === val ? '#22C9E8' : '#0D1117',
                      border: `1.5px solid ${amount === val ? 'transparent' : '#E2EBF0'}`,
                      fontSize: '0.9375rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      fontFamily: "'Comfortaa', system-ui, sans-serif",
                      transition: 'all 0.15s',
                      boxShadow: amount === val ? '0 4px 16px rgba(13,17,23,0.20)' : 'none',
                    }}
                  >
                    ${val}
                  </button>
                ))}
              </div>

              {/* Custom Amount */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    color: '#6e797c',
                    marginBottom: '0.375rem',
                  }}
                >
                  Custom Amount (Min $2)
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '0.875rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#7a9aa8',
                      fontSize: '1rem',
                      fontWeight: 700,
                    }}
                  >
                    $
                  </span>
                  <input
                    type="number"
                    min="2"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: '1.75rem' }}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <button
                onClick={handleTopUp}
                disabled={loading}
                className="btn-cta"
                style={{ width: '100%', justifyContent: 'center', padding: '0.9375rem', fontSize: '1rem' }}
              >
                {loading ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <>
                    <CreditCard size={17} />
                    Top Up Now — ${parseFloat(amount || '0').toFixed(2)}
                  </>
                )}
              </button>
            </div>

            {/* Billing Actions */}
            <div
              style={{
                background: '#FFFFFF',
                boxShadow: '0 4px 24px rgba(13,17,23,0.08)',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
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
                  fontFamily: "'Comfortaa', system-ui, sans-serif",
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F7FAFC')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {portalLoading ? (
                    <Loader2 size={17} className="animate-spin" style={{ color: '#22C9E8' }} />
                  ) : (
                    <CreditCard size={17} color="#22C9E8" />
                  )}
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0D1117' }}>
                    Manage Billing
                  </span>
                </div>
                <ChevronRight size={16} color="#94a3b8" />
              </button>
              <button
                onClick={() => navigate('/records')}
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
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F7FAFC')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = '')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <History size={17} color="#22C9E8" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0D1117' }}>
                    Transaction History
                  </span>
                </div>
                <ChevronRight size={16} color="#94a3b8" />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="checkout"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
            {/* Checkout Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem',
                background: 'linear-gradient(135deg, #0D1117, #1A2232)',
                boxShadow: '0 4px 24px rgba(13,17,23,0.25)',
              }}
            >
              <div>
                <p style={{ color: 'rgba(255,255,255,0.50)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em' }}>Secure Checkout</p>
                <p
                  style={{
                    fontFamily: "'Comfortaa', system-ui, sans-serif",
                    fontWeight: 800,
                    fontSize: '1.5rem',
                    color: '#22C9E8',
                    marginTop: '0.25rem',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Total: ${parseFloat(amount).toFixed(2)}
                </p>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: 'rgba(34,201,232,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#22C9E8',
                }}
              >
                <CreditCard size={20} />
              </div>
            </div>

            {/* Stripe Elements — appearance updated to light Stitch theme */}
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: checkoutData.clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#22C9E8',
                    colorBackground: '#ffffff',
                    colorText: '#0D1117',
                    colorDanger: '#FF6619',
                    fontFamily: "'Comfortaa', system-ui, sans-serif",
                    spacingUnit: '4px',
                    borderRadius: '12px',
                  },
                },
              }}
            >
              <CheckoutForm
                clientSecret={checkoutData.clientSecret}
                paymentIntentId={checkoutData.id}
                onCancel={() => setCheckoutData(null)}
                onSuccess={onSuccess}
              />
            </Elements>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
