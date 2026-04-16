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
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [manageHistory, setManageHistory] = useState(null);
  const [userTransactions, setUserTransactions] = useState([]);
  const [userMessages, setUserMessages] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [transactionForm, setTransactionForm] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
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
    try { await callback(); } catch (e) { alert(e.message); } finally { setGlobalLoading(false); }
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers(data || []);
  };

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
      setUserTransactions(trans || []); fetchCustomers();
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {globalLoading && <div className="fixed top-0 left-0 w-full z-[2000] overflow-hidden"><div className="loading-bar"></div></div>}
      <Navbar userType="Central Administrator" />

      <div className="max-w-7xl mx-auto py-10 px-4 md:px-6">
        <h2 className="text-xl font-bold uppercase tracking-[0.2em] mb-10 border-b pb-4 text-[#002147]">Archive Record Manager</h2>

        {/* Provision Card - Responsive Grid */}
        <section className="bg-white p-6 border border-slate-200 mb-10 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div className="w-full">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Moniker</label>
                <input onChange={e => setRegForm({...regForm, fullName: e.target.value})} className="w-full border p-2 text-sm outline-none focus:border-[#002147]" />
            </div>
            <div className="w-full">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Email</label>
                <input onChange={e => setRegForm({...regForm, email: e.target.value})} className="w-full border p-2 text-sm outline-none focus:border-[#002147]" />
            </div>
            <div className="w-full">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Master Pass</label>
                <input onChange={e => setRegForm({...regForm, accountId: e.target.value})} className="w-full border p-2 text-sm outline-none focus:border-[#002147] font-bold" />
            </div>
            <button onClick={() => runAction(async () => {
                const { data } = await supabase.auth.signUp({ email: regForm.email, password: regForm.accountId });
                await supabase.from('customers').insert([{ id: data.user.id, email: regForm.email, full_name: regForm.fullName, account_id: regForm.accountId, balance: 0 }]);
                fetchCustomers();
            })} className="bg-[#002147] text-white py-3 rounded-sm font-bold text-[10px] uppercase tracking-widest transition-all">Provision Account</button>
        </section>

        {/* Responsive Table Container */}
        <div className="scroll-container bg-white rounded-sm">
            <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-50 border-b-2 border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest italic">
                    <tr><th className="p-6">Client Identity</th><th className="p-6 text-right">Pool Value</th><th className="p-6 text-center">System Command</th></tr>
                </thead>
                <tbody className="divide-y">
                    {customers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50">
                            <td className="p-6 flex items-center gap-4">
                                <img src={c.avatar_url || `https://ui-avatars.com/api/?name=${c.full_name}`} className="w-10 h-10 border" />
                                <div><p className="font-bold text-sm text-[#002147]">{c.full_name}</p><p className="text-[9px] text-slate-400 uppercase tracking-widest">{c.account_id}</p></div>
                            </td>
                            <td className="p-6 text-right font-bold text-2xl text-slate-900">${parseFloat(c.balance || 0).toLocaleString()}</td>
                            <td className="p-6 text-center flex justify-center gap-2">
                                <button onClick={() => setEditingCustomer(c)} className="text-[9px] font-bold bg-slate-100 px-3 py-2 uppercase hover:bg-slate-900 hover:text-white transition-all">Protocol</button>
                                <button onClick={() => runAction(async () => {
                                    setManageHistory(c);
                                    const { data } = await supabase.from('transactions').select('*').eq('customer_id', c.id).order('created_at', { ascending: false });
                                    setUserTransactions(data || []);
                                })} className="text-[9px] font-bold bg-[#10b981] text-white px-3 py-2 uppercase shadow-sm">Ledger</button>
                                <button onClick={() => runAction(async () => {
                                    const { data } = await supabase.from('inbox_messages').select('*').eq('customer_id', c.id).order('created_at', { ascending: false });
                                    setUserMessages(data || []);
                                    setEditingMessage({ customer_id: c.id, title: '', content: '', id: null });
                                })} className="text-[9px] font-bold bg-blue-100 text-blue-600 px-3 py-2 uppercase">Inbox</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* --- ALL MODALS SIMPLIFIED AND MOBILE RESPONSIVE --- */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-[#002147]/90 flex items-center justify-center p-4 z-[500] overflow-y-auto">
          <div className="bg-white p-8 md:p-12 w-full max-w-4xl relative shadow-2xl border-t-[10px] border-emerald-500 my-10">
            <button onClick={() => setEditingCustomer(null)} className="absolute top-4 right-4 text-4xl text-slate-300 hover:text-slate-900">&times;</button>
            <h3 className="text-xl font-bold mb-10 text-[#002147] uppercase border-b pb-2 italic tracking-tighter">Identity Control Protocol</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8 text-center md:text-left">
                    <img src={editingCustomer.avatar_url || `https://ui-avatars.com/api/?name=${editingCustomer.full_name}`} className="w-40 h-40 border border-slate-100 mx-auto object-cover" />
                    <input type="file" id="up" className="hidden" onChange={e => setImageSrc(URL.createObjectURL(e.target.files[0]))} />
                    <label htmlFor="up" className="block text-center text-[9px] font-bold text-blue-600 cursor-pointer uppercase underline">Sync Biological Image</label>
                    <div className="space-y-4 pt-4 text-left">
                        <label className="text-[10px] font-bold text-slate-300 uppercase">Moniker Control</label>
                        <input className="w-full border p-3 text-lg font-bold bg-slate-50" value={editingCustomer.full_name} onChange={e => setEditingCustomer({...editingCustomer, full_name: e.target.value})} />
                        <label className="text-[10px] font-bold text-slate-300 uppercase block mt-4">Liquidity Pool Adjust</label>
                        <input className="w-full border p-3 text-5xl font-black text-emerald-600 bg-slate-50 italic" type="number" value={editingCustomer.balance} onChange={e => setEditingCustomer({...editingCustomer, balance: e.target.value})} />
                    </div>
                </div>
                <div className="space-y-12">
                    <div className="p-6 border border-slate-100 bg-slate-50">
                        <div className="flex justify-between items-center mb-4 text-[10px] font-bold uppercase tracking-widest italic"><span>Withdraw Protocol</span><input type="checkbox" checked={editingCustomer.withdraw_restricted} onChange={e => setEditingCustomer({...editingCustomer, withdraw_restricted: e.target.checked})} /></div>
                        <textarea className="w-full border p-3 text-[10px] h-20 bg-white" placeholder="Reason..." value={editingCustomer.withdraw_reason} onChange={e => setEditingCustomer({...editingCustomer, withdraw_reason: e.target.value})} />
                    </div>
                    <div className="p-6 border border-slate-100 bg-slate-50">
                        <div className="flex justify-between items-center mb-4 text-[10px] font-bold uppercase tracking-widest italic"><span>Transfer Protocol</span><input type="checkbox" checked={editingCustomer.transfer_restricted} onChange={e => setEditingCustomer({...editingCustomer, transfer_restricted: e.target.checked})} /></div>
                        <textarea className="w-full border p-3 text-[10px] h-20 bg-white" placeholder="Reason..." value={editingCustomer.transfer_reason} onChange={e => setEditingCustomer({...editingCustomer, transfer_reason: e.target.value})} />
                    </div>
                    <button onClick={() => runAction(async () => {
                        await supabase.from('customers').update(editingCustomer).eq('id', editingCustomer.id);
                        setEditingCustomer(null); fetchCustomers();
                    })} className="w-full bg-[#10b981] text-white py-5 font-black uppercase text-xs tracking-[0.2em] shadow-lg">Commit Global Registry Changes</button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}