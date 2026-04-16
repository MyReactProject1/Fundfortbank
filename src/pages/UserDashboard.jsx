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
      if (!session) navigate('/'); else fetchUserData(session.user.id);
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
    if (type === 'withdraw' && profile.withdraw_restricted) setRestriction({ title: "Account Restricted", reason: profile.withdraw_reason });
    else if (type === 'transfer' && profile.transfer_restricted) setRestriction({ title: "Transfer Suspended", reason: profile.transfer_reason });
    else setActiveTab(type);
  };

  if (!profile) return <div className="p-10 text-center font-semibold text-slate-400 uppercase text-xs tracking-widest">Loading secure session...</div>;

  return (
    <div className="min-h-screen bg-white">
      <Navbar userType="Premier Client" />
      
      <div className="max-w-5xl mx-auto py-8 px-4">
        
        {/* Simple Identification Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center pb-8 mb-8 border-b border-slate-100 gap-6">
          <div className="flex items-center gap-5">
            <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.full_name}`} className="w-20 h-20 border border-slate-200 object-cover" />
            <div>
              <h2 className="text-2xl font-bold text-[#002b5c]">{profile.full_name}</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">ID: {profile.account_id} • {profile.nationality}</p>
            </div>
          </div>
          <div className="text-center md:text-right border-l-0 md:border-l pl-0 md:pl-8 border-slate-100">
             <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Available Balance</p>
             <h3 className="text-4xl font-bold text-slate-900">${parseFloat(profile.balance || 0).toLocaleString()}</h3>
          </div>
        </div>

        {/* Clean Tab Menu - No Background Colors */}
        <div className="flex gap-8 mb-8 border-b border-slate-100 overflow-x-auto">
          {['overview', 'transfer', 'withdraw', 'inbox'].map(tab => (
              <button 
                key={tab} 
                onClick={() => (tab === 'transfer' || tab === 'withdraw') ? handleAction(tab) : setActiveTab(tab)} 
                className={`pb-4 px-1 text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${activeTab === tab ? 'text-[#002b5c] border-b-2 border-[#002b5c]' : 'text-slate-400'}`}
              >
                  {tab} {tab === 'inbox' && inbox.length > 0 && `(${inbox.length})`}
              </button>
          ))}
        </div>

        {/* Data Display */}
        <div className="min-h-[400px]">
          {activeTab === 'overview' && (
             <div className="space-y-1">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-y border-slate-100">
                        <tr>
                            <th className="p-4 text-[9px] font-black uppercase text-slate-400">Date</th>
                            <th className="p-4 text-[9px] font-black uppercase text-slate-400">Description</th>
                            <th className="p-4 text-right text-[9px] font-black uppercase text-slate-400">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {transactions.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50/50">
                                <td className="p-4 text-xs text-slate-400 font-mono">{new Date(t.created_at).toLocaleDateString()}</td>
                                <td className="p-4 text-sm font-bold text-[#002b5c]">{t.description}</td>
                                <td className={`p-4 text-right font-bold text-sm ${t.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {t.type === 'credit' ? '+' : '-'}${parseFloat(t.amount).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {transactions.length === 0 && <p className="py-20 text-center text-slate-300 text-xs font-bold uppercase tracking-widest">No activity found</p>}
             </div>
          )}

          {activeTab === 'inbox' && (
            <div className="space-y-6">
              {inbox.map(m => (
                <div key={m.id} className="p-6 border-b border-slate-100">
                  <p className="text-[9px] text-slate-400 font-bold uppercase mb-2">{new Date(m.created_at).toLocaleString()}</p>
                  <h5 className="font-bold text-lg text-[#002b5c] mb-1">{m.title}</h5>
                  <p className="text-slate-600 text-sm leading-relaxed">{m.content}</p>
                </div>
              ))}
              {inbox.length === 0 && <p className="py-20 text-center text-slate-300 text-xs font-bold uppercase tracking-widest">Inbox is empty</p>}
            </div>
          )}

          {(activeTab === 'transfer' || activeTab === 'withdraw') && (
            <div className="max-w-md mx-auto py-12 px-6 border border-slate-100 bg-slate-50/50 text-center">
                <h3 className="text-lg font-bold text-slate-900 mb-6 uppercase tracking-widest">Initiate {activeTab}</h3>
                <input className="w-full border border-slate-200 p-3 rounded mb-4 text-sm outline-none focus:border-blue-600" placeholder="Destination / Account ID" />
                <input className="w-full border border-slate-200 p-3 rounded mb-8 text-center text-3xl font-bold outline-none focus:border-blue-600" placeholder="0.00" type="number" />
                <button className="w-full bg-[#002b5c] text-white py-4 rounded font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all">Submit Protocol</button>
            </div>
          )}
        </div>
      </div>

      {/* Restriction Modal - No Blurs, Simple Overlay */}
      {restriction && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-[2000] p-6">
          <div className="bg-white p-10 border border-slate-200 max-w-sm w-full text-center shadow-lg">
             <h3 className="text-xl font-bold mb-4 text-slate-900 uppercase tracking-tighter">{restriction.title}</h3>
             <p className="text-slate-500 mb-8 text-sm italic leading-relaxed">"{restriction.reason}"</p>
             <button onClick={() => setRestriction(null)} className="w-full bg-[#002b5c] text-white py-3 font-bold uppercase text-[10px] tracking-widest">Return</button>
          </div>
        </div>
      )}
    </div>
  );
}