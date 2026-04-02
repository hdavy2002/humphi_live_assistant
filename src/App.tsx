import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from "@clerk/clerk-react";
import {
  LayoutDashboard, Wallet, Mic, History, Settings,
  ExternalLink, PlusCircle, CreditCard, Loader2,
  PlugZap, TrendingUp, Activity, Zap,
  ArrowUpRight, Shield, Star, ChevronRight, Monitor
} from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams, Routes, Route, useNavigate, useLocation, Outlet } from "react-router-dom";
import WalletPage from "./components/Wallet";
import RecordsPage from "./components/Records";
import ProfilePage from "./components/Profile";
import GeminiLive from "./components/GeminiLive";
import ConnectorsPage from "./components/Connectors";

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
   DASHBOARD LAYOUT — Dark Navy Sidebar + Cyan Main
   ──────────────────────────────────────────────────────────*/
function DashboardLayout() {
  const { user } = useUser();
  const navigate  = useNavigate();
  const location  = useLocation();
  const activeTab = location.pathname;

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard",         path: "/" },
    { icon: History,         label: "Chat History",      path: "/records" },
    { icon: Mic,             label: "Live Session",      path: "/recordings" },
    { icon: PlugZap,         label: "Connectors",        path: "/connectors" },
    { icon: Wallet,          label: "Wallet & Billing",  path: "/wallet" },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#22C9E8" }}>
      {/* ── Dark Navy Sidebar ──────────────────────────────── */}
      <aside
        className="sidebar-panel w-60 flex flex-col shrink-0 overflow-y-auto"
        style={{ background: "linear-gradient(180deg, #0D1117 0%, #1A2232 100%)" }}
      >
        {/* Logo */}
        <div
          className="px-5 pt-6 pb-5 cursor-pointer flex items-center gap-2.5"
          onClick={() => navigate("/")}
        >
          {/* φ icon */}
          <div
            style={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, #22C9E8, #0AABCA)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0D1117",
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: 18,
              flexShrink: 0,
              boxShadow: "0 4px 16px rgba(34,201,232,0.40)",
            }}
          >
            φ
          </div>
          <span
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: "1.1rem",
              color: "#FFFFFF",
              letterSpacing: "-0.02em",
            }}
          >
            hum<span style={{ color: "#FF6619" }}>φ</span>
          </span>
        </div>

        {/* Divider */}
        <div className="divider mx-4" />

        {/* Nav */}
        <div className="px-3">
          <p className="section-label-dark px-2 mb-2">Navigation</p>
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

        <div className="divider mx-4" />

        {/* Account */}
        <div className="px-3">
          <p className="section-label-dark px-2 mb-2">Account</p>
          <nav className="space-y-0.5">
            <SidebarItem
              icon={Settings}
              label="Settings"
              active={activeTab === "/profile"}
              onClick={() => navigate("/profile")}
            />
          </nav>
        </div>

        <div className="flex-1" />

        {/* User Card */}
        <div
          className="p-3 m-3"
          style={{
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
            <div className="flex flex-col min-w-0 flex-1">
              <span
                style={{
                  fontFamily: "'Comfortaa', system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  color: "#FFFFFF",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user?.firstName || "User"}
              </span>
              <span style={{
                fontSize: "0.625rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.09em",
                color: "#22C9E8",
              }}>
                Premium Plan
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content (cyan background) ────────────────── */}
      <main
        className="flex-1 overflow-y-auto relative"
        style={{ backgroundColor: "#22C9E8" }}
      >
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
  const [balance, setBalance]           = useState<number | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const navigate = useNavigate();

  /* ── Data Fetching (logic untouched) ── */
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

      {/* ── Header ───────────────────────────────────────── */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: "1.875rem",
              color: "#0D1117",
              marginBottom: "0.25rem",
              letterSpacing: "-0.03em",
            }}
          >
            Welcome back,{" "}
            <span style={{ color: "#FF6619" }}>
              {user?.firstName || "there"}!
            </span>
          </h1>
          <p style={{
            color: "#1A2232",
            fontSize: "1rem",
            fontFamily: "'Comfortaa', system-ui, sans-serif",
            lineHeight: 1.6,
            fontWeight: 500,
          }}>
            Manage your AI usage and wallet from one place.
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            className="btn-primary"
            onClick={() => navigate("/wallet")}
          >
            <PlusCircle size={15} />
            Top Up Wallet
          </button>
          <button
            className="btn-cta"
            onClick={() => navigate("/recordings")}
          >
            <Mic size={15} />
            Start Session →
          </button>
        </div>
      </header>

      {/* ── Stats Grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

        {/* Wallet Balance — dark navy card */}
        <div
          style={{
            background: "linear-gradient(135deg, #0D1117 0%, #1A2232 100%)",
            boxShadow: "0 8px 40px rgba(13,17,23,0.30)",
            padding: "1.5rem",
            cursor: "pointer",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onClick={() => navigate("/wallet")}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 48px rgba(13,17,23,0.40)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 40px rgba(13,17,23,0.30)";
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div
              style={{
                width: 38, height: 38,
                background: "rgba(34,201,232,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#22C9E8",
              }}
            >
              <Wallet size={18} />
            </div>
            <span
              style={{
                background: "rgba(34,201,232,0.15)",
                color: "#22C9E8",
                fontSize: "0.65rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "0.25rem 0.75rem",
              }}
            >
              Active
            </span>
          </div>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "0.375rem" }}>
            Available Balance
          </p>
          <p
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: "2.25rem",
              color: "#FFFFFF",
              lineHeight: 1.1,
            }}
          >
            {balance !== null ? `$${balance.toFixed(2)}` : loading ? "..." : "$0.00"}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); navigate("/wallet"); }}
            style={{
              color: "#22C9E8",
              fontSize: "0.75rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              marginTop: "0.875rem",
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              letterSpacing: "-0.01em",
            }}
          >
            Manage billing <ExternalLink size={11} />
          </button>
        </div>

        {/* Monthly Usage — white card */}
        <div
          style={{
            background: "#FFFFFF",
            boxShadow: "0 4px 24px rgba(13,17,23,0.10)",
            padding: "1.5rem",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div
              style={{
                width: 38, height: 38,
                background: "rgba(255,214,10,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#B38A00",
              }}
            >
              <CreditCard size={18} />
            </div>
          </div>
          <p style={{ color: "#7a9aa8", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "0.375rem" }}>
            Monthly Usage
          </p>
          <p
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: "2.25rem",
              color: "#0D1117",
              lineHeight: 1.1,
            }}
          >
            $12.40
          </p>
          <div
            style={{
              height: 6,
              background: "#EEF4F7",
              marginTop: "1rem",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "66%",
                background: "linear-gradient(135deg, #FFD60A, #FFC200)",
              }}
            />
          </div>
          <p style={{ color: "#7a9aa8", fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", marginTop: "0.5rem" }}>
            Used 66% of typical limit
          </p>
        </div>

        {/* Recordings — orange accent card */}
        <div
          style={{
            background: "linear-gradient(135deg, #FF6619 0%, #FF8C4D 100%)",
            boxShadow: "0 8px 40px rgba(255,102,25,0.35)",
            padding: "1.5rem",
            cursor: "pointer",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onClick={() => navigate("/recordings")}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 48px rgba(255,102,25,0.45)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.transform = "";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 40px rgba(255,102,25,0.35)";
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div
              style={{
                width: 38, height: 38,
                background: "rgba(255,255,255,0.20)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#FFFFFF",
              }}
            >
              <Mic size={18} />
            </div>
          </div>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "0.375rem" }}>
            Total Recordings
          </p>
          <p
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: "2.25rem",
              color: "#FFFFFF",
              lineHeight: 1.1,
            }}
          >
            42
          </p>
          <p
            style={{
              marginTop: "0.875rem",
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.85)",
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 500,
              fontStyle: "italic",
            }}
          >
            "Latest: Team Sync Summary..."
          </p>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { icon: Zap,      label: "Start Live Session", onClick: () => navigate("/recordings"), variant: "cta" },
          { icon: History,  label: "Chat History",        onClick: () => navigate("/records"),    variant: "white" },
          { icon: PlugZap,  label: "Connectors",          onClick: () => navigate("/connectors"), variant: "white" },
          { icon: Settings, label: "Settings",            onClick: () => navigate("/profile"),    variant: "white" },
        ].map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            style={{
              padding: "1.25rem",
              background: action.variant === "cta"
                ? "linear-gradient(135deg, #0D1117 0%, #1A2232 100%)"
                : "rgba(255,255,255,0.85)",
              color: action.variant === "cta" ? "#22C9E8" : "#0D1117",
              border: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "0.625rem",
              cursor: "pointer",
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontSize: "0.875rem",
              fontWeight: 700,
              transition: "transform 0.15s, box-shadow 0.15s",
              boxShadow: action.variant === "cta"
                ? "0 8px 32px rgba(13,17,23,0.30)"
                : "0 4px 16px rgba(13,17,23,0.08)",
              backdropFilter: "blur(12px)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
            }}
          >
            <action.icon size={20} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* ── Recent Activity ───────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: "1.125rem",
              color: "#0D1117",
              letterSpacing: "-0.02em",
            }}
          >
            Recent Activity
          </h2>
          <button
            onClick={() => navigate("/records")}
            style={{
              background: "rgba(13,17,23,0.1)",
              border: "none",
              color: "#0D1117",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              padding: "0.375rem 0.875rem",
            }}
          >
            View all <ArrowUpRight size={13} />
          </button>
        </div>

        <div style={{ background: "#FFFFFF", overflow: "hidden", boxShadow: "0 4px 32px rgba(13,17,23,0.10)" }}>
          {transactions.length > 0 ? (
            transactions.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem 1.25rem",
                  borderBottom: "1px solid #EEF4F7",
                  cursor: "pointer",
                  transition: "background-color 0.15s",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.backgroundColor = "#F7FAFC")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.backgroundColor = "")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                  <div
                    style={{
                      width: 40, height: 40,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background:
                        tx.type === "TOP_UP" || tx.type === "topup"
                          ? "rgba(34,201,232,0.12)"
                          : "rgba(255,102,25,0.10)",
                      color:
                        tx.type === "TOP_UP" || tx.type === "topup"
                          ? "#0AABCA"
                          : "#FF6619",
                    }}
                  >
                    {tx.type === "TOP_UP" || tx.type === "topup" ? (
                      <TrendingUp size={16} />
                    ) : (
                      <Activity size={16} />
                    )}
                  </div>
                  <div>
                    <p style={{
                      fontFamily: "'Comfortaa', system-ui, sans-serif",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      color: "#0D1117",
                    }}>
                      {tx.description || tx.type}
                    </p>
                    <p style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#7a9aa8", marginTop: 2 }}>
                      {new Date(tx.createdAt || tx.created_at).toLocaleDateString()} •{" "}
                      {new Date(tx.createdAt || tx.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{
                    fontFamily: "'Comfortaa', system-ui, sans-serif",
                    fontWeight: 800,
                    fontSize: "1rem",
                    color: tx.amount > 0 ? "#0AABCA" : "#FF6619",
                  }}>
                    {tx.amount > 0 ? "+" : ""}${Math.abs(tx.amount).toFixed(2)}
                  </span>
                  <p style={{ fontSize: "0.625rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.09em", color: "#7a9aa8", marginTop: 2 }}>
                    {tx.status}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: "3.5rem 1rem", textAlign: "center" }}>
              {loading ? (
                <Loader2 size={28} className="animate-spin mx-auto mb-3" style={{ color: "#22C9E8" }} />
              ) : (
                <History size={28} style={{ margin: "0 auto 0.75rem", color: "#94a3b8" }} />
              )}
              <p style={{
                fontFamily: "'Comfortaa', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: "0.9rem",
                color: "#4A5568",
              }}>
                {loading ? "Loading activity..." : "No recent activity"}
              </p>
              {!loading && (
                <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 6, fontFamily: "'Comfortaa', system-ui, sans-serif" }}>
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

/* ConnectorsPlaceholder removed — using ConnectorsPage from ./components/Connectors */

/* ──────────────────────────────────────────────────────────
   WELCOME / LANDING SCREEN
   Matches the cyan hero reference screenshot
   ──────────────────────────────────────────────────────────*/
function WelcomeScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#22C9E8",
        fontFamily: "'Comfortaa', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Nav ─────────────────────────────────────────── */}
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem 2.5rem",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: "1.5rem",
              color: "#0D1117",
              letterSpacing: "-0.03em",
            }}
          >
            hum<span style={{ color: "#FF6619" }}>φ</span>
          </span>
        </div>

        {/* Nav Links */}
        <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
          {["How it works", "Why us", "Stack", "Pricing"].map((l) => (
            <a
              key={l}
              href="#"
              style={{
                fontFamily: "'Comfortaa', system-ui, sans-serif",
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "#0D1117",
                textDecoration: "none",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.65")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
            >
              {l}
            </a>
          ))}
        </div>

        {/* CTA */}
        <SignInButton>
          <button className="btn-cta">
            Login / Sign Up →
          </button>
        </SignInButton>
      </nav>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "3rem 2rem 2rem",
        }}
      >
        {/* Dark pill badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "#0D1117",
            color: "#FFFFFF",
            padding: "0.5rem 1.25rem",
            fontSize: "0.8125rem",
            fontWeight: 600,
            marginBottom: "2.5rem",
            letterSpacing: "-0.01em",
            boxShadow: "0 4px 20px rgba(13,17,23,0.20)",
          }}
        >
          <span style={{
            width: 7, height: 7,
            background: "#FFD60A",
            borderRadius: "50%",
            display: "inline-block",
          }} />
          No code · Enterprise grade · You own it
        </div>

        {/* Hero headline */}
        <h1
          style={{
            fontFamily: "'Comfortaa', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: "clamp(2.75rem, 7vw, 5rem)",
            color: "#0D1117",
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            maxWidth: "820px",
            marginBottom: "0.5rem",
          }}
        >
          The AI companion for{" "}
          <br />
          <span style={{ color: "#FF6619" }}>
            every recording.
          </span>
        </h1>

        <p
          style={{
            color: "#0D1117",
            fontSize: "1.05rem",
            maxWidth: "520px",
            lineHeight: 1.7,
            marginBottom: "2.5rem",
            fontWeight: 500,
            opacity: 0.75,
          }}
        >
          humφ AI transcribes, summarises, and acts on your recordings in real-time —
          secure, fast, and remarkably intelligent.
        </p>

        {/* Pricing badge — dark card like the reference */}
        <div
          style={{
            background: "#0D1117",
            padding: "1.1rem 2rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "1.5rem",
            marginBottom: "2rem",
            boxShadow: "0 12px 48px rgba(13,17,23,0.30)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: "1.75rem",
              color: "#FFFFFF",
              lineHeight: 1,
            }}>$10</p>
            <p style={{ color: "rgba(255,255,255,0.50)", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Per 1M Input Tokens
            </p>
          </div>
          <span style={{ color: "rgba(255,255,255,0.20)", fontSize: "1.5rem", fontWeight: 200 }}>/</span>
          <div style={{ textAlign: "center" }}>
            <p style={{
              fontFamily: "'Comfortaa', system-ui, sans-serif",
              fontWeight: 800,
              fontSize: "1.75rem",
              color: "#FF6619",
              lineHeight: 1,
            }}>$35</p>
            <p style={{ color: "rgba(255,255,255,0.50)", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Per 1M Output Tokens
            </p>
          </div>
          <div style={{ borderLeft: "1px solid rgba(255,255,255,0.12)", paddingLeft: "1.5rem" }}>
            <p style={{ color: "#FFFFFF", fontSize: "0.8rem", fontWeight: 600 }}>No hidden fees</p>
            <p style={{ color: "#22C9E8", fontSize: "0.75rem", fontWeight: 700 }}>Start from $5</p>
          </div>
        </div>

        {/* CTA Buttons */}
        <div style={{ display: "flex", gap: "0.875rem", flexWrap: "wrap", justifyContent: "center", marginBottom: "3rem" }}>
          <SignUpButton>
            <button
              className="btn-primary"
              style={{ padding: "0.9375rem 2.25rem", fontSize: "0.9375rem", gap: "0.6rem" }}
            >
              <Monitor size={16} />
              Windows
            </button>
          </SignUpButton>
          <SignUpButton>
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.9375rem 2.25rem",
                background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
                color: "#FFFFFF",
                fontFamily: "'Comfortaa', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: "0.9375rem",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 20px rgba(139,92,246,0.40)",
                transition: "transform 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/></svg>
              macOS
            </button>
          </SignUpButton>
          <SignUpButton>
            <button className="btn-orange" style={{ padding: "0.9375rem 2.25rem", fontSize: "0.9375rem", gap: "0.6rem" }}>
              <Shield size={16} />
              Linux
            </button>
          </SignUpButton>
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { icon: Zap,       label: "Crystal Clear Transcription", color: "#22C9E8" },
            { icon: Star,      label: "AI Smart Summaries",          color: "#FF6619" },
            { icon: Shield,    label: "Secure Usage Wallet",          color: "#FFD60A" },
          ].map((f) => (
            <div
              key={f.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "rgba(255,255,255,0.25)",
                backdropFilter: "blur(12px)",
                padding: "0.625rem 1.25rem",
                color: "#0D1117",
                fontWeight: 600,
                fontSize: "0.875rem",
                border: "1px solid rgba(255,255,255,0.40)",
              }}
            >
              <f.icon size={15} style={{ color: f.color }} />
              {f.label}
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer
        style={{
          padding: "1.25rem 2.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
          background: "rgba(13,17,23,0.10)",
        }}
      >
        <span style={{ fontSize: "0.8rem", color: "#0D1117", fontWeight: 500, opacity: 0.65 }}>
          © {new Date().getFullYear()} HumPhi AI · Built for the future.
        </span>
        <div style={{ display: "flex", gap: "1.5rem" }}>
          {["Privacy", "Terms", "Support"].map((l) => (
            <a
              key={l}
              href="#"
              style={{
                fontSize: "0.8rem",
                color: "#0D1117",
                fontWeight: 600,
                textDecoration: "none",
                opacity: 0.65,
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.65")}
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
            <Route path="/"            element={<Home />} />
            <Route path="/wallet"      element={<WalletPage />} />
            <Route path="/records"     element={<RecordsPage />} />
            <Route path="/profile"     element={<ProfilePage />} />
            <Route path="/recordings"  element={<GeminiLive />} />
            <Route path="/connectors"  element={<ConnectorsPage />} />
            <Route path="*"            element={<Home />} />
          </Route>
        </Routes>
      </SignedIn>
      <SignedOut>
        <WelcomeScreen />
      </SignedOut>
    </>
  );
}
