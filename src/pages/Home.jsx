import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-600/20 overflow-x-hidden">
      
      {/* --- INSTITUTIONAL NAVBAR --- */}
      <nav className="sticky top-0 z-[100] bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="bg-[#0f172a] text-emerald-400 p-2 rounded-lg font-black text-xl italic shadow-lg">FF</div>
            <h1 className="text-xl md:text-2xl font-black tracking-tighter text-[#0f172a]">FundFort<span className="text-emerald-600 italic">Bank</span></h1>
        </div>
        <div className="flex items-center gap-4 md:gap-10">
            <Link to="/login" className="bg-[#0f172a] text-white px-6 py-2.5 rounded-full font-bold uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all active:scale-95 shadow-md">
                Secure Login
            </Link>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <header className="max-w-7xl mx-auto px-6 pt-16 md:pt-32 pb-20 md:pb-40 text-center">
        <span className="bg-emerald-100 text-emerald-800 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-8 inline-block border border-emerald-200">
             Registered Digital Bank
        </span>
        <h2 className="text-4xl md:text-8xl font-black text-[#0f172a] leading-tight tracking-tight uppercase mb-8 italic">
            Global Assets <br /> <span className="text-emerald-600 underline decoration-slate-200 underline-offset-8">Local Trust.</span>
        </h2>
        <p className="max-w-3xl mx-auto text-slate-500 text-lg md:text-xl font-medium leading-relaxed mb-12">
            Pioneering the future of fintech with physical presence. Regulated security for private equity and institutional wealth management.
        </p>
        <div className="flex flex-col md:flex-row justify-center gap-4">
            <Link to="/login" className="bg-emerald-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-[#0f172a] transition-all shadow-xl shadow-emerald-200">
                Access Your Account
            </Link>
            
        </div>
      </header>

      {/* --- SERVICES --- */}
      <section className="bg-[#0f172a] py-24 px-6 text-white rounded-[3rem] md:rounded-[5rem] mx-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16">
            <div>
                <h4 className="text-2xl font-black text-emerald-400 mb-4 uppercase italic">Zero-Delay Transfers</h4>
                <p className="text-slate-400 leading-relaxed font-medium">Real-time SWIFT and SEPA integration for borderless capital movement at institutional speeds.</p>
            </div>
            <div>
                <h4 className="text-2xl font-black text-emerald-400 mb-4 uppercase italic">Encryption Grade-A</h4>
                <p className="text-slate-400 leading-relaxed font-medium">End-to-end AES-256 vault protocols protect every ledger record from identity theft and fraud.</p>
            </div>
            <div>
                <h4 className="text-2xl font-black text-emerald-400 mb-4 uppercase italic">Physical Custody</h4>
                <p className="text-slate-400 leading-relaxed font-medium">Unlike neo-banks, we maintain a central UK physical headquarters for legal verified asset auditing.</p>
            </div>
        </div>
      </section>

      {/* --- PHYSICAL OFFICE & CONTACT --- */}
      <section className="py-24 max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
        <div>
            <h3 className="text-3xl md:text-5xl font-black text-[#0f172a] mb-6 italic tracking-tight uppercase">Presence in the Heart of London.</h3>
            <p className="text-slate-500 text-lg leading-relaxed mb-8">
                Our operations are anchored in the UK’s financial district, ensuring we adhere to the world’s most stringent financial regulations and privacy laws.
            </p>
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <span className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold">📍</span>
                    <span className="font-bold text-slate-700 italic">25 Canada Square, Canary Wharf, London, E14 5LB</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold">✉️</span>
                    <span className="font-bold text-emerald-600">support@fundfort.online</span>
                </div>
            </div>
        </div>
       
      </section>

      {/* --- FOOTER --- */}
      <footer className="bg-slate-50 border-t border-slate-200 py-20 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
            <div className="text-center md:text-left">
                <h3 className="text-2xl font-black italic text-[#0f172a]">FundFort<span className="text-emerald-600 italic">Bank</span></h3>
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 mt-2">&copy; 2026 FundFort Bank International S.A. UK Registry #88412</p>
            </div>
            {/* Social Medias */}
            <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-slate-500 italic">
                <span className="hover:text-emerald-600 cursor-pointer">@fundfortbank (Twitter)</span>
                <span className="hover:text-emerald-600 cursor-pointer">/fundfortbank (LinkedIn)</span>
            </div>
        </div>
      </footer>
    </div>
  );
}