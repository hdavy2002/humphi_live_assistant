import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, useUser } from "@clerk/clerk-react";
import { LayoutDashboard, Wallet, Mic, History, Settings, ExternalLink, PlusCircle, CreditCard, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams, Routes, Route, useNavigate, useLocation, Outlet } from "react-router-dom";
import WalletPage from "./components/Wallet";
import RecordsPage from "./components/Records";
import ProfilePage from "./components/Profile";
import GeminiLive from "./components/GeminiLive";

function SidebarItem({ icon: Icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`nav-item w-full flex items-center gap-3 transition-all duration-200 ${active ? 'nav-item-active bg-blue-500/10 text-blue-400' : 'text-text-secondary hover:bg-white/5 hover:text-white'}`}
    >
      <Icon size={18} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function DashboardLayout() {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname;

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      {/* Sidebar */}
      <aside className="w-64 glass-panel m-4 flex flex-col border-none shrink-0 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">H</div>
            <span className="text-xl font-bold tracking-tight text-white">Humphi AI</span>
          </div>

          <nav className="space-y-1">
            <SidebarItem icon={LayoutDashboard} label="Overview" active={activeTab === "/"} onClick={() => navigate('/')} />
            <SidebarItem icon={Wallet} label="Wallet" active={activeTab === "/wallet"} onClick={() => navigate('/wallet')} />
            <SidebarItem icon={Mic} label="Recordings" active={activeTab === "/recordings"} onClick={() => navigate('/recordings')} />
            <SidebarItem icon={History} label="History" active={activeTab === "/records"} onClick={() => navigate('/records')} />
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-white/5">
          <SidebarItem icon={Settings} label="Settings" active={activeTab === "/profile"} onClick={() => navigate('/profile')} />
          <div className="mt-4 flex items-center gap-3 px-4 py-2 bg-white/5 rounded-2xl border border-white/5">
            <UserButton afterSignOutUrl="/" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-white truncate">{user?.firstName || 'User'}</span>
              <span className="text-[10px] text-text-secondary uppercase font-black tracking-widest truncate">Premium Plan</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative">
        <Outlet />
      </main>
    </div>
  );
}

function Home() {
  const { user } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const navigate = useNavigate();

  const fetchWalletData = async () => {
    if (!user?.id) return;
    try {
      const [balanceRes, transactionsRes] = await Promise.all([
        fetch(`/api/wallet/profile?userId=${user.id}`),
        fetch(`/api/wallet/transactions?userId=${user.id}`)
      ]);
      
      if (balanceRes.ok) {
        const data = await balanceRes.json();
        setBalance(data.walletBalance);
      }
      
      if (transactionsRes.ok) {
        const data = await transactionsRes.json();
        setTransactions(Array.isArray(data) ? data : (data.transactions || []));
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
            method: 'POST'
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

  const handleTopUp = () => {
    navigate('/wallet');
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tight">
            Welcome back, <span className="text-blue-400">{user?.firstName || 'there'}!</span>
          </h1>
          <p className="text-text-secondary text-lg">Track your AI usage and manage your wallet seamlessly.</p>
        </div>
        <button 
          className="btn-premium-accent w-full md:w-auto" 
          onClick={handleTopUp}
          disabled={topUpLoading}
        >
          {topUpLoading ? <Loader2 size={10} className="animate-spin" /> : <PlusCircle size={10} />}
          Top up Wallet
        </button>
        <button 
          className="btn-premium w-full md:w-auto" 
          onClick={() => navigate('/recordings')}
        >
          <Mic size={20} />
          Start Live Session
        </button>
      </header>

      {/* Dynamic Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Wallet Card */}
        <div className="glass-panel p-8 flex flex-col justify-between group hover:border-blue-500/30 transition-all border-none">
          <div className="flex justify-between items-start mb-6">
            <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-400 group-hover:scale-110 transition-transform">
              <Wallet size={28} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-green-500/10 text-green-400">Active</span>
          </div>
          <div>
            <p className="text-text-secondary text-xs font-bold uppercase tracking-widest mb-1">Available Balance</p>
            <p className="text-5xl font-black text-white mb-6">
              {balance !== null ? `$${balance.toFixed(2)}` : (loading ? "..." : "$0.00")}
            </p>
          </div>
          <button onClick={() => navigate('/wallet')} className="text-sm font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors uppercase tracking-widest">
            Manage billing <ExternalLink size={14} />
          </button>
        </div>

        {/* Usage Stats Card */}
        <div className="glass-panel p-8 border-none">
          <div className="flex justify-between items-start mb-6">
            <div className="p-4 rounded-2xl bg-purple-500/10 text-purple-400">
              <CreditCard size={28} />
            </div>
          </div>
          <p className="text-text-secondary text-xs font-bold uppercase tracking-widest mb-1">Monthly Usage</p>
          <p className="text-4xl font-black text-white mb-6">$12.40</p>
          <div className="w-full bg-white/5 rounded-full h-3 mb-3">
            <div className="bg-purple-500 h-3 rounded-full w-2/3 shadow-lg shadow-purple-500/50"></div>
          </div>
          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Used 66% of your typical limit</p>
        </div>

        {/* Recent Recording Card */}
        <div className="glass-panel p-8 flex flex-col justify-between border-none">
          <div className="flex justify-between items-start mb-6">
            <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-400">
              <Mic size={28} />
            </div>
          </div>
          <div>
            <p className="text-text-secondary text-xs font-bold uppercase tracking-widest mb-1">Total Recordings</p>
            <p className="text-4xl font-black text-white">42</p>
          </div>
          <p className="mt-6 text-sm text-text-secondary italic border-l-2 border-amber-500/30 pl-4 font-medium">"Latest: Team Sync Summary..."</p>
        </div>
      </div>

      {/* Featured Section */}
      <section className="mt-16">
        <h2 className="text-2xl font-black mb-6 uppercase tracking-wider">Recent Activity</h2>
        <div className="glass-panel overflow-hidden border-none shadow-2xl">
          {transactions.length > 0 ? (
            transactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="p-6 border-b border-white/5 flex items-center justify-between hover:bg-white/5 transition-all cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                    tx.type === 'TOP_UP' || tx.type === 'topup' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                  }`}>
                    {tx.type === 'TOP_UP' || tx.type === 'topup' ? <History size={20} /> : <Mic size={20} />}
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">{tx.description || tx.type}</p>
                    <p className="text-xs font-bold text-text-secondary uppercase tracking-widest">
                      {new Date(tx.createdAt || tx.created_at).toLocaleDateString()} • {new Date(tx.createdAt || tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xl font-black ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                  </span>
                  <p className="text-[10px] font-black uppercase tracking-tighter text-white/20">{tx.status}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-16 text-center text-text-secondary">
              {loading ? <Loader2 size={32} className="animate-spin mx-auto mb-4 opacity-20" /> : "No recent activity found."}
              <p className="font-bold uppercase tracking-widest text-xs opacity-20">{loading ? "Synchronizing data..." : "Start a recording to see activity"}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-500/10 blur-[120px] rounded-full animate-pulse delay-700"></div>

      <div className="max-w-4xl w-full text-center relative z-10 glass-panel p-12 border-none">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-8">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
          Now Live
        </div>
        <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">
          Humphi <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">Live Assistant</span>
        </h1>
        <p className="text-xl text-text-secondary mb-12 max-w-2xl mx-auto leading-relaxed">
          The most powerful AI companion for your recordings and daily workflows. Secure, fast, and remarkably intelligent.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <SignInButton>
            <button className="btn-premium w-full sm:w-auto justify-center text-lg px-10 py-4">
              Sign In
            </button>
          </SignInButton>
          <SignUpButton>
            <button className="btn-premium-accent w-full sm:w-auto justify-center text-lg px-10 py-4 bg-transparent border-2 border-amber-500/50 hover:bg-amber-500/10">
              Create Account
            </button>
          </SignUpButton>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left border-t border-white/5 pt-12">
          <div>
            <h3 className="font-bold text-white mb-2">Crystal Clear</h3>
            <p className="text-sm text-text-secondary">High-fidelity transcription for every recording.</p>
          </div>
          <div>
            <h3 className="font-bold text-white mb-2">Smart Insights</h3>
            <p className="text-sm text-text-secondary">AI-powered summaries and action items in seconds.</p>
          </div>
          <div>
            <h3 className="font-bold text-white mb-2">Secure Billing</h3>
            <p className="text-sm text-text-secondary">Transparent, usage-based wallet system.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
