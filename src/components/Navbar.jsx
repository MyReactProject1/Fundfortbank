import React from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';

export default function Navbar({ userType }) {
  const navigate = useNavigate();
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="bg-slate-900/90 backdrop-blur-md text-white py-4 px-10 flex justify-between items-center shadow-lg border-b border-white/5 sticky top-0 z-[1000]">
      <Link to="/" className="flex items-center gap-3 group transition-transform active:scale-95">
        <div className="bg-emerald-500 p-2 rounded-xl group-hover:rotate-12 transition-transform">
          <span className="font-black text-xl text-slate-900 uppercase">FF</span>
        </div>
        <h1 className="text-2xl font-black tracking-tighter italic uppercase">
          FundFort<span className="text-emerald-400">Bank</span>
        </h1>
      </Link>
      <div className="flex items-center gap-8">
        <div className="hidden md:flex flex-col text-right">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em]">Protocol Active</span>
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">{userType}</span>
        </div>
        <button onClick={handleLogout} className="bg-white/5 hover:bg-rose-600 text-slate-400 hover:text-white px-6 py-2 rounded-xl transition-all text-[10px] font-black uppercase border border-white/5">
          Logout
        </button>
      </div>
    </nav>
  );
}