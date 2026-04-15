import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="border-b border-slate-200 px-6 py-4 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
            <div className="bg-[#0f172a] text-white p-1.5 rounded font-bold text-lg">FFB</div>
            <h1 className="text-xl font-bold text-[#0f172a]">FundFort Bank</h1>
        </div>
        <div className="flex items-center gap-6">
            <Link to="/login" className="bg-[#0f172a] text-white px-5 py-2 rounded font-semibold text-sm hover:bg-slate-800 transition-all">
                Sign In
            </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
            <h2 className="text-5xl font-bold text-[#0f172a] leading-tight mb-6">
                Institutional Wealth Management & Digital Banking.
            </h2>
            <p className="text-slate-600 text-lg mb-8 leading-relaxed">
                FundFort provides secure, regulated financial services for private individuals and corporate entities worldwide. Managed from our central London offices.
            </p>
            <div className="flex gap-4">
                <Link to="/login" className="bg-emerald-600 text-white px-6 py-3 rounded font-bold hover:bg-emerald-700 transition-all">
                    Access your Account
                </Link>
                <button className="border border-slate-300 text-slate-600 px-6 py-3 rounded font-bold hover:bg-slate-50 transition-all">
                    Our Services
                </button>
            </div>
        </div>
        <div className="bg-slate-100 rounded-lg h-80 overflow-hidden shadow-sm border border-slate-200">
             <img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Bank HQ" />
        </div>
      </section>

      {/* Info Bar */}
      <div className="bg-[#0f172a] text-white py-12 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
                <h4 className="font-bold text-emerald-400 mb-2 underline underline-offset-4">Regulated Entity</h4>
                <p className="text-sm text-slate-400">Adhering to strict UK financial standards and asset protection laws.</p>
            </div>
            <div>
                <h4 className="font-bold text-emerald-400 mb-2 underline underline-offset-4">Global Reach</h4>
                <p className="text-sm text-slate-400">Full SWIFT/SEPA integration for seamless international fund movements.</p>
            </div>
            <div>
                <h4 className="font-bold text-emerald-400 mb-2 underline underline-offset-4">24/7 Support</h4>
                <p className="text-sm text-slate-400">Dedicated relationship managers available at support@fundfort.online</p>
            </div>
        </div>
      </div>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-slate-500 text-xs gap-6">
        <p>&copy; 2026 FundFort Bank International S.A. | UK Company #88412</p>
        <p>London Office: 25 Canada Square, Canary Wharf, London, E14 5LB</p>
        <div className="flex gap-4">
            <span className="hover:text-[#0f172a] cursor-pointer">Twitter</span>
            <span className="hover:text-[#0f172a] cursor-pointer">LinkedIn</span>
        </div>
      </footer>
    </div>
  );
}