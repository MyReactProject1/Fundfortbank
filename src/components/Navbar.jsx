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
    <nav className="bg-[#002147] text-white py-3 px-4 md:px-10 flex justify-between items-center sticky top-0 z-[1000]">
      <Link to="/" className="flex items-center gap-2">
        <div className="bg-emerald-500 p-1 rounded text-slate-900 font-bold text-sm">FF</div>
        <h1 className="text-lg md:text-xl font-bold tracking-tight">FundFort</h1>
      </Link>

      <div className="flex items-center gap-4">
        <span className="text-[9px] font-bold uppercase text-emerald-400 border border-emerald-400/30 px-2 py-0.5 rounded hidden xs:block">
          {userType}
        </span>
        <button 
          onClick={handleLogout}
          className="bg-white/10 hover:bg-rose-600 px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}