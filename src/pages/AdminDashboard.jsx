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
  const [editingMessage, setEditingMessage] = useState(null);
  const [userMessages, setUserMessages] = useState([]);
  const [transactionForm, setTransactionForm] = useState(null);
  const [form, setForm] = useState({ email: '', fullName: '', accountId: '' });

  // Cropper States
  const [imageSrc, setImageSrc] = useState(null);
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
    try { await callback(); } catch (e) { alert(e.message); } finally { setGlobalLoading(false); }
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers(data || []);
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-20 font-sans">
      {globalLoading && (
        <div className="fixed top-0 left-0 w-full h-1.5 bg-emerald-100 z-[2000] overflow-hidden">
          <div className="animate-progress h-full bg-emerald-600"></div>
        </div>
      )}
      <Navbar userType="Executive Manager" />

      <div className="max-w-7xl mx-auto py-10 px-4 md:px-6">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4 border-b pb-6 border-slate-200">
            <h2 className="text-3xl font-black italic uppercase tracking-tighter underline decoration-emerald-500 decoration-8 underline-offset-8">Centralized Control</h2>
            <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-400 italic">Connected to: Zurich/London/Tokyo Nodes</span>
                <button onClick={fetchCustomers} className="bg-white p-2 rounded-lg shadow-sm">🔄</button>
            </div>
        </header>

        {/* --- ADD NEW CLIENT SECTION --- */}
        <section className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-xl border mb-12 flex flex-col md:flex-row gap-4 items-end animate-fadeIn">
            <div className="w-full flex-1">
                <label className="text-[9px] font-black uppercase text-slate-400 block mb-2 px-2 tracking-[0.2em]">New Legal Moniker</label>
                <input placeholder="Ex: John Smith" onChange={e => setForm({...form, fullName: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold italic" />
            </div>
            <div className="w-full flex-1">
                <label className="text-[9px] font-black uppercase text-slate-400 block mb-2 px-2 tracking-[0.2em]">Official Archive Email</label>
                <input placeholder="email@bank.com" onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold italic" />
            </div>
            <div className="w-full flex-1">
                <label className="text-[9px] font-black uppercase text-slate-400 block mb-2 px-2 tracking-[0.2em]">Master Access Key</label>
                <input placeholder="Assign Password" onChange={e => setForm({...form, accountId: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold italic tracking-widest" />
            </div>
            <button onClick={() => runAction(async () => {
                const { data } = await supabase.auth.signUp({ email: form.email, password: form.accountId });
                await supabase.from('customers').insert([{ id: data.user.id, email: form.email, full_name: form.fullName, account_id: form.accountId, balance: 0 }]);
                fetchCustomers();
            })} className="w-full md:w-auto bg-emerald-600 text-white h-[56px] px-10 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-[#0f172a] shadow-lg shadow-emerald-100 transition-all italic">Provision</button>
        </section>

        {/* --- CLIENT LEDGER TABLE --- */}
        <div className="bg-white rounded-[3rem] shadow-2xl border overflow-hidden animate-fadeIn">
          <div className="table-container">
            <table className="w-full text-left font-bold min-w-[800px]">
                <thead className="bg-[#0f172a] text-white text-[9px] uppercase tracking-[0.5em] font-black italic">
                    <tr><th className="p-8">Legal Identity Profile</th><th className="p-8 text-right italic">Balance Matrix</th><th className="p-8 text-center uppercase tracking-widest">Protocol Sync</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {customers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-all">
                            <td className="p-8 flex items-center gap-5">
                                <img src={c.avatar_url || `https://ui-avatars.com/api/?name=${c.full_name}&background=10b981&color=fff`} className="w-14 h-14 rounded-2xl object-cover border-4 border-white shadow-xl" />
                                <div><p className="text-xl font-black italic tracking-tighter text-slate-800">{c.full_name}</p><p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] italic">{c.account_id}</p></div>
                            </td>
                            <td className="p-8 text-right text-3xl font-black text-[#0f172a] tracking-tighter italic">${parseFloat(c.balance || 0).toLocaleString()}</td>
                            <td className="p-8 text-center flex justify-center gap-2">
                                <button onClick={() => setEditingCustomer(c)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md">Modify</button>
                                <button onClick={() => runAction(async () => {
                                    setManageHistory(c);
                                    const { data } = await supabase.from('transactions').select('*').eq('customer_id', c.id).order('created_at', { ascending: false });
                                    setUserTransactions(data || []);
                                })} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-md">Audit</button>
                                <button onClick={() => runAction(async () => {
                                    const { data } = await supabase.from('inbox_messages').select('*').eq('customer_id', c.id).order('created_at', { ascending: false });
                                    setUserMessages(data || []);
                                    setEditingMessage({ customer_id: c.id, title: '', content: '', id: null });
                                })} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase shadow-md">Inbox</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* (Previous Modals Implementation - Inbox, History, Cropper, Interlocks remain same logic but with rounded-[3rem] for mobile styling) */}
    </div>
  );
}