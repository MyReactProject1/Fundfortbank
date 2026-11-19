import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';

const formatMoney = (amount, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' })
    .format(Number(amount || 0));

export default function UserDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [restriction, setRestriction] = useState(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  // Basic Profile Edit state
  const [editForm, setEditForm] = useState({ full_name: '', phone: '', address: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState({ type: '', text: '' });

  // Change Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/');
        return;
      }

      const impersonatedId = localStorage.getItem('impersonated_customer_id');
      if (impersonatedId) {
        const { data: adminRow } = await supabase
          .from('admins')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();

        if (adminRow) {
          setIsImpersonating(true);
          fetchUserData(impersonatedId);
          return;
        } else {
          localStorage.removeItem('impersonated_customer_id');
        }
      }

      if (session.user?.user_metadata?.must_change_password) {
        navigate('/login?mode=force-reset');
        return;
      }

      if (session.user?.user_metadata?.profile_completed === false) {
        navigate('/login?mode=complete-profile');
        return;
      }

      fetchUserData(session.user.id);
    };
    init();
  }, [navigate]);

  async function fetchUserData(userId) {
    const { data: cust } = await supabase
      .from('customers')
      .select('*')
      .eq('id', userId)
      .single();

    if (cust) {
      setProfile(cust);
      setEditForm({
        full_name: cust.full_name || '',
        phone: cust.phone || '',
        address: cust.address || ''
      });
    }

    const { data: trans } = await supabase
      .from('transactions')
      .select('*')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false });
    setTransactions(trans || []);
  }

  const handleExitImpersonation = () => {
    localStorage.removeItem('impersonated_customer_id');
    navigate('/admin');
  };

  const handleSaveBasicInfo = async (e) => {
    e.preventDefault();
    setEditMessage({ type: '', text: '' });

    if (profile?.profile_edit_locked) {
      setEditMessage({ type: 'error', text: 'Profile editing is currently locked by the administrator.' });
      return;
    }

    setEditLoading(true);
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          full_name: editForm.full_name.trim(),
          phone: editForm.phone.trim() || null,
          address: editForm.address.trim() || null
        })
        .eq('id', profile.id);

      if (error) throw error;
      await fetchUserData(profile.id);
      setEditMessage({ type: 'success', text: 'Account information updated successfully!' });
    } catch (err) {
      setEditMessage({ type: 'error', text: err.message || 'Could not update account information.' });
    } finally {
      setEditLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMessage({ type: '', text: '' });

    if (newPassword.length < 6) {
      setPwMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false }
      });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      setPwMessage({ type: 'success', text: 'Password updated successfully!' });
    } catch (err) {
      setPwMessage({ type: 'error', text: err.message || 'Could not update password.' });
    } finally {
      setPwLoading(false);
    }
  };

  const checkRestriction = (action) => {
    if (action === 'transfer' && profile.transfer_restricted) {
      setRestriction({ title: 'Transfer service unavailable', reason: profile.transfer_reason });
      return true;
    }
    if (action === 'withdraw' && profile.withdraw_restricted) {
      setRestriction({ title: 'Withdrawal unavailable', reason: profile.withdraw_reason });
      return true;
    }
    return false;
  };

  if (!profile) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-400 font-medium">
        Updating your accounts...
      </div>
    );
  }

  const firstName = (profile.full_name || 'Customer').split(' ')[0];
  const accountLast4 = String(profile.account_id || '0000').slice(-4);

  return (
    <div className="min-h-screen bg-slate-50 pb-32 md:pb-10 font-sans">
      {isImpersonating && (
        <div className="bg-amber-400 text-slate-950 px-4 py-2.5 text-xs font-bold flex items-center justify-between gap-3">
          <span>⚡ SUPER ADMIN VIEW: Impersonating {profile.full_name} ({profile.email})</span>
          <button
            onClick={handleExitImpersonation}
            className="bg-slate-950 text-white px-3 py-1 rounded-lg hover:bg-slate-800 whitespace-nowrap"
          >
            Exit to Admin
          </button>
        </div>
      )}

      <Navbar userType={isImpersonating ? 'Super Admin (Viewing Customer)' : 'Standard User'} />

      <main className="max-w-xl mx-auto px-4 pt-6 md:pt-10">
        <header className="flex justify-between items-center mb-8 px-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">Hello, {firstName}</h1>
            <p className="text-sm text-slate-500">
              {profile.account_type || 'Standard'} •••• {accountLast4}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab(activeTab === 'more' ? 'home' : 'more')}
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              {activeTab === 'more' ? '← Dashboard' : '⚙️ Settings'}
            </button>
            <img
              src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.full_name || 'Customer')}`}
              alt=""
              className="w-12 h-12 rounded-full border border-slate-200 object-cover"
            />
          </div>
        </header>

        {activeTab === 'more' ? (
          <div className="space-y-6">
            {/* Account Summary */}
            <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4">Account Summary</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Email</dt>
                  <dd className="font-semibold text-slate-900">{profile.email}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Account Number</dt>
                  <dd className="font-mono font-bold text-[#002147]">{profile.account_id || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Status</dt>
                  <dd className="font-bold uppercase text-xs text-emerald-700">{profile.account_status || 'active'}</dd>
                </div>
              </dl>
            </section>

            {/* Basic Account Information Edit */}
            <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-slate-900">Edit Basic Information</h3>
                {profile.profile_edit_locked && (
                  <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-rose-700">
                    🔒 Locked by Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mb-5">
                {profile.profile_edit_locked
                  ? 'Profile editing has been locked by the administrator.'
                  : 'Update your name, phone number, or residential address.'}
              </p>

              {editMessage.text && (
                <div
                  className={`mb-4 rounded-xl border p-3 text-xs font-medium ${
                    editMessage.type === 'error'
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {editMessage.text}
                </div>
              )}

              <form onSubmit={handleSaveBasicInfo} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Full Name</label>
                  <input
                    type="text"
                    required
                    disabled={profile.profile_edit_locked}
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    disabled={profile.profile_edit_locked}
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Address</label>
                  <input
                    type="text"
                    disabled={profile.profile_edit_locked}
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none disabled:bg-slate-100"
                  />
                </div>
                <button
                  disabled={editLoading || profile.profile_edit_locked}
                  className="w-full bg-[#002147] text-white py-3.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </section>

            {/* Change Password */}
            {!isImpersonating && (
              <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-1">Change Password</h3>
                <p className="text-xs text-slate-500 mb-5">Update your login password anytime.</p>

                {pwMessage.text && (
                  <div
                    className={`mb-4 rounded-xl border p-3 text-xs font-medium ${
                      pwMessage.type === 'error'
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {pwMessage.text}
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">New Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full border border-slate-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full border border-slate-200 p-3 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none"
                    />
                  </div>
                  <button
                    disabled={pwLoading}
                    className="w-full bg-[#002147] text-white py-3.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
                  >
                    {pwLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </section>
            )}
          </div>
        ) : (
          <>
            <section className="bg-[#002147] p-8 rounded-[2rem] text-white shadow-xl shadow-blue-900/20 mb-8 relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-2">Available Balance</p>
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
                  {formatMoney(profile.balance, profile.currency)}
                </h2>
                <div className="mt-8 flex gap-3">
                  <span className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-bold">+2.4% APR</span>
                  <span className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-bold">Insured</span>
                </div>
              </div>
              <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
            </section>

            <div className="grid grid-cols-4 gap-4 mb-10">
              {[
                { label: 'Transfer', icon: '⇄', color: 'bg-blue-50 text-blue-600', action: 'transfer' },
                { label: 'Deposit', icon: '↓', color: 'bg-emerald-50 text-emerald-600', action: 'deposit' },
                { label: 'Pay Bill', icon: '📄', color: 'bg-purple-50 text-purple-600', action: 'pay' },
                { label: 'Cards', icon: '💳', color: 'bg-orange-50 text-orange-600', action: 'cards' }
              ].map((item) => (
                <button key={item.label} onClick={() => checkRestriction(item.action)} className="flex flex-col items-center gap-2">
                  <div className={`${item.color} w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-sm hover:scale-105 transition-transform`}>
                    {item.icon}
                  </div>
                  <span className="text-[11px] font-bold text-slate-600">{item.label}</span>
                </button>
              ))}
            </div>

            <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-900">Recent Activity</h3>
                <button className="text-blue-600 text-xs font-bold">See all</button>
              </div>

              <div className="space-y-6">
                {transactions.map(t => (
                  <div key={t.id} className="flex justify-between items-center group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-lg grayscale group-hover:grayscale-0 transition-all font-bold">
                        {(t.description || 'T')[0]}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900">{t.description || 'Transaction'}</p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {t.status}
                        </p>
                      </div>
                    </div>
                    <p className={`font-bold text-sm ${t.type === 'credit' ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {t.type === 'credit' ? '+' : '-'}{formatMoney(t.amount, profile.currency)}
                    </p>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <p className="text-center py-10 text-slate-300 text-sm font-medium italic">No recent transactions</p>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-between items-center mobile-nav md:hidden">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-[#002147]' : 'text-slate-300'}`}>
          <span className="text-xl">🏠</span>
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button onClick={() => setActiveTab('accounts')} className={`flex flex-col items-center gap-1 ${activeTab === 'accounts' ? 'text-[#002147]' : 'text-slate-300'}`}>
          <span className="text-xl">📊</span>
          <span className="text-[10px] font-bold">Accounts</span>
        </button>
        <button onClick={() => setActiveTab('activity')} className={`flex flex-col items-center gap-1 ${activeTab === 'activity' ? 'text-[#002147]' : 'text-slate-300'}`}>
          <span className="text-xl">🕒</span>
          <span className="text-[10px] font-bold">Activity</span>
        </button>
        <button onClick={() => setActiveTab('more')} className={`flex flex-col items-center gap-1 ${activeTab === 'more' ? 'text-[#002147]' : 'text-slate-300'}`}>
          <span className="text-xl">⚙️</span>
          <span className="text-[10px] font-bold">Settings</span>
        </button>
      </nav>

      {restriction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[5000] p-6">
          <div className="bg-white p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl animate-fadeIn">
            <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">!</div>
            <h3 className="text-xl font-bold mb-2 text-slate-900">{restriction.title}</h3>
            <p className="text-slate-500 mb-8 text-sm leading-relaxed">{restriction.reason}</p>
            <button onClick={() => setRestriction(null)} className="w-full bg-[#002147] text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:bg-slate-800 transition-all">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}
