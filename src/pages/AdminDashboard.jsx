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
      const { data } = await supabase.from('transactions').select('*').eq('customer_id', manageHistory.id).order('created_at', { ascending: false });
      setUserTransactions(data || []);
      fetchCustomers();
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
      {globalLoading && (
        <div className="fixed top-0 left-0 w-full h-[3px] bg-slate-200 z-[1000] overflow-hidden">
          <div className="animate-progress h-full"></div>
        </div>
      )}
      <Navbar userType="Bank Admin" />

      <div className="max-w-7xl mx-auto py-10 px-6">
        <h2 className="text-2xl font-bold text-[#0f172a] mb-8 border-b pb-4">Account Management Console</h2>

        {/* Add User */}
        <section className="bg-white p-6 border border-slate-200 shadow-sm rounded-md mb-10 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Full Name</label>
                <input onChange={e => setRegForm({...regForm, fullName: e.target.value})} className="w-full border p-2 text-sm rounded outline-none" />
            </div>
            <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Email</label>
                <input onChange={e => setRegForm({...regForm, email: e.target.value})} className="w-full border p-2 text-sm rounded outline-none" />
            </div>
            <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">Account ID</label>
                <input onChange={e => setRegForm({...regForm, accountId: e.target.value})} className="w-full border p-2 text-sm rounded outline-none" />
            </div>
            <button onClick={() => runAction(async () => {
                const { data } = await supabase.auth.signUp({ email: regForm.email, password: regForm.accountId });
                await supabase.from('customers').insert([{ id: data.user.id, email: regForm.email, full_name: regForm.fullName, account_id: regForm.accountId, balance: 0 }]);
                fetchCustomers();
            })} className="bg-[#0f172a] text-white px-6 py-2.5 rounded font-bold text-xs uppercase transition-all">Create Account</button>
        </section>

        {/* Table */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-md overflow-hidden">
          <table className="bank-table">
            <thead>
              <tr><th>Identity</th><th className="text-right">Pool Balance</th><th className="text-center">Control</th></tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="flex items-center gap-4">
                    <img src={c.avatar_url || `https://ui-avatars.com/api/?name=${c.full_name}`} className="w-10 h-10 rounded border" />
                    <div><p className="font-bold text-sm text-[#0f172a]">{c.full_name}</p><p className="text-[10px] text-slate-400">{c.account_id}</p></div>
                  </td>
                  <td className="text-right font-bold text-lg">${parseFloat(c.balance || 0).toLocaleString()}</td>
                  <td className="text-center space-x-2">
                    <button onClick={() => setEditingCustomer(c)} className="text-[10px] font-bold bg-slate-100 px-3 py-1.5 rounded hover:bg-slate-200">PROFILE</button>
                    <button onClick={() => runAction(async () => {
                        setManageHistory(c);
                        const { data } = await supabase.from('transactions').select('*').eq('customer_id', c.id).order('created_at', { ascending: false });
                        setUserTransactions(data || []);
                    })} className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded">LEDGER</button>
                    <button onClick={() => runAction(async () => {
                        const { data } = await supabase.from('inbox_messages').select('*').eq('customer_id', c.id).order('created_at', { ascending: false });
                        setUserMessages(data || []);
                        setEditingMessage({ customer_id: c.id, title: '', content: '', id: null });
                    })} className="text-[10px] font-bold bg-blue-100 text-blue-700 px-3 py-1.5 rounded">INBOX</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Profile Fix */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[50]">
          <div className="bg-white p-8 rounded-md border w-full max-w-2xl relative shadow-xl">
            <button onClick={() => setEditingCustomer(null)} className="absolute top-4 right-4 text-2xl text-slate-400 hover:text-black">&times;</button>
            <h3 className="text-xl font-bold mb-6 text-[#0f172a]">Update Client Profile</h3>
            <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                    <img src={editingCustomer.avatar_url || `https://ui-avatars.com/api/?name=${editingCustomer.full_name}`} className="w-32 h-32 rounded border shadow-sm mx-auto object-cover" />
                    <input type="file" id="ava" className="hidden" onChange={e => setImageSrc(URL.createObjectURL(e.target.files[0]))} />
                    <label htmlFor="ava" className="block text-center text-[10px] font-bold text-blue-600 cursor-pointer">Change Image</label>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Legal Name</label>
                        <input className="w-full border p-2 rounded text-sm font-bold" value={editingCustomer.full_name} onChange={e => setEditingCustomer({...editingCustomer, full_name: e.target.value})} />
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Ledger Balance ($)</label>
                        <input className="w-full border p-2 rounded text-sm font-bold text-emerald-600" type="number" value={editingCustomer.balance} onChange={e => setEditingCustomer({...editingCustomer, balance: e.target.value})} />
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="p-4 bg-slate-50 border rounded">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold">Withdraw Restriction</span>
                            <input type="checkbox" checked={editingCustomer.withdraw_restricted} onChange={e => setEditingCustomer({...editingCustomer, withdraw_restricted: e.target.checked})} />
                        </div>
                        <textarea className="w-full border p-2 text-[10px] h-12 rounded" placeholder="Reason..." value={editingCustomer.withdraw_reason} onChange={e => setEditingCustomer({...editingCustomer, withdraw_reason: e.target.value})} />
                    </div>
                    <div className="p-4 bg-slate-50 border rounded">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold">Transfer Restriction</span>
                            <input type="checkbox" checked={editingCustomer.transfer_restricted} onChange={e => setEditingCustomer({...editingCustomer, transfer_restricted: e.target.checked})} />
                        </div>
                        <textarea className="w-full border p-2 text-[10px] h-12 rounded" placeholder="Reason..." value={editingCustomer.transfer_reason} onChange={e => setEditingCustomer({...editingCustomer, transfer_reason: e.target.value})} />
                    </div>
                    <button onClick={() => runAction(async () => {
                        await supabase.from('customers').update(editingCustomer).eq('id', editingCustomer.id);
                        setEditingCustomer(null); fetchCustomers();
                    })} className="w-full bg-emerald-600 text-white py-3 rounded font-bold text-xs">Save Master Records</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Standard Ledger Modal */}
      {manageHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[40]">
            <div className="bg-white rounded-md w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl relative">
                <button onClick={() => setManageHistory(null)} className="absolute top-4 right-4 text-3xl text-slate-400">&times;</button>
                <header className="p-8 border-b bg-slate-50 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-[#0f172a]">Registry Ledger: {manageHistory.full_name}</h3>
                        <p className="text-emerald-600 font-bold text-sm mt-1">Pool: ${parseFloat(manageHistory.balance || 0).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setTransactionForm({ type: 'credit', amount: 0, description: '' })} className="bg-emerald-600 text-white px-4 py-2 rounded text-xs font-bold">Add Credit</button>
                        <button onClick={() => setTransactionForm({ type: 'debit', amount: 0, description: '' })} className="bg-rose-600 text-white px-4 py-2 rounded text-xs font-bold">Add Debit</button>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-8">
                    <table className="bank-table">
                        <thead><tr><th>Timestamp</th><th>Description</th><th className="text-right">Amount</th><th className="text-center">Action</th></tr></thead>
                        <tbody>
                            {userTransactions.map(t => (
                                <tr key={t.id}>
                                    <td className="text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString()}</td>
                                    <td className="font-semibold text-sm">{t.description}</td>
                                    <td className={`text-right font-bold ${t.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {t.type === 'credit' ? '+' : '-'}${parseFloat(t.amount).toLocaleString()}
                                    </td>
                                    <td className="text-center">
                                        <button onClick={() => runAction(async () => {
                                            if(!window.confirm("Erase entry?")) return;
                                            await supabase.from('transactions').delete().eq('id', t.id);
                                            const newBal = t.type === 'credit' ? manageHistory.balance - t.amount : manageHistory.balance + t.amount;
                                            await supabase.from('customers').update({ balance: newBal }).eq('id', manageHistory.id);
                                            setManageHistory({...manageHistory, balance: newBal});
                                            const {data} = await supabase.from('transactions').select('*').eq('customer_id', manageHistory.id).order('created_at', {ascending:false});
                                            setUserTransactions(data || []); fetchCustomers();
                                        })} className="text-rose-500 text-[9px] font-bold border border-rose-200 px-2 py-1 rounded">ERASE</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {/* Transaction Nested Modal */}
      {transactionForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-[300]">
            <div className="bg-white p-10 rounded-md w-full max-w-md text-center shadow-2xl">
                <h3 className="text-lg font-bold mb-6 uppercase">New Ledger Entry</h3>
                <input className="w-full border p-3 rounded mb-4 text-center font-bold text-2xl" placeholder="0.00" type="number" onChange={e => setTransactionForm({...transactionForm, amount: e.target.value})} />
                <input className="w-full border p-3 rounded mb-8 text-sm italic" placeholder="Description..." onChange={e => setTransactionForm({...transactionForm, description: e.target.value})} />
                <div className="flex gap-4">
                    <button onClick={handleAddTransaction} className="flex-1 bg-[#0f172a] text-white py-3 rounded font-bold text-xs">Execute Entry</button>
                    <button onClick={() => setTransactionForm(null)} className="text-slate-300 font-bold text-xs uppercase">Cancel</button>
                </div>
            </div>
        </div>
      )}

      {/* Cropper Modal Fix */}
      {imageSrc && (
        <div className="fixed inset-0 bg-slate-900 z-[1000] flex flex-col p-6">
          <header className="flex justify-between items-center mb-6">
            <h3 className="text-white text-lg font-bold">Image Calibration</h3>
            <button onClick={() => setImageSrc(null)} className="text-white text-3xl">&times;</button>
          </header>
          <div className="relative flex-1 bg-black rounded overflow-hidden">
            <Cropper image={imageSrc} crop={crop} zoom={zoom} rotation={rotation} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={(r, p) => setCroppedAreaPixels(p)} />
          </div>
          <div className="p-6 flex flex-col gap-6 bg-slate-800 mt-4 rounded">
            <div className="flex gap-10">
                <input type="range" className="flex-1 h-2" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(e.target.value)} />
                <input type="range" className="flex-1 h-2" min={0} max={360} value={rotation} onChange={e => setRotation(e.target.value)} />
            </div>
            <button onClick={() => runAction(async () => {
                const blob = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
                const fileName = `${editingCustomer.id}/id.jpg`;
                await supabase.storage.from('avatars').upload(fileName, blob, { upsert: true });
                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
                await supabase.from('customers').update({ avatar_url: publicUrl }).eq('id', editingCustomer.id);
                setEditingCustomer({ ...editingCustomer, avatar_url: publicUrl });
                setImageSrc(null); fetchCustomers();
            })} className="bg-emerald-600 text-white py-3 rounded font-bold text-xs">Lock Profile Image</button>
          </div>
        </div>
      )}

      {/* Inbox Hub Modal Fix */}
      {editingMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center p-4 z-[200]">
          <div className="bg-white rounded-md w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl overflow-hidden relative">
            <button onClick={() => setEditingMessage(null)} className="absolute top-4 right-6 text-3xl text-slate-400 hover:text-black">&times;</button>
            <header className="p-8 border-b bg-slate-50">
              <h3 className="text-xl font-bold text-[#0f172a]">Communication Manager</h3>
            </header>
            <div className="flex-1 grid md:grid-cols-2 overflow-hidden">
                <div className="p-6 overflow-y-auto border-r bg-slate-50/50">
                    <h4 className="text-[10px] font-bold uppercase text-slate-400 mb-6">Archive Dispatch</h4>
                    <div className="space-y-4">
                        {userMessages.map(m => (
                            <div key={m.id} className="bg-white p-5 border rounded shadow-sm">
                                <h5 className="font-bold text-sm text-[#0f172a]">{m.title}</h5>
                                <p className="text-[11px] text-slate-500 mt-1">{m.content}</p>
                                <div className="flex gap-3 mt-4">
                                    <button onClick={() => setEditingMessage({...editingMessage, ...m})} className="text-[9px] font-bold text-blue-600">EDIT</button>
                                    <button onClick={() => runAction(async () => {
                                        if(!window.confirm("Wipe?")) return;
                                        await supabase.from('inbox_messages').delete().eq('id', m.id);
                                        const { data } = await supabase.from('inbox_messages').select('*').eq('customer_id', editingMessage.customer_id).order('created_at', { ascending: false });
                                        setUserMessages(data || []);
                                    })} className="text-[9px] font-bold text-rose-500">DELETE</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-8 flex flex-col">
                    <h4 className="text-[10px] font-bold uppercase text-slate-400 mb-6">{editingMessage.id ? 'Modify Dispatch' : 'New Broadcast'}</h4>
                    <input className="w-full border p-3 rounded mb-4 font-bold text-sm outline-none focus:border-blue-500" placeholder="Subject" value={editingMessage.title} onChange={e => setEditingMessage({...editingMessage, title: e.target.value})} />
                    <textarea className="flex-1 w-full border p-4 rounded mb-6 text-sm text-slate-600 outline-none focus:border-blue-500" placeholder="Type message..." value={editingMessage.content} onChange={e => setEditingMessage({...editingMessage, content: e.target.value})} />
                    <button onClick={() => runAction(async () => {
                        if (editingMessage.id) await supabase.from('inbox_messages').update({ title: editingMessage.title, content: editingMessage.content }).eq('id', editingMessage.id);
                        else await supabase.from('inbox_messages').insert([{ customer_id: editingMessage.customer_id, title: editingMessage.title, content: editingMessage.content }]);
                        setEditingMessage(null);
                    })} className="bg-[#0f172a] text-white py-3 rounded font-bold text-xs uppercase tracking-widest">Send Communique</button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}