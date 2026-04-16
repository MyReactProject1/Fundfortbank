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
  
  // Modal Visibility States
  const [editingCustomer, setEditingCustomer] = useState(null); 
  const [manageHistory, setManageHistory] = useState(null);      
  const [editingMessage, setEditingMessage] = useState(null);   
  const [imageSrc, setImageSrc] = useState(null);               
  
  // Hub Detail States
  const [userTransactions, setUserTransactions] = useState([]);
  const [editingTransaction, setEditingTransaction] = useState(null); 
  const [userMessages, setUserMessages] = useState([]);
  
  // Registration Form
  const [regForm, setRegForm] = useState({ email: '', fullName: '', accountId: '' });

  // Cropper states
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate('/'); else fetchCustomers();
    };
    checkSession();
  }, [navigate]);

  const runAction = async (callback) => {
    setGlobalLoading(true);
    try { await callback(); } catch (e) { alert("Execution Error: " + e.message); } finally { setGlobalLoading(false); }
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers(data || []);
  };

  // --- FIX 1: IDENTITY PROFILE SAVE LOGIC ---
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
      alert("System Profile Protocol Updated Successfully.");
    });
  };

  // --- FIX 2: INBOX BROADCAST SAVE LOGIC ---
  const openInboxHub = (customer) => {
    runAction(async () => {
      const { data } = await supabase.from('inbox_messages').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false });
      setUserMessages(data || []);
      setEditingMessage({ customer_id: customer.id, title: '', content: '', id: null });
    });
  };

  const saveInboxMessage = () => {
    runAction(async () => {
      if (!editingMessage.title || !editingMessage.content) return alert("All protocol fields required.");
      
      if (editingMessage.id) {
        // UPDATE EXISTING
        const { error } = await supabase.from('inbox_messages').update({ 
            title: editingMessage.title, 
            content: editingMessage.content 
        }).eq('id', editingMessage.id);
        if (error) throw error;
      } else {
        // INSERT NEW
        const { error } = await supabase.from('inbox_messages').insert([{ 
            customer_id: editingMessage.customer_id, 
            title: editingMessage.title, 
            content: editingMessage.content 
        }]);
        if (error) throw error;
      }
      // Refresh message ledger
      const { data } = await supabase.from('inbox_messages').select('*').eq('customer_id', editingMessage.customer_id).order('created_at', { ascending: false });
      setUserMessages(data || []);
      setEditingMessage({ ...editingMessage, id: null, title: '', content: '' });
      alert("Dispatch Handshake Committed.");
    });
  };

  // --- LEDGER LOGIC (Kept Fully Functional) ---
  const openLedgerHub = (customer) => {
    runAction(async () => {
        setManageHistory(customer);
        const { data } = await supabase.from('transactions').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false });
        setUserTransactions(data || []);
        setEditingTransaction({ customer_id: customer.id, amount: '', description: '', type: 'credit', status: 'Completed', id: null });
    });
  };

  const saveLedgerEntry = (typeOverride) => {
    runAction(async () => {
      const type = typeOverride || editingTransaction.type;
      const amountVal = parseFloat(editingTransaction.amount);
      if (!amountVal) return alert("Numeric value required.");
      
      let finalBalance = parseFloat(manageHistory.balance);

      if (editingTransaction.id) {
        const { data: old } = await supabase.from('transactions').select('*').eq('id', editingTransaction.id).single();
        finalBalance = old.type === 'credit' ? finalBalance - old.amount : finalBalance + old.amount;
        await supabase.from('transactions').update({ amount: amountVal, description: editingTransaction.description, type: type, created_at: editingTransaction.created_at, status: editingTransaction.status }).eq('id', editingTransaction.id);
      } else {
        await supabase.from('transactions').insert([{ customer_id: editingTransaction.customer_id, amount: amountVal, type: type, description: editingTransaction.description, created_at: editingTransaction.created_at, status: editingTransaction.status }]);
      }

      finalBalance = type === 'credit' ? finalBalance + amountVal : finalBalance - amountVal;
      await supabase.from('customers').update({ balance: finalBalance }).eq('id', manageHistory.id);
      
      fetchCustomers();
      openLedgerHub({ ...manageHistory, balance: finalBalance });
      setEditingTransaction(null);
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      {globalLoading && <div className="fixed top-0 left-0 w-full z-[2000] overflow-hidden"><div className="animate-progress h-[3px] bg-emerald-500 shadow-lg shadow-emerald-500/20"></div></div>}
      <Navbar userType="Central Operations Manager" />

      <div className="max-w-7xl mx-auto py-8 px-4 md:px-6">
        <h2 className="text-xl font-bold uppercase tracking-widest text-[#002147] mb-8 border-b pb-4 italic underline decoration-emerald-500 decoration-8 underline-offset-8">Administrative Ledger Hub</h2>

        {/* PROVISION SECTION */}
        <section className="bg-white p-6 border border-slate-200 mb-8 grid grid-cols-1 md:grid-cols-4 gap-4 items-end shadow-sm">
            <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Moniker</label><input placeholder="Legal Name" onChange={e => setRegForm({...regForm, fullName: e.target.value})} className="w-full border p-2.5 text-sm outline-none bg-slate-50 italic" /></div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Email</label><input placeholder="Bank Archive" onChange={e => setRegForm({...regForm, email: e.target.value})} className="w-full border p-2.5 text-sm outline-none bg-slate-50 italic" /></div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Pass-key</label><input placeholder="Set access" onChange={e => setRegForm({...regForm, accountId: e.target.value})} className="w-full border p-2.5 text-sm outline-none bg-slate-50 italic font-bold" /></div>
            <button onClick={() => runAction(async () => {
                const { data } = await supabase.auth.signUp({ email: regForm.email, password: regForm.accountId });
                await supabase.from('customers').insert([{ id: data.user.id, email: regForm.email, full_name: regForm.fullName, account_id: regForm.accountId, balance: 0 }]);
                fetchCustomers();
            })} className="bg-[#002147] text-white py-3 rounded-sm font-bold text-[10px] uppercase tracking-widest shadow hover:bg-[#003d7e]">Establish account</button>
        </section>

        {/* CLIENT DATA TABLE */}
        <div className="bg-white border border-slate-200 overflow-hidden shadow-xl rounded-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[850px]">
                <thead className="bg-[#002147] text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    <tr><th className="p-5 italic opacity-40">Biological profile</th><th className="p-5 text-right italic opacity-40">Liquid pool reserve</th><th className="p-5 text-center italic opacity-40">System operations</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {customers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-5 flex items-center gap-4">
                                <img src={c.avatar_url || `https://ui-avatars.com/api/?name=${c.full_name}&background=10b981&color=fff`} className="w-12 h-12 border object-cover" alt="avatar" />
                                <div><p className="font-bold text-sm text-[#002147] uppercase italic tracking-tighter">{c.full_name}</p><p className="text-[9px] text-slate-400 font-bold">{c.account_id}</p></div>
                            </td>
                            <td className="p-5 text-right font-black text-2xl text-slate-900 italic tracking-tighter">${parseFloat(c.balance || 0).toLocaleString()}</td>
                            <td className="p-5 text-center flex justify-center gap-2">
                                <button onClick={() => setEditingCustomer(c)} className="text-[9px] font-bold bg-slate-100 px-4 py-2 border hover:bg-[#002147] hover:text-white uppercase transition-all">Protocol</button>
                                <button onClick={() => openLedgerHub(c)} className="text-[9px] font-bold bg-emerald-600 text-white px-4 py-2 hover:bg-slate-900 transition-all uppercase shadow-sm italic">Ledger</button>
                                <button onClick={() => openInboxHub(c)} className="text-[9px] font-bold bg-blue-600 text-white px-4 py-2 hover:bg-slate-900 transition-all uppercase italic">Inbox hub</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL 1: IDENTITY MODIFY HUB (FIXED) */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-[#002147]/80 flex items-center justify-center p-4 z-[500] overflow-y-auto backdrop-blur-sm">
          <div className="bg-white p-6 md:p-12 w-full max-w-4xl relative shadow-2xl border-t-[8px] border-emerald-500 my-10 animate-fadeIn">
            <button onClick={() => setEditingCustomer(null)} className="absolute top-4 right-6 text-5xl text-slate-300 hover:text-rose-600">&times;</button>
            <h3 className="text-xl font-bold mb-10 text-[#002147] uppercase italic border-b-2 pb-2 inline-block">Security interlock protocol</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                    <img src={editingCustomer.avatar_url || `https://ui-avatars.com/api/?name=${editingCustomer.full_name}`} className="w-40 h-40 border border-slate-100 mx-auto object-cover" />
                    <input type="file" id="up" className="hidden" onChange={e => setImageSrc(URL.createObjectURL(e.target.files[0]))} />
                    <label htmlFor="up" className="block text-center text-[10px] font-bold text-blue-600 cursor-pointer uppercase underline">Sync identity image</label>
                    <div className="space-y-3 pt-4">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Legal Moniker</label>
                        <input className="w-full border p-3 text-sm font-bold italic" value={editingCustomer.full_name} onChange={e => setEditingCustomer({...editingCustomer, full_name: e.target.value})} />
                        <label className="text-[9px] font-bold text-slate-400 uppercase mt-4 block px-2">Pool reserve override ($)</label>
                        <input className="w-full border p-3 text-5xl font-black text-emerald-600 bg-slate-50 italic outline-none tracking-tighter" type="number" value={editingCustomer.balance} onChange={e => setEditingCustomer({...editingCustomer, balance: e.target.value})} />
                    </div>
                </div>
                <div className="space-y-12">
                    <div className="p-6 border border-slate-100 bg-slate-50 shadow-inner">
                        <div className="flex justify-between items-center mb-4 text-[10px] font-bold uppercase"><span>Withdraw locked</span><input type="checkbox" checked={editingCustomer.withdraw_restricted} onChange={e => setEditingCustomer({...editingCustomer, withdraw_restricted: e.target.checked})} /></div>
                        <textarea className="w-full border p-3 text-[10px] h-20 bg-white font-medium italic shadow-inner" placeholder="State reason..." value={editingCustomer.withdraw_reason} onChange={e => setEditingCustomer({...editingCustomer, withdraw_reason: e.target.value})} />
                    </div>
                    <div className="p-6 border border-slate-100 bg-slate-50 shadow-inner">
                        <div className="flex justify-between items-center mb-4 text-[10px] font-bold uppercase"><span>Transfer suspended</span><input type="checkbox" checked={editingCustomer.transfer_restricted} onChange={e => setEditingCustomer({...editingCustomer, transfer_restricted: e.target.checked})} /></div>
                        <textarea className="w-full border p-3 text-[10px] h-20 bg-white font-medium italic shadow-inner" placeholder="State reason..." value={editingCustomer.transfer_reason} onChange={e => setEditingCustomer({...editingCustomer, transfer_reason: e.target.value})} />
                    </div>
                    <button onClick={saveProfileChanges} className="w-full bg-[#10b981] text-white py-5 font-black uppercase text-xs tracking-widest shadow-lg hover:bg-slate-900 transition-all italic">Execute global command commit</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: INBOX HUB (FIXED SHIFT) */}
      {editingMessage && (
        <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md flex items-center justify-center p-4 z-[500] overflow-hidden">
          <div className="bg-white rounded-sm w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn relative">
            <header className="p-8 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-2xl font-bold uppercase text-[#002147] italic tracking-tighter underline decoration-emerald-500 decoration-4">Dispatch communication hub</h3>
              <button onClick={() => setEditingMessage(null)} className="text-5xl text-slate-300 hover:text-slate-900">&times;</button>
            </header>
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
                {/* --- LEFT: ARCHIVE LEDGER --- */}
                <div className="p-6 overflow-y-auto border-r bg-slate-50/50">
                    <h4 className="text-[10px] font-black uppercase text-slate-300 mb-6 italic tracking-widest">Message Archive Ledger</h4>
                    <div className="space-y-4">
                        {userMessages.map(m => (
                            <div key={m.id} className="bg-white p-5 border shadow-sm group">
                                <h5 className="font-bold text-sm text-blue-700 italic uppercase mb-1 tracking-tight">{m.title}</h5>
                                <p className="text-[11px] text-slate-500 italic mb-4 leading-relaxed font-medium">"{m.content}"</p>
                                <div className="flex gap-4 border-t pt-4">
                                    <button onClick={() => setEditingMessage({...editingMessage, ...m})} className="text-[9px] font-black uppercase text-blue-400 hover:text-blue-900 underline underline-offset-4 decoration-blue-100">Modify communiqué</button>
                                    <button onClick={() => runAction(async () => {
                                        if(!window.confirm("Wipe record?")) return;
                                        await supabase.from('inbox_messages').delete().eq('id', m.id);
                                        openInboxHub({ id: editingMessage.customer_id });
                                    })} className="text-[9px] font-black uppercase text-rose-300 hover:text-rose-600 transition-colors italic">Wipe registry</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                {/* --- RIGHT: DRAFTING PANE --- */}
                <div className="p-8 md:p-12 flex flex-col bg-white">
                    <h4 className="text-[10px] font-black uppercase text-blue-500 mb-8 italic tracking-widest underline decoration-blue-100 decoration-8 underline-offset-8">{editingMessage.id ? 'Modify protocol' : 'New secure broadcast'}</h4>
                    <input className="w-full bg-slate-50 border p-4 mb-4 font-bold text-lg italic outline-none focus:border-blue-600" placeholder="Subject identifier" value={editingMessage.title} onChange={e => setEditingMessage({...editingMessage, title: e.target.value})} />
                    <textarea className="flex-1 w-full bg-slate-50 border p-6 mb-8 font-medium italic leading-relaxed text-slate-600 outline-none" placeholder="Bank communique text..." value={editingMessage.content} onChange={e => setEditingMessage({...editingMessage, content: e.target.value})} />
                    <button onClick={saveInboxMessage} className="bg-blue-600 text-white py-6 font-black uppercase text-[10px] shadow-xl hover:bg-slate-900 transition-all italic tracking-widest">Execute secure broadcast</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: LEDGER HUB (SIDE-BY-SIDE) */}
      {manageHistory && (
        <div className="fixed inset-0 bg-[#002147]/95 flex items-center justify-center p-4 z-[400] backdrop-blur-sm">
            <div className="bg-white rounded-sm w-full max-w-7xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border-t-[15px] border-emerald-500 animate-fadeIn">
                <header className="p-8 border-b flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-3xl font-black uppercase italic text-[#002147] mb-1 underline decoration-emerald-500 decoration-4">Protocol Ledger registry</h3>
                        <p className="text-emerald-600 font-bold text-xl uppercase italic tracking-widest font-mono">Archive pools: ${parseFloat(manageHistory.balance || 0).toLocaleString()}</p>
                    </div>
                    <button onClick={() => setManageHistory(null)} className="text-5xl text-slate-300 hover:text-slate-900 font-light transition-all">&times;</button>
                </header>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
                    <div className="p-6 overflow-y-auto border-r bg-slate-50/50">
                        <div className="space-y-4">
                            {userTransactions.map(t => (
                                <div key={t.id} className="bg-white p-5 border border-slate-100 flex justify-between items-center group transition-all hover:border-blue-100">
                                    <div className="w-2/3"><p className="font-bold text-[13px] text-[#002147] uppercase italic underline decoration-slate-100 underline-offset-4 mb-1">{t.description}</p><p className="text-[10px] text-slate-400 italic">{new Date(t.created_at).toLocaleDateString()} • {t.reference_number || 'AUTO-HASHED'}</p></div>
                                    <div className="text-right">
                                        <p className={`text-2xl font-black italic tracking-tighter ${t.type === 'credit' ? 'text-emerald-500' : 'text-rose-500'}`}>{t.type === 'credit' ? '+' : '-'}${parseFloat(t.amount).toLocaleString()}</p>
                                        <button onClick={() => setEditingTransaction({...t})} className="text-[9px] font-black uppercase text-blue-400 hover:text-blue-900">Modify</button>
                                        <button onClick={() => runAction(async () => {
                                            if(!window.confirm("Reverse record?")) return;
                                            await supabase.from('transactions').delete().eq('id', t.id);
                                            const newBal = t.type === 'credit' ? manageHistory.balance - t.amount : manageHistory.balance + t.amount;
                                            await supabase.from('customers').update({ balance: newBal }).eq('id', manageHistory.id);
                                            fetchCustomers(); setManageHistory({...manageHistory, balance: newBal}); openLedgerHub(manageHistory);
                                        })} className="text-[9px] font-black uppercase text-rose-300 ml-4 hover:text-rose-600 italic">Wipe</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-10 flex flex-col bg-white overflow-y-auto font-black italic">
                        <h4 className="text-[10px] uppercase text-emerald-500 mb-8 tracking-widest underline decoration-emerald-100 decoration-8 underline-offset-8">Execution terminal</h4>
                        <div className="space-y-6">
                            <div><label className="text-[9px] text-slate-400 block mb-2 px-2 tracking-widest uppercase">Amount change ($)</label><input type="number" className="w-full bg-slate-50 border-none p-5 text-6xl tracking-tighter outline-none focus:bg-emerald-50 transition-colors italic" placeholder="0.00" value={editingTransaction?.amount} onChange={e => setEditingTransaction({...editingTransaction, amount: e.target.value})} /></div>
                            <div><label className="text-[9px] text-slate-400 block mb-2 px-2 tracking-widest uppercase">Memo reference</label><input className="w-full bg-slate-50 border-none p-5 text-sm uppercase italic outline-none focus:ring-1 focus:ring-[#002147]" value={editingTransaction?.description} onChange={e => setEditingTransaction({...editingTransaction, description: e.target.value})} /></div>
                            <div><label className="text-[9px] text-slate-400 block mb-2 px-2 tracking-widest uppercase">Identity stamp (backdating allowed)</label><input type="datetime-local" className="w-full bg-slate-50 border-none p-4 text-xs italic outline-none" value={editingTransaction?.created_at?.slice(0,16)} onChange={e => setEditingTransaction({...editingTransaction, created_at: e.target.value})} /></div>
                        </div>
                        <div className="flex gap-4 mt-12">
                            <button onClick={() => saveLedgerEntry('credit')} className="flex-1 bg-emerald-600 text-white py-6 rounded-sm font-bold uppercase text-[10px] tracking-widest shadow-xl hover:scale-95 transition-all">Inject credit (+)</button>
                            <button onClick={() => saveLedgerEntry('debit')} className="flex-1 bg-rose-600 text-white py-6 rounded-sm font-bold uppercase text-[10px] tracking-widest shadow-xl hover:scale-95 transition-all">Apply debit (-)</button>
                        </div>
                        {editingTransaction?.id && <button onClick={() => setEditingTransaction({ customer_id: manageHistory.id, amount: '', description: '', type: 'credit', id: null })} className="text-[9px] font-black uppercase text-slate-300 mt-6 hover:text-slate-900 tracking-widest underline decoration-slate-100 underline-offset-4">Discard modifications</button>}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* MODAL 4: IMAGE CROPPER (KEPT) */}
      {imageSrc && (
        <div className="fixed inset-0 bg-slate-950 z-[1000] flex flex-col p-4 md:p-10 animate-fadeIn backdrop-blur-3xl">
          <header className="flex justify-between items-center mb-8 px-6 text-white text-2xl font-black italic tracking-tighter uppercase"><h3>Scale Bio-Identity profile</h3><button onClick={() => setImageSrc(null)} className="text-6xl hover:text-rose-500 font-light">&times;</button></header>
          <div className="relative flex-1 bg-black rounded-sm overflow-hidden border border-white/10"><Cropper image={imageSrc} crop={crop} zoom={zoom} rotation={rotation} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={(r, p) => setCroppedAreaPixels(p)} /></div>
          <div className="p-8 flex flex-col md:flex-row gap-10 items-center bg-[#0a0f1a] mt-6 border border-white/5 shadow-2xl">
            <input type="range" className="flex-1 h-1 accent-emerald-500" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(e.target.value)} /><input type="range" className="flex-1 h-1 accent-blue-500" min={0} max={360} value={rotation} onChange={e => setRotation(e.target.value)} />
            <button onClick={() => runAction(async () => {
                const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
                const fileName = `${editingCustomer.id}/id.jpg`;
                await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true });
                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
                await supabase.from('customers').update({ avatar_url: publicUrl }).eq('id', editingCustomer.id);
                setEditingCustomer({ ...editingCustomer, avatar_url: publicUrl });
                setImageSrc(null); fetchCustomers();
            })} className="bg-emerald-600 text-white h-[60px] px-20 rounded font-bold uppercase tracking-widest text-[10px] shadow-2xl italic hover:bg-white hover:text-black transition-all">Seize Identity Photo</button>
          </div>
        </div>
      )}
    </div>
  );
}