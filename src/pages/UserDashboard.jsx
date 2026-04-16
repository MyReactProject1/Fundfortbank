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
  const [restriction, setRestriction] = useState(null); // Restriction modal state
  const [expandedId, setExpandedId] = useState(null);

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

  // --- LOGIC: RESTRICTION INTERCEPTOR ---
  const handleTabSelection = (tabName) => {
    if (tabName === 'withdraw') {
      if (profile.withdraw_restricted) {
        setRestriction({ title: "Circuit Locked", reason: profile.withdraw_reason });
        return; // Stops the tab from switching
      }
    }
    if (tabName === 'transfer') {
      if (profile.transfer_restricted) {
        setRestriction({ title: "Protocol Suspended", reason: profile.transfer_reason });
        return; // Stops the tab from switching
      }
    }
    setActiveTab(tabName);
  };

  if (!profile) return <div className="h-screen bg-white flex items-center justify-center font-bold tracking-[0.5em] text-slate-300">ESTABLISHING SECURE PROTOCOL...</div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans print:bg-white pb-20">
      <div className="print-hidden"><Navbar userType="Premier Identity" /></div>
      
      <div className="max-w-6xl mx-auto py-8 px-4 md:px-6">
        
        {/* --- DYNAMIC HEADER --- */}
        <header className="bg-white border border-slate-200 p-8 md:p-12 mb-10 flex flex-col md:flex-row justify-between items-center gap-8 animate-fadeIn print-hidden shadow-sm">
          <div className="flex items-center gap-6 w-full md:w-auto">
            <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.full_name}`} className="w-20 md:w-28 h-20 md:h-28 border object-cover shadow-sm" />
            <div className="text-center md:text-left">
                <h2 className="text-3xl md:text-5xl font-bold text-[#002147] tracking-tighter uppercase italic">{profile.full_name}</h2>
                <p className="text-[10px] font-black text-slate-400 tracking-widest mt-1 uppercase italic">Identity Ref: {profile.account_id}</p>
            </div>
          </div>
          <div className="w-full md:w-auto text-center md:text-right border-t md:border-t-0 md:border-l border-slate-100 pt-8 md:pt-0 md:pl-12">
             <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.5em] mb-2 italic">Available pool liquidity</p>
             <h3 className="text-4xl md:text-7xl font-black text-slate-900 tracking-tighter italic uppercase">${parseFloat(profile.balance || 0).toLocaleString()}</h3>
          </div>
        </header>

        {/* --- NAVIGATION TABS --- */}
        <div className="flex gap-8 mb-10 border-b border-slate-200 overflow-x-auto print-hidden no-scrollbar">
          {['overview', 'transfer', 'withdraw', 'inbox'].map(tab => (
              <button 
                key={tab} 
                onClick={() => handleTabSelection(tab)} 
                className={`pb-4 px-1 text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all italic ${activeTab === tab ? 'text-[#002147] border-b-4 border-[#002147]' : 'text-slate-300 hover:text-[#002147]'}`}
              >
                  {tab} {tab === 'inbox' && inbox.length > 0 && <span className="ml-1 bg-emerald-500 text-white px-1.5 rounded-full">+{inbox.length}</span>}
              </button>
          ))}
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="min-h-[450px]">
          
          {/* LEDGER VIEW (SWAPPED: AMOUNT LEFT | DATE RIGHT) */}
          {activeTab === 'overview' && (
             <div className="bg-white border border-slate-200 shadow-sm animate-fadeIn">
                <div className="table-scroll border-none!">
                    <table className="w-full text-left min-w-[750px]">
                        <thead className="bg-slate-50 border-b-2 border-slate-200 text-slate-400 italic">
                            <tr>
                                <th className="p-6 text-[9px] font-black uppercase tracking-widest px-8">Impact Value</th>
                                <th className="p-6 text-[9px] font-black uppercase tracking-widest">Registry Reference</th>
                                <th className="p-6 text-[9px] font-black uppercase tracking-widest">Status</th>
                                <th className="p-6 text-right text-[9px] font-black uppercase tracking-widest px-10">Entry Stamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 italic">
                            {transactions.map(t => (
                                <React.Fragment key={t.id}>
                                    <tr onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="hover:bg-slate-50 transition-all cursor-pointer group">
                                        <td className={`p-8 font-black text-2xl tracking-tighter ${t.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {t.type === 'credit' ? '+' : '-'}${parseFloat(t.amount).toLocaleString()}
                                        </td>
                                        <td className="p-8 font-bold text-sm text-[#002147] uppercase tracking-tighter opacity-80 group-hover:opacity-100">
                                            {t.description}
                                        </td>
                                        <td className="p-8">
                                            <span className={`text-[10px] font-black uppercase px-3 py-1 border rounded-sm ${t.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                {t.status}
                                            </span>
                                        </td>
                                        <td className="p-8 text-right text-xs text-slate-300 font-mono italic px-10 group-hover:text-[#002147]">
                                            {new Date(t.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>

                                    {/* EXPANDED MANIFEST */}
                                    {expandedId === t.id && (
                                        <tr className="bg-slate-50/30 animate-fadeIn">
                                            <td colSpan="4" className="p-6 md:p-16">
                                                <div className="bg-white border-2 border-slate-200 p-10 md:p-16 max-w-2xl mx-auto shadow-2xl relative receipt-card border-l-[15px] border-l-[#002147]">
                                                    <div className="flex justify-between border-b-2 pb-8 mb-12 italic">
                                                        <div><h4 className="text-4xl font-black text-[#002147]">FundFort<span className="text-emerald-500 font-light">Bank</span></h4><p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2 underline decoration-emerald-100">Certified Asset Manifest</p></div>
                                                        <div className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 space-y-1"><p>Moniker Hash: {t.reference_number || 'FF-ARCH-'+t.id}</p><p>{new Date(t.created_at).toLocaleString()}</p></div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-12 font-bold uppercase italic text-sm">
                                                        <div className="space-y-6"><div><p className="text-[9px] text-slate-400 block mb-2 underline decoration-emerald-500">Legal Holder</p><p className="tracking-tighter">{profile.full_name}</p></div><div><p className="text-[9px] text-slate-400 block mb-2 underline decoration-emerald-500">Reference memo</p><p className="tracking-tighter">{t.description}</p></div></div>
                                                        <div className="space-y-6"><div><p className="text-[9px] text-slate-400 block mb-2 underline decoration-emerald-500">Settlement Bank</p><p className="tracking-tighter">{t.recipient_bank || 'PRIMARY RESERVE'}</p></div><div><p className="text-[9px] text-slate-400 block mb-2 underline decoration-emerald-500">Receipt Moniker</p><p className="tracking-tighter italic">FFB-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p></div></div>
                                                    </div>
                                                    <div className="mt-16 pt-10 border-t-2 border-dashed border-slate-100 flex justify-between items-center italic uppercase">
                                                        <div className="bg-slate-900 text-white px-4 py-1 text-[9px] font-black">SYSTEM_VERIFIED_PROTOCOL</div>
                                                        <div className="text-right leading-none"><p className="text-[11px] font-black text-slate-400 mb-2">Final pool impact</p><p className={`text-6xl font-black italic tracking-tighter ${t.type === 'credit' ? 'text-emerald-500' : 'text-rose-600'}`}>{t.type === 'credit' ? 'CR' : 'DB'} ${parseFloat(t.amount).toLocaleString()}</p></div>
                                                    </div>
                                                    <div className="mt-12 flex gap-4 print-hidden">
                                                        <button onClick={() => window.print()} className="bg-[#002147] text-white px-8 py-3 text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-900 transition-colors">Download protocol</button>
                                                        <button onClick={() => setExpandedId(null)} className="text-slate-300 font-bold uppercase text-[10px] tracking-widest italic underline underline-offset-4 decoration-slate-100">Exit Manifest</button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
                {transactions.length === 0 && <p className="py-40 text-center opacity-10 font-black italic text-4xl uppercase tracking-[0.5em]">No records</p>}
             </div>
          )}

          {/* SECURE INBOX */}
          {activeTab === 'inbox' && (
            <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
              <h4 className="text-xl font-bold uppercase text-slate-400 mb-8 tracking-widest italic underline decoration-emerald-500 decoration-8 underline-offset-[12px]">Vault communiqués</h4>
              {inbox.map(m => (
                <div key={m.id} className="p-8 md:p-12 bg-white border border-slate-200 shadow-sm relative group">
                  <div className="absolute top-0 left-0 w-2 h-full bg-[#002147] group-hover:bg-emerald-500 transition-colors"></div>
                  <div className="flex justify-between items-start mb-6 opacity-40">
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest italic">Entry Point ID: {m.id}</span>
                    <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{new Date(m.created_at).toLocaleString()}</span>
                  </div>
                  <h5 className="font-black text-2xl text-[#002147] uppercase italic tracking-tighter mb-4 underline decoration-slate-50 decoration-[10px] underline-offset-4">{m.title}</h5>
                  <p className="text-slate-600 text-lg leading-relaxed italic font-medium opacity-90 leading-relaxed">"{m.content}"</p>
                </div>
              ))}
              {inbox.length === 0 && <p className="py-32 text-center text-slate-200 font-black uppercase tracking-[0.4em] italic text-sm">Registry archives clear</p>}
            </div>
          )}

          {/* TRANSFER / WITHDRAW FORMS */}
          {(activeTab === 'transfer' || activeTab === 'withdraw') && (
            <div className="max-w-lg mx-auto py-16 px-8 bg-white border border-slate-200 text-center animate-fadeIn shadow-lg">
                <h3 className="text-2xl font-black text-[#002147] mb-12 uppercase tracking-[0.3em] italic underline decoration-emerald-500 decoration-[10px] underline-offset-[14px]">Protocol Initiation</h3>
                <div className="space-y-8 text-left mb-12 italic">
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-300 tracking-widest mb-2 block px-2 italic">Recipient reference moniker</label>
                        <input className="w-full border border-slate-100 p-4 rounded-sm text-sm outline-none focus:border-[#002147] font-bold bg-slate-50" placeholder="Destination Access ID" />
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase text-slate-300 tracking-widest mb-2 block px-2 italic">Execution fund value ($)</label>
                        <input className="w-full border border-slate-100 p-6 rounded-sm text-center text-6xl font-black focus:border-[#002147] outline-none text-[#002147] bg-slate-50 tracking-tighter" placeholder="0.00" type="number" />
                    </div>
                </div>
                <button className="w-full bg-[#002147] text-white py-6 rounded-sm font-black uppercase tracking-[0.4em] text-[11px] shadow-lg italic transition-transform active:scale-95">Complete secure protocol</button>
            </div>
          )}
        </div>
      </div>

      {/* --- RESTRICTION MODAL (SYSTEM INTERLOCK) --- */}
      {restriction && (
        <div className="fixed inset-0 bg-[#002147]/95 flex items-center justify-center z-[5000] p-6 backdrop-blur-md">
          <div className="bg-white p-12 md:p-20 border-t-[30px] border-rose-600 w-full max-w-md text-center shadow-2xl animate-scaleIn">
             <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-10 text-5xl font-black animate-pulse">!</div>
             <h3 className="text-3xl font-black mb-4 uppercase text-[#002147] italic tracking-tight underline decoration-rose-50 underline-offset-4">{restriction.title}</h3>
             <p className="text-slate-500 mb-14 text-xl italic leading-relaxed font-bold opacity-70 leading-relaxed px-4">"{restriction.reason}"</p>
             <button onClick={() => setRestriction(null)} className="w-full bg-[#002147] text-white py-6 rounded-sm font-black uppercase tracking-[0.4em] text-[10px] shadow-2xl hover:bg-rose-600 transition-colors italic">Return to registry</button>
             <p className="mt-8 text-[9px] text-slate-300 font-bold uppercase tracking-[0.3em] opacity-40">System_interlock_Protocol: Error_6642</p>
          </div>
        </div>
      )}
    </div>
  );
}