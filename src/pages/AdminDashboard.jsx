import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../lib/cropImage';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [globalLoading, setGlobalLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  
  // Modal Management
  const [editingCustomer, setEditingCustomer] = useState(null); // Profile/Interlock
  const [manageHistory, setManageHistory] = useState(null);      // Ledger History
  const [userTransactions, setUserTransactions] = useState([]);
  const [transactionForm, setTransactionForm] = useState(null);  // Add/Edit individual Trans
  const [userMessages, setUserMessages] = useState([]);         // All inbox messages
  const [editingMessage, setEditingMessage] = useState(null);   // Message Hub State
  const [imageSrc, setImageSrc] = useState(null);               // Cropper raw image
  
  // Forms
  const [regForm, setRegForm] = useState({ email: '', fullName: '', accountId: '' });

  // Cropper States
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate('/');
      else fetchCustomers();
    };
    checkSession();
  }, [navigate]);

  const runAction = async (callback) => {
    setGlobalLoading(true);
    try { await callback(); } catch (e) { alert("Action Failed: " + e.message); } finally { setGlobalLoading(false); }
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers(data || []);
  };

  // --- 1. PROFILE UPDATE LOGIC ---
  const saveProfileChanges = () => {
    runAction(async () => {
      const { error } = await supabase.from('customers').update({
          full_name: editingCustomer.full_name,
          balance: parseFloat(editingCustomer.balance),
          withdraw_restricted: editingCustomer.withdraw_restricted,
          withdraw_reason: editingCustomer.withdraw_reason,
          transfer_restricted: editingCustomer.transfer_restricted,
          transfer_reason: editingCustomer.transfer_reason,
          avatar_url: editingCustomer.avatar_url
        }).eq('id', editingCustomer.id);

      if (error) throw error;
      setEditingCustomer(null);
      fetchCustomers();
    });
  };

  // --- 2. INBOX HUB LOGIC (SEND/EDIT) ---
  const openInboxHub = (customer) => {
    runAction(async () => {
        const { data } = await supabase.from('inbox_messages').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false });
        setUserMessages(data || []);
        setEditingMessage({ customer_id: customer.id, title: '', content: '', id: null });
    });
  };

  const saveInboxMessage = () => {
    runAction(async () => {
      if (!editingMessage.title || !editingMessage.content) return alert("Fields required");
      if (editingMessage.id) {
        await supabase.from('inbox_messages').update({ title: editingMessage.title, content: editingMessage.content }).eq('id', editingMessage.id);
      } else {
        await supabase.from('inbox_messages').insert([{ customer_id: editingMessage.customer_id, title: editingMessage.title, content: editingMessage.content }]);
      }
      openInboxHub({ id: editingMessage.customer_id }); // Refresh list
    });
  };

  // --- 3. AUTO-BALANCE TRANSACTION LOGIC ---
  const handleAddTransaction = () => {
    runAction(async () => {
      const { amount, description, type } = transactionForm;
      const amountVal = parseFloat(amount);
      await supabase.from('transactions').insert([{ customer_id: manageHistory.id, amount: amountVal, type, description }]);
      
      const currentBal = parseFloat(manageHistory.balance || 0);
      const newBal = type === 'credit' ? currentBal + amountVal : currentBal - amountVal;
      
      await supabase.from('customers').update({ balance: newBal }).eq('id', manageHistory.id);
      setManageHistory({ ...manageHistory, balance: newBal });
      setTransactionForm(null);
      const { data: trans } = await supabase.from('transactions').select('*').eq('customer_id', manageHistory.id).order('created_at', { ascending: false });
      setUserTransactions(trans || []);
      fetchCustomers();
    });
  };

  const handleUploadAvatar = () => {
    runAction(async () => {
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      const fileName = `${editingCustomer.id}/id-${Date.now()}.jpg`;
      await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('customers').update({ avatar_url: publicUrl }).eq('id', editingCustomer.id);
      setEditingCustomer({ ...editingCustomer, avatar_url: publicUrl });
      setImageSrc(null);
      fetchCustomers();
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-20 font-sans">
      {globalLoading && (
        <div className="fixed top-0 left-0 w-full h-1.5 bg-emerald-100 z-[2000] overflow-hidden">
          <div className="animate-progress h-full bg-emerald-500 shadow-[0_0_15px_#10b981]"></div>
        </div>
      )}
      <Navbar userType="Bank Operations" />

      <div className="max-w-7xl mx-auto py-10 px-4 md:px-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
            <h2 onClick={() => navigate('/')} className="text-3xl font-black italic uppercase tracking-tighter cursor-pointer text-[#0f172a] underline decoration-emerald-500 decoration-8 underline-offset-8">FundFort Console</h2>
            <div className="flex gap-2">
                <span className="text-[10px] bg-white px-4 py-1.5 rounded-full font-black text-slate-400 border border-slate-200 uppercase tracking-widest italic">Layer-7 Security Verified</span>
            </div>
        </header>

        {/* --- ADD CLIENT (RESPONSIVE) --- */}
        <section className="bg-white p-6 md:p-8 rounded-[3rem] shadow-2xl border mb-12 grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-fadeIn">
            <input placeholder="Legal Moniker" onChange={e => setRegForm({...regForm, fullName: e.target.value})} className="bg-slate-50 p-4 rounded-2xl border focus:ring-2 focus:ring-emerald-500 outline-none font-bold" />
            <input placeholder="Official Email" onChange={e => setRegForm({...regForm, email: e.target.value})} className="bg-slate-50 p-4 rounded-2xl border focus:ring-2 focus:ring-emerald-500 outline-none font-bold" />
            <input placeholder="Pass-Key ID" onChange={e => setRegForm({...regForm, accountId: e.target.value})} className="bg-slate-50 p-4 rounded-2xl border focus:ring-2 focus:ring-emerald-500 outline-none font-bold tracking-widest" />
            <button onClick={() => runAction(async () => {
                const { data } = await supabase.auth.signUp({ email: regForm.email, password: regForm.accountId });
                await supabase.from('customers').insert([{ id: data.user.id, email: regForm.email, full_name: regForm.fullName, account_id: regForm.accountId, balance: 0 }]);
                fetchCustomers();
                alert("Account provisioned successfully.");
            })} className="bg-[#0f172a] text-white h-[58px] rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-600 transition-all shadow-xl shadow-[#0f172a]/20">Establish Client</button>
        </section>

        {/* --- CUSTOMER TABLE --- */}
        <div className="bg-white rounded-[4rem] shadow-2xl border overflow-hidden animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-bold min-w-[850px]">
                <thead className="bg-[#0f172a] text-white text-[9px] uppercase tracking-[0.4em] font-black italic opacity-90">
                    <tr><th className="p-8 text-slate-400">Biological ID</th><th className="p-8 text-right text-slate-400 tracking-tighter">Current Assets</th><th className="p-8 text-center text-slate-400">Command</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {customers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-all group">
                            <td className="p-8 flex items-center gap-6">
                                <img src={c.avatar_url || `https://ui-avatars.com/api/?name=${c.full_name}&background=random`} className="w-16 h-16 rounded-[2rem] object-cover border-2 shadow-md group-hover:scale-110 transition-transform" />
                                <div><p className="text-2xl font-black italic tracking-tighter text-[#0f172a]">{c.full_name}</p><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{c.account_id}</p></div>
                            </td>
                            <td className="p-8 text-right text-4xl font-black text-emerald-600 tracking-tighter italic">${parseFloat(c.balance || 0).toLocaleString()}</td>
                            <td className="p-8 text-center flex justify-center gap-2">
                                <button onClick={() => setEditingCustomer(c)} className="bg-slate-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-slate-900 hover:text-white transition-all">Profile</button>
                                <button onClick={() => runAction(async () => {
                                    setManageHistory(c);
                                    const { data } = await supabase.from('transactions').select('*').eq('customer_id', c.id).order('created_at', { ascending: false });
                                    setUserTransactions(data || []);
                                })} className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-200">Ledger</button>
                                <button onClick={() => openInboxHub(c)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-200 transition-all">Inbox</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- MODAL: INBOX BROADCAST HUB (FIXED DISPLAY) --- */}
      {editingMessage && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-xl flex items-center justify-center p-4 z-[500] overflow-hidden">
          <div className="bg-white rounded-[4rem] w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl border-4 border-white overflow-hidden animate-fadeIn">
            <header className="p-8 md:p-10 border-b flex justify-between items-center bg-blue-50/50">
              <div className="flex items-center gap-4">
                <div className="w-2 h-10 bg-blue-600 rounded-full animate-pulse"></div>
                <h3 className="text-3xl font-black italic uppercase tracking-tighter">Vault Dispatch Center</h3>
              </div>
              <button onClick={() => setEditingMessage(null)} className="bg-white w-14 h-14 rounded-full flex items-center justify-center text-4xl shadow-lg hover:bg-rose-500 hover:text-white transition-all">&times;</button>
            </header>
            
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
                {/* Left side: Sent History */}
                <div className="p-6 md:p-10 overflow-y-auto border-r border-slate-100 bg-slate-50/30">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 mb-8 underline decoration-blue-100 decoration-8 underline-offset-8">Sent Messages Ledger</h4>
                    <div className="space-y-4">
                        {userMessages.map(m => (
                            <div key={m.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200 hover:border-blue-500 transition-all group">
                                <h5 className="font-black text-blue-700 italic uppercase mb-2 text-lg underline decoration-blue-50 underline-offset-4 tracking-tighter">{m.title}</h5>
                                <p className="text-slate-500 text-xs font-medium italic mb-6 leading-relaxed">"{m.content}"</p>
                                <div className="flex gap-6 border-t pt-4">
                                    <button onClick={() => setEditingMessage({...editingMessage, ...m})} className="text-[9px] font-black uppercase text-blue-400 hover:text-blue-900 flex items-center gap-1 italic">Edit Protocol</button>
                                    <button onClick={() => runAction(async () => {
                                        if(!window.confirm("Permanently wipe dispatch record?")) return;
                                        await supabase.from('inbox_messages').delete().eq('id', m.id);
                                        openInboxHub({ id: editingMessage.customer_id });
                                    })} className="text-[9px] font-black uppercase text-rose-300 hover:text-rose-600 italic">Wipe Registry</button>
                                </div>
                            </div>
                        ))}
                        {userMessages.length === 0 && <div className="py-20 text-center opacity-10 font-black italic text-4xl uppercase">No Communiques</div>}
                    </div>
                </div>

                {/* Right side: Modern Editor */}
                <div className="p-8 md:p-12 flex flex-col bg-white">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-300 mb-10 italic">
                        {editingMessage.id ? 'Modify Existing Broadcast Registry' : 'Initialize New Global Broadcast'}
                    </h4>
                    <label className="text-[10px] font-black uppercase px-6 mb-2 text-slate-400">Subject Marker</label>
                    <input className="w-full bg-slate-100 p-6 rounded-[2.5rem] mb-6 font-black text-xl italic border-none focus:ring-4 focus:ring-blue-100 outline-none" value={editingMessage.title} onChange={e => setEditingMessage({...editingMessage, title: e.target.value})} placeholder="Ex: Account Suspension Notification" />
                    
                    <label className="text-[10px] font-black uppercase px-6 mb-2 text-slate-400">Message Content</label>
                    <textarea className="flex-1 w-full bg-slate-100 p-8 rounded-[3rem] mb-8 font-medium italic leading-relaxed text-slate-600 focus:ring-4 focus:ring-blue-100 outline-none" value={editingMessage.content} onChange={e => setEditingMessage({...editingMessage, content: e.target.value})} placeholder="Detailed communication body..." />
                    
                    <div className="flex gap-4">
                        <button onClick={saveInboxMessage} className="flex-1 bg-blue-600 text-white py-8 rounded-[3rem] font-black uppercase tracking-widest text-[11px] shadow-2xl italic hover:bg-slate-900 transition-all transform hover:-translate-y-1">Transmit Protocol Communique</button>
                        {editingMessage.id && <button onClick={() => setEditingMessage({ customer_id: editingMessage.customer_id, title: '', content: '', id: null })} className="bg-slate-100 px-8 rounded-[2rem] text-slate-400 font-bold text-xs uppercase">Reset</button>}
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: IDENTITY PROFILE (CLOSE BUTTON FIXED) --- */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-2xl flex items-center justify-center p-4 z-[100] overflow-y-auto">
          <div className="bg-white rounded-[5rem] p-10 md:p-16 max-w-5xl w-full shadow-2xl my-10 relative border-8 border-white animate-fadeIn">
            <button onClick={() => setEditingCustomer(null)} className="absolute top-8 right-10 text-6xl font-light hover:text-rose-500 transition-colors">&times;</button>
            
            <header className="mb-16 border-b pb-12 italic">
                <h3 className="text-4xl md:text-6xl font-black uppercase tracking-tighter underline decoration-emerald-500 decoration-8 underline-offset-[20px]">Master Protocol Interlock</h3>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-20">
                <div className="space-y-10 border-r md:pr-12 text-center md:text-left">
                    <img src={editingCustomer.avatar_url || `https://ui-avatars.com/api/?name=${editingCustomer.full_name}`} className="w-56 h-56 rounded-[5rem] mx-auto object-cover border-8 border-slate-50 shadow-2xl transition-transform hover:scale-105" />
                    <input type="file" id="pic_up" className="hidden" onChange={(e) => setImageSrc(URL.createObjectURL(e.target.files[0]))} />
                    <label htmlFor="pic_up" className="bg-[#0f172a] text-white block py-6 rounded-[3rem] text-center text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-emerald-600 shadow-xl italic transition-all">Re-Scan Biological Profile</label>
                    
                    <div className="space-y-4 text-left pt-10">
                        <label className="text-[10px] font-black uppercase text-slate-300 ml-6 tracking-[0.5em]">Legal Moniker</label>
                        <input className="w-full bg-slate-50 p-6 rounded-3xl font-black text-2xl italic tracking-tighter uppercase focus:ring-4 focus:ring-emerald-50 shadow-inner" value={editingCustomer.full_name} onChange={e => setEditingCustomer({...editingCustomer, full_name: e.target.value})} />
                        <label className="text-[10px] font-black uppercase text-slate-300 ml-6 tracking-[0.5em]">Liquid Pool Limit ($)</label>
                        <input className="w-full bg-slate-50 p-6 rounded-3xl font-black text-6xl italic tracking-tighter text-emerald-600 focus:ring-4 focus:ring-emerald-50 shadow-inner" type="number" value={editingCustomer.balance} onChange={e => setEditingCustomer({...editingCustomer, balance: e.target.value})} />
                    </div>
                </div>

                <div className="space-y-12">
                    <h4 className="text-[10px] text-slate-400 uppercase tracking-widest font-black flex items-center gap-3 italic"><div className="w-3 h-3 bg-rose-500 rounded-full animate-ping"></div> Live Security Interlocks</h4>
                    <div className={`p-10 rounded-[4rem] border-2 transition-all ${editingCustomer.withdraw_restricted ? 'bg-rose-50 border-rose-200 shadow-rose-100' : 'bg-slate-50 border-transparent shadow-inner'}`}>
                        <div className="flex justify-between items-center mb-8 font-black uppercase italic text-xs"><span>Withdraw Circuit Protocol</span>
                            <button onClick={() => setEditingCustomer({...editingCustomer, withdraw_restricted: !editingCustomer.withdraw_restricted})} className={`w-14 h-8 rounded-full relative transition-all ${editingCustomer.withdraw_restricted ? 'bg-rose-600 shadow-md shadow-rose-200' : 'bg-slate-300'}`}><div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${editingCustomer.withdraw_restricted ? 'left-7' : 'left-1'}`} /></button>
                        </div>
                        <textarea className="w-full bg-white/60 border border-white rounded-[2rem] p-6 text-[11px] font-bold text-slate-500 italic leading-relaxed" placeholder="State reason..." value={editingCustomer.withdraw_reason} onChange={e => setEditingCustomer({...editingCustomer, withdraw_reason: e.target.value})} />
                    </div>

                    <div className={`p-10 rounded-[4rem] border-2 transition-all ${editingCustomer.transfer_restricted ? 'bg-rose-50 border-rose-200 shadow-rose-100' : 'bg-slate-50 border-transparent shadow-inner'}`}>
                        <div className="flex justify-between items-center mb-8 font-black uppercase italic text-xs"><span>Transfer Circuit Protocol</span>
                            <button onClick={() => setEditingCustomer({...editingCustomer, transfer_restricted: !editingCustomer.transfer_restricted})} className={`w-14 h-8 rounded-full relative transition-all ${editingCustomer.transfer_restricted ? 'bg-rose-600 shadow-md shadow-rose-200' : 'bg-slate-300'}`}><div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${editingCustomer.transfer_restricted ? 'left-7' : 'left-1'}`} /></button>
                        </div>
                        <textarea className="w-full bg-white/60 border border-white rounded-[2rem] p-6 text-[11px] font-bold text-slate-500 italic leading-relaxed" placeholder="State reason..." value={editingCustomer.transfer_reason} onChange={e => setEditingCustomer({...editingCustomer, transfer_reason: e.target.value})} />
                    </div>
                    
                    <button onClick={saveProfileChanges} className="w-full bg-emerald-600 text-white py-10 rounded-[4rem] font-black uppercase italic tracking-widest text-[11px] shadow-2xl active:scale-95 transition-all hover:bg-slate-900 transform hover:-translate-y-2">Execute Global Command Commit</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AUDIT LEDGER (AUDITORS CLOSE BUTTON) */}
      {manageHistory && (
        <div className="fixed inset-0 bg-[#0a0a0a]/98 backdrop-blur-3xl flex items-center justify-center p-4 z-[400]">
            <div className="bg-white rounded-[5rem] w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl border-t-[20px] border-emerald-500 overflow-hidden animate-fadeIn">
                <header className="p-12 md:p-16 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-slate-50 relative">
                    <button onClick={() => setManageHistory(null)} className="absolute top-8 right-10 text-5xl font-light hover:text-rose-500 transition-colors">&times;</button>
                    <div>
                        <h3 className="text-5xl font-black italic tracking-tighter uppercase underline decoration-[#0f172a] decoration-4 underline-offset-[10px] mb-4">Registry Audit: {manageHistory.full_name}</h3>
                        <p className="text-emerald-600 font-black text-3xl tracking-tighter italic font-mono uppercase bg-emerald-100 inline-block px-4 py-1 rounded-xl">Current Liquid Available: ${parseFloat(manageHistory.balance || 0).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 pr-20">
                        <button onClick={() => setTransactionForm({ type: 'credit', amount: 0, description: '' })} className="bg-emerald-600 text-white px-8 py-5 rounded-[2rem] font-black uppercase italic text-[10px] shadow-xl hover:bg-slate-900 transition-all">Manual Fund Injection</button>
                        <button onClick={() => setTransactionForm({ type: 'debit', amount: 0, description: '' })} className="bg-rose-600 text-white px-8 py-5 rounded-[2rem] font-black uppercase italic text-[10px] shadow-xl hover:bg-slate-900 transition-all">Apply Fund Levy</button>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-8 md:p-16">
                    <div className="table-container">
                        <table className="w-full text-left font-black min-w-[900px]">
                            <thead className="text-[10px] uppercase tracking-[0.5em] text-slate-300 border-b-2 pb-8 italic">
                                <tr><th className="pb-10">Registry Stamp</th><th className="pb-10">Reference Hash/Memo</th><th className="pb-10 text-right">Liquidity Delta</th><th className="pb-10 text-center uppercase tracking-widest">Wipe Circuit</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {userTransactions.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-50/80 transition-all group">
                                        <td className="py-10 text-xs text-slate-400 font-mono italic tracking-tighter">{new Date(t.created_at).toLocaleString()}</td>
                                        <td className="py-10 text-[#0f172a] text-xl uppercase italic tracking-tighter font-black underline decoration-slate-100 underline-offset-8">{t.description}</td>
                                        <td className={`py-10 text-right text-5xl tracking-tighter italic ${t.type === 'credit' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {t.type === 'credit' ? '+' : '-'}${parseFloat(t.amount).toLocaleString()}
                                        </td>
                                        <td className="py-10 text-center">
                                            <button onClick={() => handleDeleteTransaction(t)} className="bg-rose-50 text-rose-500 px-10 py-3 rounded-full text-[10px] uppercase italic tracking-widest hover:bg-rose-600 hover:text-white transition-all underline decoration-rose-100 underline-offset-4 decoration-2">Erase History</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {userTransactions.length === 0 && <div className="py-40 text-center font-black uppercase italic text-slate-100 text-6xl tracking-[0.5em]">No Data</div>}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* MODAL: TRANSACTION FORM (NESTED MODAL) */}
      {transactionForm && (
        <div className="fixed inset-0 bg-black/98 flex items-center justify-center p-6 z-[600] animate-fadeIn">
            <div className="bg-white p-12 md:p-20 rounded-[5rem] w-full max-w-2xl text-center border-t-[30px] border-emerald-500 shadow-2xl font-black uppercase">
                <h3 className="text-4xl italic mb-12 tracking-tighter">Execute Protocol Handshake: {transactionForm.type}</h3>
                <label className="text-[10px] text-slate-300 block mb-2 tracking-[0.5em]">Liquid Value Change ($)</label>
                <input className="w-full bg-slate-50 p-10 rounded-3xl mb-6 text-center text-7xl italic border-none focus:ring-0 outline-none" placeholder="0.00" type="number" onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})} />
                
                <label className="text-[10px] text-slate-300 block mb-2 tracking-[0.5em]">Registry Moniker/Memo</label>
                <input className="w-full bg-slate-50 p-6 rounded-3xl mb-12 uppercase text-[11px] tracking-[0.2em] text-center italic outline-none border focus:bg-emerald-50 transition-colors" placeholder="Memo Reference" onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} />
                
                <div className="flex flex-col gap-6">
                    <button onClick={handleAddTransaction} className="w-full bg-[#0f172a] text-white py-10 rounded-[3rem] tracking-[0.4em] text-[11px] shadow-2xl active:scale-95 transition-all italic hover:bg-emerald-600">Commit Handshake Registry</button>
                    <button onClick={() => setTransactionForm(null)} className="text-slate-300 text-xs italic tracking-widest underline underline-offset-4 decoration-slate-200">Abort Execution</button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL: PHOTO CROPPER (CLOSE BUTTON FIXED) */}
      {imageSrc && (
        <div className="fixed inset-0 bg-black z-[1000] flex flex-col p-6 animate-fadeIn">
          <header className="flex justify-between items-center mb-8 px-6">
            <h3 className="text-white text-3xl font-black italic uppercase tracking-tighter underline decoration-emerald-500 decoration-8 underline-offset-[15px]">Biological Re-Scale</h3>
            <button onClick={() => setImageSrc(null)} className="bg-white/10 w-14 h-14 rounded-full flex items-center justify-center text-white text-5xl hover:bg-rose-500 transition-all">&times;</button>
          </header>
          <div className="relative flex-1 bg-black rounded-[4rem] overflow-hidden border-8 border-white/5">
            <Cropper image={imageSrc} crop={crop} zoom={zoom} rotation={rotation} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={(r, p) => setCroppedAreaPixels(p)} />
          </div>
          <div className="p-8 md:p-12 flex flex-col md:flex-row gap-10 items-center bg-[#0a0a0a] mt-8 rounded-[4rem] border border-white/10 shadow-2xl">
            <div className="flex-1 w-full space-y-2"><span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.5em]">Identity Zoom Control</span><input type="range" className="w-full accent-emerald-500" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(e.target.value)} /></div>
            <div className="flex-1 w-full space-y-2"><span className="text-[9px] font-black uppercase text-slate-500 tracking-[0.5em]">Bio-Axis Rotation Control</span><input type="range" className="w-full accent-blue-500" min={0} max={360} value={rotation} onChange={e => setRotation(e.target.value)} /></div>
            <button onClick={handleUploadAvatar} className="bg-emerald-600 text-white h-[80px] px-20 rounded-[3rem] font-black uppercase italic tracking-widest text-[10px] shadow-2xl hover:bg-white hover:text-black transition-all">Confirm Secure Biological Link</button>
          </div>
        </div>
      )}
    </div>
  );
}