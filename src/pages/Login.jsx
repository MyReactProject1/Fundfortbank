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
      alert("Profile data missing.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-10 border border-slate-200 shadow-sm rounded-md">
        <Link to="/" className="block mb-6 text-center">
            <h2 className="text-2xl font-bold text-[#0f172a]">FundFort Bank</h2>
            <p className="text-slate-400 text-[11px] font-semibold uppercase mt-1">Online Banking Portal</p>
        </Link>
        
        <form onSubmit={handleLogin} className="space-y-5" autoComplete="off">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Email Address</label>
            <input 
              type="email" name="user_login_email" required
              className="w-full border border-slate-300 p-3 rounded text-sm focus:border-blue-600 outline-none"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">Vault Key (Account ID)</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} name="user_login_key" required
                className="w-full border border-slate-300 p-3 rounded text-sm focus:border-blue-600 outline-none"
                onChange={(e) => setAccountId(e.target.value)}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-[10px] font-bold text-slate-400">{showPassword ? 'HIDE' : 'SHOW'}</button>
            </div>
          </div>
          <button disabled={loading} className="w-full bg-[#0f172a] text-white py-3 rounded font-bold text-sm hover:bg-slate-800 transition-all">
            {loading ? 'Validating...' : 'Log In'}
          </button>
        </form>
        <p className="mt-8 text-[10px] text-slate-400 text-center">
          Secure bank access. End-to-end encrypted session.
        </p>
      </div>
    </div>
  );
}