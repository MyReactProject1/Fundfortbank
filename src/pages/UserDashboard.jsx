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
    if (type === 'withdraw' && profile.withdraw_restricted) setRestriction({ title: "Circuit Locked", reason: profile.withdraw_reason });
    else if (type === 'transfer' && profile.transfer_restricted) setRestriction({ title: "Transfer Suspended", reason: profile.transfer_reason });
    else setActiveTab(type);
  };

  if (!profile) return <div className="p-20 text-center font-bold text-slate-300">Verifying Identity...</div>;

  return (
    <div className="min-h-screen bg-white text-slate-800 pb-20">
      <Navbar userType="Authorized Client" />
      <div className="max-w-6xl mx-auto py-8 px-4 md:px-6">
        
        {/* Responsive Identity Bar - Stacks on Mobile */}
        <div className="flex flex-col md:flex-row justify-between items-center pb-8 border-b border-slate-100 gap-8">
          <div className="flex items-center gap-6 w-full md:w-auto">
            <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.full_name}`} className="w-16 h-16 md:w-24 md:h-24 border border-slate-200" alt="avatar" />
            <div>
              <h2 className="text-xl md:text-3xl font-bold text-[#002147] uppercase">{profile.full_name}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client Ref: {profile.account_id}</p>
            </div>
          </div>
          <div className="w-full md:w-auto text-center md:text-right border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-10">
             <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Available Funds</p>
             <h3 className="text-4xl md:text-6xl font-bold text-[#002147] tracking-tighter italic">${parseFloat(profile.balance || 0).toLocaleString()}</h3>
          </div>
        </div>

        {/* Dynamic Navigation - Scrollable on very small screens */}
        <div className="flex gap-8 mb-8 border-b border-slate-100 overflow-x-auto whitespace-nowrap">
          {['overview', 'transfer', 'withdraw', 'inbox'].map(tab => (
              <button key={tab} onClick={() => (tab === 'transfer' || tab === 'withdraw') ? handleAction(tab) : setActiveTab(tab)} 
              className={`pb-4 px-1 text-[10px] font-black uppercase tracking-[0.2em] ${activeTab === tab ? 'text-[#002147] border-b-2 border-[#002147]' : 'text-slate-300'}`}>
                  {tab} {tab === 'inbox' && inbox.length > 0 && `(${inbox.length})`}
              </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="min-h-[400px]">
          {activeTab === 'overview' && (
             <div className="scroll-container border-none!">
                <table className="w-full text-left min-w-[600px]">
                    <thead className="bg-slate-50">
                        <tr className="text-[10px] uppercase font-bold text-slate-400">
                            <th className="p-4">Date</th>
                            <th className="p-4">Memo</th>
                            <th className="p-4 text-right">Fund Delta</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {transactions.map(t => (
                            <tr key={t.id} className="text-sm">
                                <td className="p-4 text-xs font-mono text-slate-400">{new Date(t.created_at).toLocaleDateString()}</td>
                                <td className="p-4 font-bold text-[#002147] uppercase">{t.description}</td>
                                <td className={`p-4 text-right font-bold ${t.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {t.type === 'credit' ? '+' : '-'}${parseFloat(t.amount).toLocaleString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {transactions.length === 0 && <p className="py-20 text-center text-slate-300 text-[10px] font-black uppercase italic">Archives Empty</p>}
             </div>
          )}

          {activeTab === 'inbox' && (
            <div className="max-w-4xl space-y-6">
              {inbox.map(m => (
                <div key={m.id} className="p-6 md:p-10 border-b border-slate-100 bg-white">
                  <p className="text-[9px] text-slate-400 font-black uppercase mb-2 tracking-widest">{new Date(m.created_at).toLocaleString()}</p>
                  <h5 className="font-bold text-lg text-[#002147] uppercase italic mb-2 tracking-tight underline decoration-slate-100">{m.title}</h5>
                  <p className="text-slate-600 text-sm leading-relaxed">{m.content}</p>
                </div>
              ))}
              {inbox.length === 0 && <p className="py-20 text-center text-slate-300 font-black uppercase text-[10px]">No communications</p>}
            </div>
          )}

          {(activeTab === 'transfer' || activeTab === 'withdraw') && (
            <div className="max-w-md mx-auto py-16 px-4 text-center border-2 border-slate-50 shadow-sm">
                <h3 className="text-xl font-bold text-[#002147] mb-8 uppercase tracking-widest">Execute Private {activeTab}</h3>
                <input className="w-full border p-4 mb-4 text-sm focus:border-[#002147] outline-none font-bold text-center" placeholder="Acc Key / ID" />
                <input className="w-full border p-4 mb-10 text-center text-4xl font-bold focus:border-[#002147] outline-none" placeholder="0.00" type="number" />
                <button className="w-full bg-[#002147] text-white py-4 font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md">Complete Protocol</button>
            </div>
          )}
        </div>
      </div>

      {/* Basic Mobile Responsive Modal */}
      {restriction && (
        <div className="fixed inset-0 bg-[#002147]/80 flex items-center justify-center z-[2000] p-4">
          <div className="bg-white p-10 md:p-16 border-t-[8px] border-rose-600 w-full max-w-md text-center shadow-2xl">
             <h3 className="text-2xl font-bold mb-4 uppercase text-[#002147]">{restriction.title}</h3>
             <p className="text-slate-500 mb-10 text-sm italic">"{restriction.reason}"</p>
             <button onClick={() => setRestriction(null)} className="w-full bg-[#002147] text-white py-4 font-bold text-xs uppercase tracking-widest">Acknowledge</button>
          </div>
        </div>
      )}
    </div>
  );
}