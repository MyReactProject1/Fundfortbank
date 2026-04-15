import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';

export default function UserDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [inbox, setInbox] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); 
  const [restriction, setRestriction] = useState(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate('/');
      else fetchUserData(session.user.id);
    };
    init();
  }, [navigate]);

  async function fetchUserData(userId) {
    const { data: cust } = await supabase.from('customers').select('*').eq('id', userId).single();
    setProfile(cust);
    const { data: trans } = await supabase.from('transactions').select('*').eq('customer_id', userId).order('created_at', {ascending: false});
    setTransactions(trans || []);
    const { data: msgs } = await supabase.from('inbox_messages').select('*').eq('customer_id', userId).order('created_at', {ascending: false});
    setInbox(msgs || []);
  }

  const handleAction = (type) => {
    if (type === 'withdraw' && profile.withdraw_restricted) setRestriction({ title: "Circuit Blocked", reason: profile.withdraw_reason });
    else if (type === 'transfer' && profile.transfer_restricted) setRestriction({ title: "Transfer Suspended", reason: profile.transfer_reason });
    else setActiveTab(type);
  };

  if (!profile) return <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center text-emerald-500 font-black animate-pulse">VERIFYING END-TO-END CONNECTION...</div>;

  return (
    <div className="min-h-screen bg-[#05080d] text-slate-300 font-sans pb-20">
      <Navbar userType="Premier Client" />
      <div className="max-w-6xl mx-auto py-10 px-4 md:px-6 animate-fadeIn">
        
        {/* --- IDENTITY MATRIX --- */}
        <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border border-white/5 flex flex-col md:flex-row items-center gap-10 mb-10 shadow-2xl relative">
          <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.full_name}&background=10b981&color=fff`} className="w-28 md:w-40 h-28 md:h-40 rounded-[2.5rem] md:rounded-[3.5rem] border-4 border-white/5 shadow-2xl object-cover" />
          <div className="flex-1 text-center md:text-left font-black italic tracking-tighter">
            <h2 className="text-3xl md:text-5xl text-white uppercase">{profile.full_name}</h2>
            <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-2">
                <span className="bg-emerald-900/40 text-emerald-400 px-4 py-1.5 rounded-full text-[9px] uppercase tracking-widest border border-emerald-500/20 shadow-lg italic">Account Verified</span>
                <span className="bg-white/5 text-slate-500 px-4 py-1.5 rounded-full text-[9px] border border-white/5 uppercase tracking-widest">{profile.account_id}</span>
            </div>
          </div>
          <div className="text-center md:text-right bg-emerald-900/10 p-10 rounded-[3rem] border border-emerald-500/10 min-w-full md:min-w-[340px]">
             <p className="text-[10px] text-emerald-500 uppercase font-black tracking-[0.5em] mb-3 opacity-40 italic underline underline-offset-8 decoration-emerald-500/20">Archive Available Pool</p>
             <h3 className="text-5xl md:text-7xl font-black text-white tracking-tighter italic uppercase">${parseFloat(profile.balance || 0).toLocaleString()}</h3>
          </div>
        </div>

        {/* --- MENU GRID --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {['overview', 'transfer', 'withdraw', 'inbox'].map(tab => (
              <button key={tab} onClick={() => (tab === 'transfer' || tab === 'withdraw') ? handleAction(tab) : setActiveTab(tab)} className={`py-6 rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all italic border ${activeTab === tab ? 'bg-emerald-600 text-white border-emerald-500 shadow-xl shadow-emerald-600/10' : 'bg-white/5 text-slate-500 border-white/5 hover:text-white'}`}>
                  {tab} {tab === 'inbox' && inbox.length > 0 && <span className="ml-2 bg-rose-600 text-white px-2 py-0.5 rounded-full">{inbox.length}</span>}
              </button>
          ))}
        </div>

        {/* --- DYNAMIC SECTION --- */}
        <div className="bg-[#0b121e] rounded-[3.5rem] p-6 md:p-12 border border-white/5 min-h-[400px] shadow-inner relative overflow-hidden">
          {activeTab === 'overview' && (
             <div className="space-y-4">
                <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6 italic">
                    <h4 className="text-xl font-black uppercase text-white tracking-widest underline decoration-emerald-500 decoration-4">Registry Records</h4>
                    <span className="text-[9px] text-slate-600 font-black uppercase tracking-[0.5em]">Live Global Feed</span>
                </div>
                {transactions.map(t => (
                    <div key={t.id} className="bg-white/[0.03] p-6 md:p-10 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-white/5 hover:bg-white/[0.05] transition-all group">
                        <div className="flex items-center gap-6">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black italic shadow-inner ${t.type === 'credit' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>{t.type === 'credit' ? 'IN' : 'OUT'}</div>
                            <div><p className="font-black text-xl italic text-white uppercase tracking-widest">{t.description}</p><p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1">{new Date(t.created_at).toLocaleDateString()}</p></div>
                        </div>
                        <p className={`text-3xl md:text-5xl font-black italic tracking-tighter ${t.type === 'credit' ? 'text-emerald-500' : 'text-rose-500'}`}>{t.type === 'credit' ? '+' : '-'}${parseFloat(t.amount).toLocaleString()}</p>
                    </div>
                ))}
                {transactions.length === 0 && <div className="py-24 text-center text-slate-700 font-black uppercase italic opacity-20 tracking-widest">No Protocol Handshakes Recorded.</div>}
             </div>
          )}

          {activeTab === 'inbox' && (
            <div className="space-y-6">
              <h4 className="text-2xl font-black text-white italic mb-10 border-b border-white/10 pb-6 uppercase tracking-widest underline decoration-emerald-500 decoration-4">Secure Dispatch</h4>
              {inbox.map(m => (
                <div key={m.id} className="bg-white/[0.02] p-8 md:p-12 rounded-[3.5rem] border-l-[20px] border-emerald-500 shadow-2xl hover:translate-x-2 transition-transform">
                  <p className="text-[10px] text-emerald-500 font-black uppercase mb-6 opacity-40">Entry_Stamp: {new Date(m.created_at).toLocaleString()}</p>
                  <h5 className="font-black text-3xl text-white mb-6 italic tracking-widest uppercase">{m.title}</h5>
                  <p className="text-slate-400 text-lg md:text-xl font-medium italic italic leading-relaxed">"{m.content}"</p>
                </div>
              ))}
            </div>
          )}

          {(activeTab === 'transfer' || activeTab === 'withdraw') && (
            <div className="max-w-md mx-auto py-20 text-center animate-fadeIn font-black uppercase">
                <h3 className="text-3xl text-white mb-10 tracking-tighter italic">Execute Private {activeTab}</h3>
                <input className="w-full bg-white/5 p-6 rounded-[2rem] mb-5 border border-white/10 text-white outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-center italic text-sm" placeholder="Vault Destination Key" />
                <input className="w-full bg-white/5 p-8 rounded-[2rem] mb-12 border border-white/10 text-white text-5xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-center italic tracking-tighter" placeholder="0.00" type="number" />
                <button className="w-full bg-emerald-600 text-white py-7 rounded-[2rem] uppercase tracking-widest text-[11px] shadow-2xl hover:bg-[#0f172a] transition-all italic">Initiate Handshake</button>
            </div>
          )}
        </div>
      </div>

      {/* --- RESTRICTION MODAL --- */}
      {restriction && (
        <div className="fixed inset-0 bg-black/98 backdrop-blur-3xl flex items-center justify-center z-[2000] p-6">
          <div className="bg-white text-[#0f172a] p-10 md:p-20 rounded-[4rem] md:rounded-[6rem] max-w-lg w-full text-center border-t-[30px] border-rose-600 shadow-2xl font-black uppercase animate-scaleIn">
             <div className="w-20 md:w-28 h-20 md:h-28 bg-rose-50 text-rose-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 text-6xl italic">!</div>
             <h3 className="text-3xl md:text-4xl mb-6 tracking-widest italic decoration-rose-500/20">{restriction.title}</h3>
             <p className="text-slate-500 mb-16 text-lg md:text-2xl font-bold leading-relaxed italic opacity-70">"{restriction.reason}"</p>
             <button onClick={() => setRestriction(null)} className="w-full bg-rose-600 text-white py-7 rounded-[3rem] text-xs shadow-2xl italic tracking-widest uppercase hover:bg-[#0f172a] transition-all">Establish Protocol</button>
          </div>
        </div>
      )}
    </div>
  );
}