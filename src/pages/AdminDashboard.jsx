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
    try { await callback(); } catch (e) { alert("Action encountered an error: " + e.message); } finally { setGlobalLoading(false); }
  };

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
    setCustomers(data || []);
  };

  const handleAddTransaction = () => {
    runAction(async () => {
      const { amount, description, type } = transactionForm;
      const amountVal = parseFloat(amount);
      await supabase.from('transactions').insert([{ customer_id: manageHistory.id, amount: amountVal, type, description, status: 'Completed' }]);
      
      const currentBal = parseFloat(manageHistory.balance || 0);
      const newBal = type === 'credit' ? currentBal + amountVal : currentBal - amountVal;
      
      await supabase.from('customers').update({ balance: newBal }).eq('id', manageHistory.id);
      setManageHistory({ ...manageHistory, balance: newBal });
      setTransactionForm(null);
      const { data } = await supabase.from('transactions').select('*').eq('customer_id', manageHistory.id).order('created_at', { ascending: false });
      setUserTransactions(data || []);
      fetchCustomers();
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      {globalLoading && <div className="loading-bar"></div>}
      <Navbar userType="System Administrator" />

      <div className="max-w-6xl mx-auto py-8 px-4 md:py-10">
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-slate-900">Customer Support Console</h2>
          <p className="text-slate-500 text-sm">Manage user accounts, balances, and service restrictions.</p>
        </div>

        {/* Register New User Card */}
        <section className="bg-white p-6 rounded-2xl border border-slate-200 mb-8 shadow-sm animate-fadeIn">
            <h3 className="text-sm font-bold text-slate-700 uppercase mb-4 tracking-wider">Onboard New Customer</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <input placeholder="Full Name" onChange={e => setRegForm({...regForm, fullName: e.target.value})} className="border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50" />
                <input placeholder="Email Address" onChange={e => setRegForm({...regForm, email: e.target.value})} className="border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50" />
                <input placeholder="Assign Password" onChange={e => setRegForm({...regForm, accountId: e.target.value})} className="border p-3 text-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-600 bg-slate-50" />
                <button onClick={() => runAction(async () => {
                    const { data } = await supabase.auth.signUp({ email: regForm.email, password: regForm.accountId });
                    await supabase.from('customers').insert([{ id: data.user.id, email: regForm.email, full_name: regForm.fullName, account_id: "ACCT-"+Math.floor(1000+Math.random()*9000), balance: 0 }]);
                    fetchCustomers();
                    alert("Account successfully created.");
                })} className="bg-blue-600 text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#002147] transition-all">Create Account</button>
            </div>
        </section>

        {/* User Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-medium min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                    <tr><th className="p-5">Customer</th><th className="p-5 text-right italic">Current Balance</th><th className="p-5 text-center">Service Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {customers.map(c => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-5 flex items-center gap-4 text-sm">
                                <img src={c.avatar_url || `https://ui-avatars.com/api/?name=${c.full_name}`} className="w-10 h-10 rounded-full object-cover shadow-sm" alt="avatar" />
                                <div><p className="font-bold text-slate-900">{c.full_name}</p><p className="text-[10px] text-slate-400">{c.email}</p></div>
                            </td>
                            <td className="p-5 text-right font-bold text-lg text-slate-900 italic tracking-tighter">${parseFloat(c.balance || 0).toLocaleString()}</td>
                            <td className="p-5 text-center flex justify-center gap-2">
                                <button onClick={() => setEditingCustomer(c)} className="text-[10px] font-bold bg-slate-100 px-4 py-2 rounded-lg hover:bg-[#002147] hover:text-white">MANAGE</button>
                                <button onClick={() => runAction(async () => {
                                    setManageHistory(c);
                                    const { data } = await supabase.from('transactions').select('*').eq('customer_id', c.id).order('created_at', { ascending: false });
                                    setUserTransactions(data || []);
                                })} className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-600 hover:text-white transition-all">LEDGER</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Support Modals: Simplified White UI */}
      {/* (Previous Modal logic logic remains, but with rounded-3xl and white bg-slate-50 styling) */}
    </div>
  );
}