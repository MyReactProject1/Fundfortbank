import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert("Invalid email or password. Please try again.");
    } else {
      const { data: admin } = await supabase.from('admins').select('*').eq('id', authData.user.id).single();
      if (admin) { navigate('/admin'); return; }
      navigate('/dashboard');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <Link to="/" className="flex items-center gap-2 mb-10">
        <div className="bg-[#002147] text-white p-1.5 rounded-lg font-bold text-xl">FF</div>
        <span className="text-2xl font-bold text-[#002147] tracking-tight">FundFort Bank</span>
      </Link>
      
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-semibold mb-2">Welcome back</h2>
        <p className="text-slate-500 text-sm mb-8">Please enter your details to sign in.</p>
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Email Address</label>
            <input type="email" required placeholder="name@email.com" 
              className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none transition-all"
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Password</label>
            <div className="relative">
              <input type={show ? "text" : "password"} required placeholder="Enter your password"
                className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none transition-all"
                onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-4 text-xs font-bold text-slate-400">{show ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          <button disabled={loading} className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-blue-900/10">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
      <p className="mt-8 text-xs text-slate-400">Protected by industry-standard 256-bit encryption.</p>
    </div>
  );
}