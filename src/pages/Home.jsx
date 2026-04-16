import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header - Stays sticky and slim */}
      <nav className="border-b border-slate-200 sticky top-0 bg-white z-[100]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-[#002147] text-white p-1 rounded-sm font-bold">FFB</div>
            <h1 className="text-lg font-bold text-[#002147] tracking-tight">FundFort Bank</h1>
          </div>
          <Link to="/login" className="bg-[#002147] text-white px-5 py-2 text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-all">
            Sign In
          </Link>
        </div>
      </nav>

      {/* Hero Section - Responsive flex */}
      <header className="max-w-7xl mx-auto px-4 py-12 md:py-24 grid md:grid-cols-2 gap-12 items-center">
        <div className="text-center md:text-left">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-[0.3em] mb-4 block">UK Institutional Wealth Management</span>
          <h2 className="text-4xl md:text-6xl font-bold text-[#002147] leading-tight mb-6">
            Global Assets. <br /> Dedicated Security.
          </h2>
          <p className="text-slate-500 text-lg mb-10 max-w-lg mx-auto md:mx-0">
            Secure multi-currency accounts and wealth management for private individuals and corporate partners. 
          </p>
          <Link to="/login" className="inline-block bg-[#002147] text-white px-8 py-4 font-bold text-sm uppercase tracking-widest hover:bg-emerald-700 transition-all">
            Get Started
          </Link>
        </div>
        <div className="hidden md:block bg-slate-100 h-[400px] border border-slate-200">
          <img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover grayscale" alt="Bank HQ" />
        </div>
      </header>

      {/* Feature Grid - Responsive Grid */}
      <section className="bg-slate-50 border-y border-slate-200 py-16 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          <div className="bg-white p-8 border border-slate-200">
            <h4 className="font-bold text-[#002147] uppercase text-sm mb-3">Swift Liquidity</h4>
            <p className="text-slate-500 text-sm">International wire transfers processed via secure SWIFT/SEPA gateways.</p>
          </div>
          <div className="bg-white p-8 border border-slate-200">
            <h4 className="font-bold text-[#002147] uppercase text-sm mb-3">Wealth Protection</h4>
            <p className="text-slate-500 text-sm">High-tier encryption protocols ensuring total anonymity of ledger records.</p>
          </div>
          <div className="bg-white p-8 border border-slate-200 sm:col-span-2 md:col-span-1">
            <h4 className="font-bold text-[#002147] uppercase text-sm mb-3">Relationship Management</h4>
            <p className="text-slate-500 text-sm">Dedicated case managers available 24/7 for all premier account holders.</p>
          </div>
        </div>
      </section>

      {/* Office Details - Stacks on mobile */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h3 className="text-2xl font-bold text-[#002147] mb-4">Contact Our London Office</h3>
        <p className="text-slate-500 text-sm mb-8">25 Canada Square, Canary Wharf, London, E14 5LB</p>
        <p className="font-bold text-[#002147]">support@fundfort.online</p>
      </section>

      <footer className="border-t border-slate-200 py-10 text-center text-slate-400 text-[10px] uppercase font-bold tracking-widest px-4">
        &copy; 2026 FundFort Bank S.A. | Twitter: @fundfortbank | LinkedIn: /fundfortbank
      </footer>
    </div>
  );
}