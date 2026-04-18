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
  
  // Modal states
  const [editingCustomer, setEditingCustomer] = useState(null); 
  const [manageHistory, setManageHistory] = useState(null);      
  const [editingMessage, setEditingMessage] = useState(null);   
  const [imageSrc, setImageSrc] = useState(null);               
  
  // Internal Detail States
  const [userTransactions, setUserTransactions] = useState([]);
  const [ledgerForm, setLedgerForm] = useState({ amount: '', reference: '', type: 'credit' });
  const [userMessages, setUserMessages] = useState([]);

  // Forms
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
    try { await callback(); } catch (e) { alert("Error: " + e.message); } finally { setGlobalLoading(false); }
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers(data || []);
  };

  // --- LOGIC: MANAGE ACCOUNT (PROFILE) ---
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
      setEditingCustomer(null); fetchCustomers();
      alert("Changes saved to database.");
    });
  };

  // --- LOGIC: LEDGER (TRANSACTIONS) ---
  const openLedger = (customer) => {
    runAction(async () => {
        setManageHistory(customer);
        const { data } = await supabase.from('transactions').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false });
        setUserTransactions(data || []);
        setLedgerForm({ amount: '', reference: '', type: 'credit' });
    });
  };

  const postLedgerEntry = () => {
    runAction(async () => {
      const val = parseFloat(ledgerForm.amount);
      if (!val || !ledgerForm.reference) return alert("All fields required.");

      await supabase.from('transactions').insert([{ 
        customer_id: manageHistory.id, 
        amount: val, 
        type: ledgerForm.type, 
        description: ledgerForm.reference,
        status: 'Completed'
      }]);

      const currentBal = parseFloat(manageHistory.balance || 0);
      const newBal = ledgerForm.type === 'credit' ? currentBal + val : currentBal - val;
      await supabase.from('customers').update({ balance: newBal }).eq('id', manageHistory.id);

      fetchCustomers();
      openLedger({ ...manageHistory, balance: newBal });
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {globalLoading && <div className="loading-bar"></div>}
      <Navbar userType="Bank Administrator" />

      <div className="max-w-6xl mx-auto py-8 px-4">
        <h2 className="text-2xl font-semibold text-[#002147] mb-8">Customer Management</h2>

        {/* Provision Section */}
        <section className="bg-white p-6 border border-slate-200 rounded-xl mb-8 grid grid-cols-1 md:grid-cols-4 gap-4 items-end shadow-sm">
            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Moniker</label><input placeholder="Name" onChange={e => setRegForm({...regForm, fullName: e.target.value})} className="w-full border border-slate-300 p-2 text-sm rounded outline-none" /></div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Email</label><input placeholder="Email" onChange={e => setRegForm({...regForm, email: e.target.value})} className="w-full border border-slate-300 p-2 text-sm rounded outline-none" /></div>
            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Pass ID</label><input placeholder="ID" onChange={e => setRegForm({...regForm, accountId: e.target.value})} className="w-full border border-slate-300 p-2 text-sm rounded outline-none" /></div>
            <button onClick={() => runAction(async () => {
                const { data } = await supabase.auth.signUp({ email: regForm.email, password: regForm.accountId });
                await supabase.from('customers').insert([{ id: data.user.id, email: regForm.email, full_name: regForm.fullName, account_id: regForm.accountId, balance: 0 }]);
                fetchCustomers();
            })} className="bg-[#002147] text-white py-2 rounded font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition-all">Create Account</button>
        </section>

        {/* Table Container */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                    <tr><th className="p-5">Customer Profile</th><th className="p-5 text-right">Available Balance</th><th className="p-5 text-center">Service Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {customers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-5 flex items-center gap-4">
                                <img src={c.avatar_url || `https://ui-avatars.com/api/?name=${c.full_name}`} className="w-10 h-10 rounded-full border border-slate-200" />
                                <div><p className="font-semibold text-sm text-[#002147]">{c.full_name}</p><p className="text-[10px] text-slate-400">{c.account_id}</p></div>
                            </td>
                            <td className="p-5 text-right font-semibold text-lg text-slate-900">${parseFloat(c.balance || 0).toLocaleString()}</td>
                            <td className="p-5 text-center space-x-2">
                                <button onClick={() => setEditingCustomer(c)} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded hover:bg-[#002147] hover:text-white">MANAGE</button>
                                <button onClick={() => openLedger(c)} className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded hover:bg-emerald-600 hover:text-white">LEDGER</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: MANAGE ACCOUNT (GENERIC BANK DESIGN) */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[500] backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl relative overflow-hidden border border-slate-200 animate-fadeIn">
            <header className="bg-white border-b p-6 flex justify-between items-center">
                <h3 className="font-bold text-[#002147] uppercase tracking-tight">Modify Customer Account</h3>
                <button onClick={() => setEditingCustomer(null)} className="text-3xl text-slate-300 hover:text-slate-900 transition-colors">&times;</button>
            </header>
            
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                    <div className="text-center">
                        <img src={editingCustomer.avatar_url || `https://ui-avatars.com/api/?name=${editingCustomer.full_name}`} className="w-24 h-24 rounded-full border border-slate-200 mx-auto object-cover" />
                        <input type="file" id="pic" className="hidden" onChange={e => setImageSrc(URL.createObjectURL(e.target.files[0]))} />
                        <label htmlFor="pic" className="block mt-2 text-[10px] font-bold text-blue-600 uppercase cursor-pointer hover:underline">Update Photo</label>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block px-1">Customer Moniker</label>
                        <input className="w-full border border-slate-300 p-2 text-sm rounded outline-none focus:border-[#002147]" value={editingCustomer.full_name} onChange={e => setEditingCustomer({...editingCustomer, full_name: e.target.value})} />
                        <label className="text-[10px] font-bold text-slate-400 uppercase mt-4 mb-1 block px-1">Primary Ledger Balance ($)</label>
                        <input className="w-full border border-slate-300 p-2 text-lg font-bold text-emerald-600 rounded outline-none" type="number" value={editingCustomer.balance} onChange={e => setEditingCustomer({...editingCustomer, balance: e.target.value})} />
                    </div>
                </div>

                <div className="space-y-6 border-l border-slate-100 pl-0 md:pl-10">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex justify-between items-center mb-2"><span className="text-[11px] font-bold text-[#002147]">Restrict Withdrawals</span><input type="checkbox" checked={editingCustomer.withdraw_restricted} onChange={e => setEditingCustomer({...editingCustomer, withdraw_restricted: e.target.checked})} /></div>
                        <textarea className="w-full border border-slate-200 p-2 text-[11px] h-14 rounded-md outline-none bg-white" placeholder="Provide reason..." value={editingCustomer.withdraw_reason} onChange={e => setEditingCustomer({...editingCustomer, withdraw_reason: e.target.value})} />
                    </div>
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex justify-between items-center mb-2"><span className="text-[11px] font-bold text-[#002147]">Restrict Transfers</span><input type="checkbox" checked={editingCustomer.transfer_restricted} onChange={e => setEditingCustomer({...editingCustomer, transfer_restricted: e.target.checked})} /></div>
                        <textarea className="w-full border border-slate-200 p-2 text-[11px] h-14 rounded-md outline-none bg-white" placeholder="Provide reason..." value={editingCustomer.transfer_reason} onChange={e => setEditingCustomer({...editingCustomer, transfer_reason: e.target.value})} />
                    </div>
                </div>
            </div>

            <footer className="p-6 bg-slate-50 border-t flex gap-4">
                <button onClick={saveProfileChanges} className="flex-1 bg-[#002147] text-white py-3 rounded-lg font-bold text-xs uppercase tracking-widest shadow hover:bg-slate-800 transition-all">Save Changes</button>
                <button onClick={() => setEditingCustomer(null)} className="px-8 border border-slate-300 text-slate-500 rounded-lg text-xs font-bold uppercase tracking-widest">Cancel</button>
            </footer>
          </div>
        </div>
      )}

      {/* MODAL: LEDGER HUB (GENERIC BANK DESIGN) */}
      {manageHistory && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[400] overflow-hidden backdrop-blur-sm">
          <div className="bg-white w-full max-w-6xl h-[85vh] rounded-xl flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-fadeIn">
            <header className="p-6 border-b bg-white flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-[#002147] uppercase">Account Transaction Ledger</h3>
                    <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Managing: {manageHistory.full_name}</p>
                </div>
                <button onClick={() => setManageHistory(null)} className="text-4xl text-slate-300 hover:text-slate-900 transition-all">&times;</button>
            </header>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50">
                {/* Transaction History */}
                <div className="flex-1 p-6 overflow-y-auto border-r border-slate-200">
                    <div className="flex justify-between mb-6 items-end">
                        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Activity History</h4>
                        <div className="text-right"><p className="text-[10px] text-slate-400 uppercase font-bold">Account Balance</p><p className="text-2xl font-bold text-slate-900">${parseFloat(manageHistory.balance || 0).toLocaleString()}</p></div>
                    </div>
                    <table className="w-full text-left bg-white border border-slate-200 shadow-sm rounded">
                        <thead className="bg-slate-100 text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b">
                            <tr><th className="p-4">Date</th><th className="p-4">Reference</th><th className="p-4 text-right">Amount</th><th className="p-4"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {userTransactions.map(t => (
                                <tr key={t.id} className="text-xs hover:bg-slate-50 transition-all">
                                    <td className="p-4 text-slate-400">{new Date(t.created_at).toLocaleDateString()}</td>
                                    <td className="p-4 font-bold text-slate-700 uppercase tracking-tight">{t.description}</td>
                                    <td className={`p-4 text-right font-bold ${t.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {t.type === 'credit' ? '+' : '-'}${parseFloat(t.amount).toLocaleString()}
                                    </td>
                                    <td className="p-4 text-center">
                                        <button onClick={() => runAction(async () => {
                                            if(!window.confirm("Wipe this record?")) return;
                                            await supabase.from('transactions').delete().eq('id', t.id);
                                            const newBal = t.type === 'credit' ? manageHistory.balance - t.amount : manageHistory.balance + t.amount;
                                            await supabase.from('customers').update({ balance: newBal }).eq('id', manageHistory.id);
                                            fetchCustomers(); openLedger({ ...manageHistory, balance: newBal });
                                        })} className="text-rose-500 font-bold text-[9px] hover:underline">WIPE</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Entry Form */}
                <div className="w-full md:w-96 p-8 bg-white flex flex-col justify-between">
                    <div>
                        <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-[0.2em] border-b pb-4 mb-6">New Ledger Entry</h4>
                        <div className="space-y-5">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Impact Amount ($)</label><input type="number" className="w-full border border-slate-300 p-3 rounded-lg text-2xl font-bold outline-none focus:border-[#002147]" value={ledgerForm.amount} onChange={e => setLedgerForm({...ledgerForm, amount: e.target.value})} placeholder="0.00" /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Reference Memo</label><input className="w-full border border-slate-300 p-3 rounded-lg text-sm outline-none focus:border-[#002147]" value={ledgerForm.reference} onChange={e => setLedgerForm({...ledgerForm, reference: e.target.value})} placeholder="Salary, Rent, Wire..." /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Handshake Type</label>
                                <select className="w-full border border-slate-300 p-3 rounded-lg text-sm font-bold bg-slate-50 outline-none" value={ledgerForm.type} onChange={e => setLedgerForm({...ledgerForm, type: e.target.value})}>
                                    <option value="credit">Deposit (Credit +)</option>
                                    <option value="debit">Withdrawal (Debit -)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <button onClick={postLedgerEntry} className="w-full bg-[#002147] text-white py-4 rounded-lg font-bold text-xs uppercase tracking-widest mt-8 shadow hover:bg-slate-800 transition-all">Submit Ledger Protocol</button>
                </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Bio-ID Image Calibrator (Cropper) */}
      {imageSrc && (
        <div className="fixed inset-0 bg-slate-900 z-[1000] flex flex-col p-6 animate-fadeIn">
          <header className="flex justify-between items-center mb-6">
            <h3 className="text-white text-lg font-semibold uppercase tracking-widest italic">Identity Re-Scale</h3>
            <button onClick={() => setImageSrc(null)} className="text-white text-4xl">&times;</button>
          </header>
          <div className="relative flex-1 bg-black rounded overflow-hidden">
            <Cropper image={imageSrc} crop={crop} zoom={zoom} rotation={rotation} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={(r, p) => setCroppedAreaPixels(p)} />
          </div>
          <div className="p-8 flex flex-col md:flex-row gap-8 items-center bg-slate-800 mt-6 rounded shadow-xl">
            <div className="flex-1 w-full space-y-2"><label className="text-[10px] text-slate-400 font-bold uppercase">Zoom Control</label><input type="range" className="w-full accent-emerald-500" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(e.target.value)} /></div>
            <div className="flex-1 w-full space-y-2"><label className="text-[10px] text-slate-400 font-bold uppercase">Rotate Control</label><input type="range" className="w-full accent-blue-500" min={0} max={360} value={rotation} onChange={e => setRotation(e.target.value)} /></div>
            <button onClick={() => runAction(async () => {
                const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
                const fileName = `${editingCustomer.id}/id.jpg`;
                await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true });
                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
                await supabase.from('customers').update({ avatar_url: publicUrl }).eq('id', editingCustomer.id);
                setEditingCustomer({ ...editingCustomer, avatar_url: publicUrl });
                setImageSrc(null); fetchCustomers();
            })} className="bg-emerald-600 text-white h-[60px] px-16 rounded font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-white hover:text-black transition-all">Link Biometric Image</button>
          </div>
        </div>
      )}
    </div>
  );
}