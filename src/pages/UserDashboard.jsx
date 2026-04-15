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
    if (type === 'withdraw' && profile.withdraw_restricted) setRestriction({ title: "Operation Restricted", reason: profile.withdraw_reason });
    else if (type === 'transfer' && profile.transfer_restricted) setRestriction({ title: "Transfer Suspended", reason: profile.transfer_reason });
    else setActiveTab(type);
  };

  if (!profile) return <div className="h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-400">Verifying session...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      <Navbar userType="Account Holder" />
      <div className="max-w-6xl mx-auto py-10 px-6 animate-fadeIn">
        
        {/* Profile Card */}
        <div className="bg-[#0f172a] p-10 rounded shadow-lg flex flex-col md:flex-row items-center gap-10 mb-8 border-b-4 border-emerald-600">
          <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.full_name}&background=10b981&color=fff`} className="w-28 h-28 rounded-md border-4 border-slate-700 object-cover" />
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl font-bold text-white mb-1 uppercase tracking-tight">{profile.full_name}</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic">{profile.account_id}</p>
          </div>
          <div className="bg-slate-800 p-6 rounded border border-slate-700 min-w-[280px] text-right">
             <p className="text-[10px] text-emerald-400 font-bold uppercase mb-1">Available Pool</p>
             <h3 className="text-5xl font-bold text-white tracking-tighter">${parseFloat(profile.balance || 0).toLocaleString()}</h3>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-slate-200">
          {['overview', 'transfer', 'withdraw', 'inbox'].map(tab => (
              <button key={tab} onClick={() => (tab === 'transfer' || tab === 'withdraw') ? handleAction(tab) : setActiveTab(tab)} className={`px-6 py-3 font-bold uppercase text-[10px] tracking-widest transition-all ${activeTab === tab ? 'bg-white text-[#0f172a] border border-b-0 border-slate-200' : 'text-slate-400 hover:text-[#0f172a]'}`}>
                  {tab} {tab === 'inbox' && inbox.length > 0 && <span className="ml-2 bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[9px]">{inbox.length}</span>}
              </button>
          ))}
        </div>

        {/* Content Section */}
        <div className="bg-white p-8 border border-slate-200 shadow-sm rounded-md min-h-[400px]">
          {activeTab === 'overview' && (
             <table className="bank-table">
                <thead><tr><th>Registry</th><th>Reference</th><th className="text-right">Fund Delta</th></tr></thead>
                <tbody>
                    {transactions.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                            <td className="text-[10px] text-slate-400 font-bold uppercase">{new Date(t.created_at).toLocaleDateString()}</td>
                            <td className="font-bold text-[#0f172a] uppercase text-sm tracking-tight">{t.description}</td>
                            <td className={`text-right font-bold text-xl ${t.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>{t.type === 'credit' ? '+' : '-'}${parseFloat(t.amount).toLocaleString()}</td>
                        </tr>
                    ))}
                    {transactions.length === 0 && <tr><td colSpan="3" className="py-20 text-center text-slate-300 uppercase text-xs font-bold italic tracking-widest">Registry Empty</td></tr>}
                </tbody>
             </table>
          )}

          {activeTab === 'inbox' && (
            <div className="space-y-6">
              {inbox.map(m => (
                <div key={m.id} className="bg-slate-50 p-8 border rounded hover:bg-white transition-all shadow-sm">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">Official Dispatch: {new Date(m.created_at).toLocaleString()}</p>
                  <h5 className="font-bold text-lg text-[#0f172a] mb-2 uppercase">{m.title}</h5>
                  <p className="text-slate-600 text-sm leading-relaxed">{m.content}</p>
                </div>
              ))}
              {inbox.length === 0 && <div className="py-20 text-center text-slate-300 uppercase text-xs font-bold tracking-widest opacity-40">No messages on record</div>}
            </div>
          )}

          {(activeTab === 'transfer' || activeTab === 'withdraw') && (
            <div className="max-w-md mx-auto py-16 text-center border p-10 rounded">
                <h3 className="text-xl font-bold text-[#0f172a] mb-6 uppercase tracking-widest underline underline-offset-8">Execute {activeTab}</h3>
                <input className="w-full bg-slate-50 p-4 border rounded mb-4 text-center font-bold text-sm outline-none focus:border-[#0f172a]" placeholder="Vault Destination Moniker" />
                <input className="w-full bg-slate-50 p-4 border rounded mb-8 text-center text-3xl font-bold outline-none focus:border-[#0f172a]" placeholder="0.00" type="number" />
                <button className="w-full bg-[#0f172a] text-white py-4 rounded font-bold uppercase text-[10px] tracking-widest hover:bg-emerald-600 transition-all">Submit Protocol</button>
            </div>
          )}
        </div>
      </div>

      {/* Restriction Modal Standard */}
      {restriction && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[2000] p-6">
          <div className="bg-white text-[#0f172a] p-12 rounded-md max-w-md w-full text-center shadow-2xl relative border-t-8 border-rose-600">
             <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-black italic">!</div>
             <h3 className="text-xl font-bold mb-3 uppercase tracking-tighter">{restriction.title}</h3>
             <p className="text-slate-500 mb-10 text-sm italic">"{restriction.reason}"</p>
             <button onClick={() => setRestriction(null)} className="w-full bg-[#0f172a] text-white py-3 rounded font-bold uppercase text-[10px] tracking-widest">Acknowledge</button>
          </div>
        </div>
      )}
    </div>
  );
}