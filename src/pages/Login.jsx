import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [accountId, setAccountId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password: accountId });
    if (error) {
      alert(error.message);
    } else {
      const { data: admin } = await supabase.from('admins').select('*').eq('id', authData.user.id).single();
      if (admin) { navigate('/admin'); return; }
      const { data: cust } = await supabase.from('customers').select('*').eq('id', authData.user.id).single();
      if (cust) { navigate('/dashboard'); return; }
      alert("Account mismatch.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-10 md:p-14 rounded-[3rem] shadow-2xl text-center relative overflow-hidden">
        <Link to="/" className="inline-block mb-2 group">
            <h2 className="text-3xl font-black italic text-[#0f172a] tracking-tighter uppercase group-hover:text-emerald-600 transition-colors underline decoration-emerald-500 decoration-8 underline-offset-8">FundFort</h2>
        </Link>
        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 mb-10">Institutional Vault V4.2</p>
        
        <form onSubmit={handleLogin} className="space-y-6" autoComplete="off">
          <input 
            type="email" name="user_email" placeholder="Email Address" required
            className="w-full bg-slate-100 p-5 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-500 font-bold transition-all"
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} name="user_key" placeholder="Vault Access Key" required
              className="w-full bg-slate-100 p-5 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-500 font-black text-xl tracking-widest text-center"
              onChange={(e) => setAccountId(e.target.value)}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-slate-400 hover:text-emerald-500">{showPassword ? 'Hide' : 'Show'}</button>
          </div>
          <button disabled={loading} className="w-full bg-emerald-600 text-white py-6 rounded-2xl shadow-xl font-black uppercase tracking-widest text-[11px] hover:bg-[#0f172a] transition-all">
            {loading ? 'Establishing Link...' : 'Access My Vault'}
          </button>
        </form>
        <div className="mt-10 pt-6 border-t flex justify-center gap-4 grayscale opacity-30">
            <span className="text-[9px] font-bold">AES-256</span>
            <span className="text-[9px] font-bold">UK-REG</span>
            <span className="text-[9px] font-bold">SSL-SECURE</span>
        </div>
      </div>
    </div>
  );
}