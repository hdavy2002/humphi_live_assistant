import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from "@clerk/clerk-react";
import {
  LayoutDashboard, Wallet, Mic, History, Settings,
  ExternalLink, PlusCircle, CreditCard, Loader2,
  PlugZap, ChevronRight, TrendingUp, Activity, Zap,
  ArrowUpRight, Shield, Star
} from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams, Routes, Route, useNavigate, useLocation, Outlet } from "react-router-dom";
import WalletPage from "./components/Wallet";
import RecordsPage from "./components/Records";
import ProfilePage from "./components/Profile";
import GeminiLive from "./components/GeminiLive";

/* ──────────────────────────────────────────────────────────
   SIDEBAR ITEM
   ──────────────────────────────────────────────────────────*/
function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: any;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`nav-item w-full ${active ? "nav-item-active" : ""}`}
    >
      <Icon size={17} strokeWidth={active ? 2.5 : 2} />
      <span>{label}</span>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────
   DASHBOARD LAYOUT — Sidebar + Main
   ──────────────────────────────────────────────────────────*/
function DashboardLayout() {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname;

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard",        path: "/" },
    { icon: History,         label: "Chat History",     path: "/records" },
    { icon: Mic,             label: "Screen Recordings",path: "/recordings" },
    { icon: PlugZap,         label: "Connectors",       path: "/connectors" },
    { icon: Wallet,          label: "Wallet & Billing", path: "/wallet" },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#fef9ed" }}>
      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside
        className="sidebar-panel w-60 flex flex-col shrink-0 overflow-y-auto"
        style={{ background: "#f8f3e7" }}
      >
        {/* Logo */}
        <div
          className="px-5 pt-6 pb-4 cursor-pointer flex items-center gap-2.5"
          onClick={() => navigate("/")}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: "var(--gradient-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(0,104,121,0.3)",
            }}
          >
            H
          </div>
          <div>
            <span
              style={{
                fontFamily: "'Comfortaa', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: "1rem",
                color: "#1d1c15",
                letterSpacing: "-0.01em",
              }}
            >
              HumPhi AI
            </span>
          </div>
        </div>

        {/* Section: Main */}
        <div className="px-3 mt-2">
          <p className="section-label px-2 mb-1.5">Main</p>
          <nav className="space-y-0.5">
            {navItems.map((item) => (
              <SidebarItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                active={
                  item.path === "/"
                    ? activeTab === "/"
                    : activeTab.startsWith(item.path)
                }
                onClick={() => navigate(item.path)}
              />
            ))}
          </nav>
        </div>

        {/* Divider */}
        <div className="divider mx-4" />

        {/* Section: Account */}
        <div className="px-3">
          <p className="section-label px-2 mb-1.5">Account</p>
          <nav className="space-y-0.5">
            <SidebarItem
              icon={Settings}
              label="Settings"
              active={activeTab === "/profile"}
              onClick={() => navigate("/profile")}
            />
          </nav>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User Card */}
        <div className="p-3 m-3" style={{ background: "#f2ede2" }}>
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
            <div className="flex flex-col min-w-0 flex-1">
              <span
                style={{
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  color: "#1d1c15",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user?.firstName || "User"}
              </span>
              <span className="section-label" style={{ fontSize: "0.625rem" }}>
                Premium Plan
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto relative" style={{ backgroundColor: "#fef9ed" }}>
        <Outlet />
      </main>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   HOME / DASHBOARD PAGE
   ──────────────────────────────────────────────────────────*/
function Home() {
  const { user } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpLoading] = useState(false);
  const navigate = useNavigate();

  /* ── Data Fetching (unchanged) ── */
  const fetchWalletData = async () => {
    if (!user?.id) return;
    try {
      const [balanceRes, transactionsRes] = await Promise.all([
        fetch(`/api/wallet/profile?userId=${user.id}`),
        fetch(`/api/wallet/transactions?userId=${user.id}`),
      ]);
      if (balanceRes.ok) {
        const data = await balanceRes.json();
        setBalance(data.walletBalance);
      }
      if (transactionsRes.ok) {
        const data = await transactionsRes.json();
        setTransactions(Array.isArray(data) ? data : data.transactions || []);
      }
    } catch (err) {
      console.error("Failed to fetch wallet data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId) {
      const verifySession = async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/verify-session?sessionId=${sessionId}`, {
            method: "POST",
          });
          if (res.ok) {
            searchParams.delete("session_id");
            setSearchParams(searchParams);
          }
        } catch (err) {
          console.error("Verification failed:", err);
        } finally {
          fetchWalletData();
        }
      };
      verifySession();
    } else {
      fetchWalletData();
    }
  }, [user?.id, searchParams]);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* ── Header ──────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: "1.75rem",
              color: "#1d1c15",
              marginBottom: "0.25rem",
              letterSpacing: "-0.01em",
            }}
          >
            Welcome back,{" "}
            <span style={{ color: "#006879" }}>
              {user?.firstName || "there"}!
            </span>
          </h1>
          <p style={{ color: "#3e494c", fontSize: "0.9375rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", lineHeight: 1.6 }}>
            Track your AI usage and manage your wallet seamlessly.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            className="btn-primary"
            onClick={() => navigate("/wallet")}
            disabled={topUpLoading}
          >
            {topUpLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <PlusCircle size={14} />
            )}
            Top Up Wallet
          </button>
          <button
            className="btn-secondary"
            onClick={() => navigate("/recordings")}
          >
            <Mic size={14} />
            Start Session
          </button>
        </div>
      </header>

      {/* ── Stats Grid ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

        {/* Wallet Balance */}
        <div
          className="stat-card group"
          style={{ cursor: "pointer" }}
          onClick={() => navigate("/wallet")}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              style={{
                width: 38,
                height: 38,
                background: "rgba(0,104,121,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#006879",
                transition: "transform 0.2s",
              }}
              className="group-hover:scale-110"
            >
              <Wallet size={18} />
            </div>
            <span className="badge badge-success" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>Active</span>
          </div>
          <p className="section-label">Available Balance</p>
          <p
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: "2rem",
              color: "#1d1c15",
              lineHeight: 1.1,
            }}
          >
            {balance !== null
              ? `$${balance.toFixed(2)}`
              : loading
              ? "..."
              : "$0.00"}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); navigate("/wallet"); }}
            style={{
              color: "#006879",
              fontSize: "0.75rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              marginTop: "0.75rem",
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            }}
          >
            Manage billing <ExternalLink size={12} />
          </button>
        </div>

        {/* Monthly Usage */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <div
              style={{
                width: 38,
                height: 38,
                background: "rgba(224,181,47,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#755b00",
              }}
            >
              <CreditCard size={18} />
            </div>
          </div>
          <p className="section-label">Monthly Usage</p>
          <p
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: "2rem",
              color: "#1d1c15",
              lineHeight: 1.1,
            }}
          >
            $12.40
          </p>
          <div
            style={{
              height: 6,
              background: "#ede8dc",
              marginTop: "0.875rem",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "66%",
                background: "var(--gradient-warm)",
              }}
            />
          </div>
          <p className="section-label mt-1.5" style={{ fontSize: "0.625rem" }}>
            Used 66% of your typical limit
          </p>
        </div>

        {/* Recordings */}
        <div
          className="stat-card group"
          style={{ cursor: "pointer" }}
          onClick={() => navigate("/recordings")}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              style={{
                width: 38,
                height: 38,
                background: "rgba(94,200,224,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#006879",
                transition: "transform 0.2s",
              }}
              className="group-hover:scale-110"
            >
              <Mic size={18} />
            </div>
          </div>
          <p className="section-label">Total Recordings</p>
          <p
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: "2rem",
              color: "#1d1c15",
              lineHeight: 1.1,
            }}
          >
            42
          </p>
          <p
            style={{
              marginTop: "0.875rem",
              fontSize: "0.8rem",
              color: "#3e494c",
              borderLeft: "3px solid #5ec8e0",
              paddingLeft: "0.75rem",
              fontStyle: "italic",
            }}
          >
            "Latest: Team Sync Summary..."
          </p>
        </div>
      </div>

      {/* ── Quick Actions ────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { icon: Zap, label: "Start Live Session", onClick: () => navigate("/recordings"), accent: true },
          { icon: History, label: "Chat History", onClick: () => navigate("/records"), accent: false },
          { icon: PlugZap, label: "Connectors", onClick: () => navigate("/connectors"), accent: false },
          { icon: Settings, label: "Settings", onClick: () => navigate("/profile"), accent: false },
        ].map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            style={{
              padding: "1.25rem",
              background: action.accent ? "var(--gradient-primary)" : "#f2ede2",
              color: action.accent ? "#fff" : "#3e494c",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "0.5rem",
              cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: "0.875rem",
              fontWeight: 600,
              transition: "transform 0.15s, box-shadow 0.15s",
              boxShadow: "0 2px 20px rgba(29,28,21,0.05)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(0,104,121,0.12)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
            }}
          >
            <action.icon size={18} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* ── Recent Activity ──────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: "1rem",
              color: "#1d1c15",
            }}
          >
            Recent Activity
          </h2>
          <button
            onClick={() => navigate("/records")}
            style={{
              background: "none",
              border: "none",
              color: "#006879",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontFamily: "'Comfortaa', system-ui, sans-serif",
            }}
          >
            View all <ArrowUpRight size={13} />
          </button>
        </div>

        <div style={{ background: "#ffffff", overflow: "hidden", boxShadow: "0 2px 24px rgba(29,28,21,0.05)" }}>
          {transactions.length > 0 ? (
            transactions.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.875rem 1rem",
                  borderBottom: "1px solid rgba(189,200,204,0.15)",
                  cursor: "pointer",
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.backgroundColor = "#f8f3e7")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.backgroundColor = "")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        tx.type === "TOP_UP" || tx.type === "topup"
                          ? "rgba(0,104,121,0.1)"
                          : "rgba(157,67,0,0.1)",
                      color:
                        tx.type === "TOP_UP" || tx.type === "topup"
                          ? "#006879"
                          : "#9d4300",
                    }}
                  >
                    {tx.type === "TOP_UP" || tx.type === "topup" ? (
                      <TrendingUp size={16} />
                    ) : (
                      <Activity size={16} />
                    )}
                  </div>
                  <div>
                    <p
                      style={{
                        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        color: "#1d1c15",
                      }}
                    >
                      {tx.description || tx.type}
                    </p>
                    <p className="section-label" style={{ fontSize: "0.625rem", marginTop: 2 }}>
                      {new Date(tx.createdAt || tx.created_at).toLocaleDateString()} •{" "}
                      {new Date(tx.createdAt || tx.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span
                    style={{
                      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                      fontWeight: 800,
                      fontSize: "0.9375rem",
                      color: tx.amount > 0 ? "#006879" : "#ba1a1a",
                    }}
                  >
                    {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                  </span>
                  <p className="section-label" style={{ fontSize: "0.625rem", marginTop: 2 }}>
                    {tx.status}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                padding: "3rem 1rem",
                textAlign: "center",
                color: "#6e797c",
              }}
            >
              {loading ? (
                <Loader2 size={28} className="animate-spin mx-auto mb-3" style={{ color: "#bdc8cc" }} />
              ) : (
                <History size={28} style={{ margin: "0 auto 0.75rem", color: "#bdc8cc" }} />
              )}
              <p
                style={{
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  color: "#6e797c",
                }}
              >
                {loading ? "Loading activity..." : "No recent activity"}
              </p>
              {!loading && (
                <p style={{ fontSize: "0.8rem", color: "#bdc8cc", marginTop: 4 }}>
                  Start a session to see your activity here
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   PLACEHOLDER — /connectors route
   ──────────────────────────────────────────────────────────*/
function ConnectorsPlaceholder() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <h1
        style={{
          fontFamily: "'Comfortaa', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: "1.75rem",
          color: "#1d1c15",
          marginBottom: "0.5rem",
        }}
      >
        Connectors
      </h1>
      <p style={{ color: "#3e494c", marginBottom: "2rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: "0.9375rem" }}>
        Connect HumPhi to your favourite tools and services.
      </p>
      <div
        style={{
          background: "#f8f3e7",
          padding: "5rem 1rem",
          textAlign: "center",
          boxShadow: "0 2px 20px rgba(29,28,21,0.04)",
        }}
      >
        <PlugZap size={40} style={{ margin: "0 auto 1rem", color: "#bdc8cc" }} />
        <p style={{ fontWeight: 700, color: "#6e797c", fontFamily: "'Comfortaa', system-ui, sans-serif", fontSize: "1rem" }}>
          Coming soon
        </p>
        <p style={{ color: "#bdc8cc", fontSize: "0.875rem", marginTop: 6, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
          Integrations are being built for you.
        </p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   WELCOME / LANDING SCREEN
   ──────────────────────────────────────────────────────────*/
function WelcomeScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#fef9ed",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Top Nav ─────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 2rem",
          background: "rgba(255,255,255,0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(189,200,204,0.2)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <div
            style={{
              width: 30,
              height: 30,
              background: "var(--gradient-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            H
          </div>
          <span
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: "1rem",
              color: "#1d1c15",
            }}
          >
            HumPhi AI
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <SignInButton>
            <button className="btn-ghost" style={{ fontSize: "0.875rem", padding: "0.5rem 1rem" }}>
              Sign In
            </button>
          </SignInButton>
          <SignUpButton>
            <button className="btn-primary" style={{ fontSize: "0.875rem", padding: "0.5rem 1rem" }}>
              Get Started
            </button>
          </SignUpButton>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "5rem 2rem",
          textAlign: "center",
        }}
      >
        {/* Pill badge */}
        <div
          className="badge badge-primary"
          style={{ marginBottom: "1.5rem", gap: 6 }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              background: "#006879",
              borderRadius: "9999px",
              display: "inline-block",
              animation: "pulse 2s infinite",
            }}
          />
          Now Live
        </div>

        <h1
          style={{
            fontFamily: "'Comfortaa', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: "clamp(2.25rem, 6vw, 4rem)",
            color: "#1d1c15",
            lineHeight: 1.15,
            maxWidth: "700px",
            marginBottom: "1.25rem",
            letterSpacing: "-0.02em",
          }}
        >
          Your Intelligent{" "}
          <span
            style={{
              background: "var(--gradient-primary)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Live Assistant
          </span>
        </h1>

        <p
          style={{
            fontSize: "1.1rem",
            color: "#3e494c",
            maxWidth: "520px",
            lineHeight: 1.7,
            marginBottom: "2.5rem",
          }}
        >
          The most powerful AI companion for your recordings and daily workflows.
          Secure, fast, and remarkably intelligent.
        </p>

        <div style={{ display: "flex", gap: "0.875rem", flexWrap: "wrap", justifyContent: "center" }}>
          <SignUpButton>
            <button className="btn-primary" style={{ padding: "0.875rem 2rem", fontSize: "1rem" }}>
              <Star size={16} />
              Create Free Account
            </button>
          </SignUpButton>
          <SignInButton>
            <button className="btn-secondary" style={{ padding: "0.875rem 2rem", fontSize: "1rem" }}>
              Sign In
            </button>
          </SignInButton>
        </div>

        {/* Feature grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "1.5rem",
            maxWidth: "780px",
            width: "100%",
            marginTop: "4rem",
            paddingTop: "2.5rem",
          }}
        >
          {[
            {
              icon: Zap,
              title: "Crystal Clear",
              desc: "High-fidelity transcription for every recording.",
              color: "#006879",
              bg: "rgba(0,104,121,0.08)",
            },
            {
              icon: TrendingUp,
              title: "Smart Insights",
              desc: "AI-powered summaries and action items in seconds.",
              color: "#755b00",
              bg: "rgba(224,181,47,0.1)",
            },
            {
              icon: Shield,
              title: "Secure Billing",
              desc: "Transparent, usage-based wallet system.",
              color: "#9d4300",
              bg: "rgba(157,67,0,0.08)",
            },
          ].map((f) => (
            <div
              key={f.title}
              style={{
                background: "#ffffff",
                border: "1px solid rgba(189,200,204,0.2)",
                padding: "1.25rem",
                textAlign: "left",
                boxShadow: "0 2px 12px rgba(29,28,21,0.04)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: f.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: f.color,
                  marginBottom: "0.75rem",
                }}
              >
                <f.icon size={17} />
              </div>
              <h3
                style={{
                  fontFamily: "'Comfortaa', system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: "0.9375rem",
                  color: "#1d1c15",
                  marginBottom: "0.375rem",
                }}
              >
                {f.title}
              </h3>
              <p style={{ fontSize: "0.8125rem", color: "#3e494c", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer
        style={{
          padding: "1.5rem 2rem",
          borderTop: "1px solid rgba(189,200,204,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
          background: "#f8f3e7",
        }}
      >
        <span style={{ fontSize: "0.8rem", color: "#6e797c" }}>
          © {new Date().getFullYear()} HumPhi AI. Built for the future.
        </span>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          {["Privacy", "Terms", "Support"].map((l) => (
            <a
              key={l}
              href="#"
              style={{ fontSize: "0.8rem", color: "#6e797c", fontWeight: 500 }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#006879")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#6e797c")}
            >
              {l}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   APP ROOT
   ──────────────────────────────────────────────────────────*/
export default function App() {
  return (
    <>
      <SignedIn>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/recordings" element={<GeminiLive />} />
            <Route path="/connectors" element={<ConnectorsPlaceholder />} />
            {/* Fallback */}
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </SignedIn>
      <SignedOut>
        <WelcomeScreen />
      </SignedOut>
    </>
  );
}
