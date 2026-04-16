import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password: accountId });
    if (error) { alert(error.message); } else {
      const uid = authData.user.id;
      const { data: admin } = await supabase.from('admins').select('*').eq('id', uid).single();
      if (admin) { navigate('/admin'); return; }
      const { data: cust } = await supabase.from('customers').select('*').eq('id', uid).single();
      if (cust) navigate('/dashboard');
      else alert("Account error");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-8 md:p-12 border border-slate-200 shadow-sm">
        <Link to="/" className="block text-center mb-8">
            <h2 className="text-2xl font-black text-[#002147] uppercase tracking-tight">FundFort Bank</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Authorized Client Access Only</p>
        </Link>
        <form onSubmit={handleLogin} className="space-y-6" autoComplete="off">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Email Address</label>
            <input type="email" name="user_e" required className="w-full border border-slate-300 p-3 text-sm focus:border-[#002147] outline-none" onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Vault Key (Account ID)</label>
            <div className="relative">
              <input type={show ? "text" : "password"} name="user_k" required className="w-full border border-slate-300 p-3 text-sm focus:border-[#002147] outline-none font-bold" onChange={e => setAccountId(e.target.value)} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-3 text-[10px] font-bold text-slate-300 hover:text-slate-900">{show ? 'HIDE' : 'SHOW'}</button>
            </div>
          </div>
          <button disabled={loading} className="w-full bg-[#002147] text-white py-4 font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all">
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}