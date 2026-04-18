import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';

export default function UserDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [restriction, setRestriction] = useState(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate('/'); else fetchUserData(session.user.id);
    };
    init();
  }, [navigate]);

  async function fetchUserData(userId) {
    const { data: cust } = await supabase.from('customers').select('*').eq('id', userId).single();
    setProfile(cust);
    const { data: trans } = await supabase.from('transactions').select('*').eq('customer_id', userId).order('created_at', {ascending: false});
    setTransactions(trans || []);
  }

  const checkRestriction = (action) => {
    if (action === 'transfer' && profile.transfer_restricted) {
      setRestriction({ title: "Transfer service unavailable", reason: profile.transfer_reason });
      return true;
    }
    if (action === 'withdraw' && profile.withdraw_restricted) {
      setRestriction({ title: "Withdrawal unavailable", reason: profile.withdraw_reason });
      return true;
    }
    return false;
  };

  if (!profile) return <div className="h-screen flex items-center justify-center text-slate-400 font-medium">Updating your accounts...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-32 md:pb-10 font-sans">
      <Navbar userType="Standard User" />
      
      <main className="max-w-xl mx-auto px-4 pt-6 md:pt-10">
        
        {/* User Greeting */}
        <header className="flex justify-between items-center mb-8 px-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">Hello, {profile.full_name.split(' ')[0]}</h1>
            <p className="text-sm text-slate-500">Checking •••• {profile.account_id.slice(-4)}</p>
          </div>
          <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.full_name}`} className="w-12 h-12 rounded-full border border-slate-200 object-cover" />
        </header>

        {/* Available Balance Card */}
        <section className="bg-[#002147] p-8 rounded-[2rem] text-white shadow-xl shadow-blue-900/20 mb-8 relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-2">Available Balance</p>
            <h2 className="text-5xl font-bold tracking-tight">${parseFloat(profile.balance || 0).toLocaleString()}</h2>
            <div className="mt-8 flex gap-3">
              <span className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-bold">+2.4% APR</span>
              <span className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-bold">Insured</span>
            </div>
          </div>
          <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
        </section>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Transfer', icon: '⇄', color: 'bg-blue-50 text-blue-600', action: 'transfer' },
            { label: 'Deposit', icon: '↓', color: 'bg-emerald-50 text-emerald-600', action: 'deposit' },
            { label: 'Pay Bill', icon: '📄', color: 'bg-purple-50 text-purple-600', action: 'pay' },
            { label: 'Cards', icon: '💳', color: 'bg-orange-50 text-orange-600', action: 'cards' }
          ].map((item) => (
            <button key={item.label} onClick={() => checkRestriction(item.action)} className="flex flex-col items-center gap-2">
              <div className={`${item.color} w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-sm hover:scale-105 transition-transform`}>
                {item.icon}
              </div>
              <span className="text-[11px] font-bold text-slate-600">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Recent Activity */}
        <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900">Recent Activity</h3>
            <button className="text-blue-600 text-xs font-bold">See all</button>
          </div>
          
          <div className="space-y-6">
            {transactions.map(t => (
              <div key={t.id} className="flex justify-between items-center group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-lg grayscale group-hover:grayscale-0 transition-all font-bold">
                    {t.description[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-900">{t.description}</p>
                    <p className="text-[11px] text-slate-400 font-medium">{new Date(t.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} • {t.status}</p>
                  </div>
                </div>
                <p className={`font-bold text-sm ${t.type === 'credit' ? 'text-emerald-600' : 'text-slate-900'}`}>
                  {t.type === 'credit' ? '+' : '-'}${parseFloat(t.amount).toLocaleString()}
                </p>
              </div>
            ))}
            {transactions.length === 0 && <p className="text-center py-10 text-slate-300 text-sm font-medium italic">No recent transactions</p>}
          </div>
        </section>
      </main>

      {/* Modern Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-between items-center mobile-nav md:hidden">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-[#002147]' : 'text-slate-300'}`}>
          <span className="text-xl">🏠</span>
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button onClick={() => setActiveTab('accounts')} className={`flex flex-col items-center gap-1 ${activeTab === 'accounts' ? 'text-[#002147]' : 'text-slate-300'}`}>
          <span className="text-xl">📊</span>
          <span className="text-[10px] font-bold">Accounts</span>
        </button>
        <button onClick={() => setActiveTab('activity')} className={`flex flex-col items-center gap-1 ${activeTab === 'activity' ? 'text-[#002147]' : 'text-slate-300'}`}>
          <span className="text-xl">🕒</span>
          <span className="text-[10px] font-bold">Activity</span>
        </button>
        <button onClick={() => setActiveTab('more')} className={`flex flex-col items-center gap-1 ${activeTab === 'more' ? 'text-[#002147]' : 'text-slate-300'}`}>
          <span className="text-xl">⚙️</span>
          <span className="text-[10px] font-bold">Settings</span>
        </button>
      </nav>

      {/* Restriction Modal - Approachable Design */}
      {restriction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[5000] p-6">
          <div className="bg-white p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl animate-fadeIn">
             <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">!</div>
             <h3 className="text-xl font-bold mb-2 text-slate-900">{restriction.title}</h3>
             <p className="text-slate-500 mb-8 text-sm leading-relaxed">{restriction.reason}</p>
             <button onClick={() => setRestriction(null)} className="w-full bg-[#002147] text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:bg-slate-800 transition-all">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}