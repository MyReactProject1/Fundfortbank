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

  // Transfer Modal state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({
    account_id: '',
    amount: '',
    description: '',
    password: ''
  });
  const [recipientLookup, setRecipientLookup] = useState({ loading: false, name: '', error: '' });
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');

  // Receipt Modal state (used for both new transfers & clicking any transaction)
  const [activeReceipt, setActiveReceipt] = useState(null);

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

  // --- AUTO-LOOKUP RECIPIENT NAME WHEN ACCOUNT NUMBER IS TYPED ---
  useEffect(() => {
    const acc = transferForm.account_id.trim();
    if (acc.length < 6) {
      setRecipientLookup({ loading: false, name: '', error: '' });
      return;
    }

    const timer = setTimeout(async () => {
      setRecipientLookup({ loading: true, name: '', error: '' });
      try {
        const { data, error } = await supabase.functions.invoke('bank-transfer', {
          body: { action: 'lookup', account_id: acc }
        });
        if (error) throw error;
        if (data?.found) {
          setRecipientLookup({ loading: false, name: data.full_name, error: '' });
        } else {
          setRecipientLookup({ loading: false, name: '', error: data?.message || 'Account not found' });
        }
      } catch (_) {
        setRecipientLookup({ loading: false, name: '', error: 'Could not verify account number' });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [transferForm.account_id]);

  // --- EXECUTE INTRA-BANK TRANSFER ---
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setTransferError('');

    if (!recipientLookup.name) {
      setTransferError('Please enter a valid recipient account number first.');
      return;
    }
    if (!transferForm.password) {
      setTransferError('Please enter your account password to authorize this transfer.');
      return;
    }

    setTransferLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('bank-transfer', {
        body: {
          action: 'transfer',
          recipient_account_id: transferForm.account_id.trim(),
          amount: Number(transferForm.amount),
          description: transferForm.description.trim() || 'FundFort Transfer',
          password: transferForm.password
        }
      });

      if (error) {
        let msg = error.message;
        try {
          const parsed = await error.context?.json();
          if (parsed?.error) msg = parsed.error;
        } catch (_) {}
        throw new Error(msg);
      }

      if (data?.error) throw new Error(data.error);

      setShowTransfer(false);
      setTransferForm({ account_id: '', amount: '', description: '', password: '' });
      setRecipientLookup({ loading: false, name: '', error: '' });
      setActiveReceipt(data.receipt);
      await fetchUserData(profile.id);
    } catch (err) {
      setTransferError(err.message || 'Transfer failed.');
    } finally {
      setTransferLoading(false);
    }
  };

  // --- PRINT / DOWNLOAD INDIVIDUAL TRANSACTION RECEIPT AS PDF ---
  const printReceiptPDF = (receipt) => {
    const win = window.open('', '_blank', 'width=720,height=900');
    if (!win) return;
    const formattedAmt = formatMoney(receipt.amount, receipt.currency || profile.currency);
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Transaction Receipt - ${receipt.reference || 'FundFort Bank'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; background: #fff; }
          .card { max-width: 560px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 14px; overflow: hidden; }
          .header { background: #002147; color: #fff; padding: 24px; display: flex; justify-content: space-between; align-items: center; }
          .body { padding: 28px; }
          .amount { text-align: center; background: #f8fafc; padding: 20px; border-radius: 10px; margin-bottom: 24px; }
          .amount h1 { margin: 6px 0 0; font-size: 32px; color: #002147; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          td { padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
          td:last-child { text-align: right; font-weight: bold; }
          .footer { text-align: center; font-size: 11px; color: #64748b; padding: 16px; background: #f8fafc; }
          @media print { body { padding: 0; } .card { border: none; } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div><strong style="font-size:18px;">FUNDFORT BANK</strong><br><span style="font-size:11px;opacity:0.8;">Official Transaction Receipt</span></div>
            <div style="font-size:11px;font-weight:bold;background:#059669;padding:4px 10px;border-radius:20px;">${String(receipt.status || 'COMPLETED').toUpperCase()}</div>
          </div>
          <div class="body">
            <div class="amount">
              <span style="font-size:11px;text-transform:uppercase;color:#64748b;font-weight:bold;">${receipt.type === 'credit' ? 'Credit Amount' : 'Debit Amount'}</span>
              <h1>${formattedAmt}</h1>
            </div>
            <table>
              <tr><td>Date &amp; Time</td><td>${new Date(receipt.date).toLocaleString()}</td></tr>
              <tr><td>Reference</td><td style="font-family:monospace;">${receipt.reference || '—'}</td></tr>
              <tr><td>Account Holder</td><td>${receipt.sender_name || profile.full_name}</td></tr>
              <tr><td>Account Number</td><td style="font-family:monospace;">${receipt.sender_account || profile.account_id}</td></tr>
              ${receipt.recipient_name ? `<tr><td>Beneficiary</td><td>${receipt.recipient_name} (${receipt.recipient_account})</td></tr>` : ''}
              <tr><td>Description</td><td>${receipt.description || '—'}</td></tr>
            </table>
          </div>
          <div class="footer">Generated by FundFort Bank • This is an electronic receipt and requires no signature.</div>
        </div>
        <script>window.onload = () => { window.print(); };</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  // --- SHARE RECEIPT TO WHATSAPP ---
  const shareToWhatsApp = (receipt) => {
    const amt = formatMoney(receipt.amount, receipt.currency || profile.currency);
    const text = [
      `*FUNDFORT BANK — TRANSACTION RECEIPT*`,
      `Status: ${String(receipt.status || 'Completed').toUpperCase()}`,
      `Amount: ${amt}`,
      receipt.recipient_name ? `Beneficiary: ${receipt.recipient_name} (${receipt.recipient_account})` : null,
      `Description: ${receipt.description || '—'}`,
      receipt.reference ? `Reference: ${receipt.reference}` : null,
      `Date: ${new Date(receipt.date).toLocaleString()}`
    ].filter(Boolean).join('\n');

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  // --- PRINT / DOWNLOAD FULL STATEMENT OF ACCOUNT (PDF) ---
  const printStatementOfAccount = () => {
    const win = window.open('', '_blank', 'width=850,height=1000');
    if (!win) return;
    const rows = transactions.map(t => `
      <tr>
        <td>${new Date(t.created_at).toLocaleDateString()}</td>
        <td>${t.description || 'Transaction'}</td>
        <td style="text-transform:capitalize;">${t.type}</td>
        <td style="text-align:right;font-weight:bold;color:${t.type === 'credit' ? '#059669' : '#0f172a'};">
          ${t.type === 'credit' ? '+' : '-'}${formatMoney(t.amount, profile.currency)}
        </td>
        <td>${t.status || 'completed'}</td>
      </tr>
    `).join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Statement of Account - ${profile.account_id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
          .top { display: flex; justify-content: space-between; border-bottom: 3px solid #002147; padding-bottom: 16px; margin-bottom: 24px; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #002147; color: #fff; text-align: left; padding: 10px; }
          td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
          .footer { margin-top: 32px; font-size: 11px; color: #64748b; text-align: center; }
        </style>
      </head>
      <body>
        <div class="top">
          <div>
            <h1 style="margin:0;color:#002147;font-size:22px;">FUNDFORT BANK</h1>
            <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Official Statement of Account</p>
          </div>
          <div style="text-align:right;font-size:12px;">
            <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
            <strong>Currency:</strong> ${profile.currency || 'USD'}
          </div>
        </div>
        <div class="meta">
          <div><strong>Account Name:</strong> ${profile.full_name}</div>
          <div><strong>Account Number:</strong> ${profile.account_id}</div>
          <div><strong>Email:</strong> ${profile.email}</div>
          <div><strong>Available Balance:</strong> ${formatMoney(profile.balance, profile.currency)}</div>
        </div>
        <table>
          <thead>
            <tr><th>Date</th><th>Description</th><th>Type</th><th style="text-align:right;">Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5" style="text-align:center;padding:24px;color:#94a3b8;">No transactions recorded.</td></tr>'}
          </tbody>
        </table>
        <div class="footer">FundFort Bank • Electronic Statement of Account • Protected by 256-bit Encryption</div>
        <script>window.onload = () => { window.print(); };</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  const handleExitImpersonation = () => {
    localStorage.removeItem('impersonated_customer_id');
    navigate('/admin');
  };

  // --- SAVE BASIC PROFILE & SEND ACCOUNT CHANGE ALERT ---
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

      // Send email alert for account change
      await supabase.functions.invoke('send-bank-alert', {
        body: {
          customer_id: profile.id,
          event_type: 'security_alert',
          description: 'Your account profile details (name, phone, or address) were updated.'
        }
      });

      await fetchUserData(profile.id);
      setEditMessage({ type: 'success', text: 'Account information updated & email alert sent!' });
    } catch (err) {
      setEditMessage({ type: 'error', text: err.message || 'Could not update account information.' });
    } finally {
      setEditLoading(false);
    }
  };

  // --- CHANGE PASSWORD & SEND SECURITY ALERT ---
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

      // Send email alert for password change
      await supabase.functions.invoke('send-bank-alert', {
        body: {
          customer_id: profile.id,
          event_type: 'security_alert',
          description: 'Your FundFort Bank login password was changed.'
        }
      });

      setNewPassword('');
      setConfirmPassword('');
      setPwMessage({ type: 'success', text: 'Password updated & security alert sent to your email!' });
    } catch (err) {
      setPwMessage({ type: 'error', text: err.message || 'Could not update password.' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleQuickAction = (action) => {
    if (action === 'transfer') {
      if (profile.account_status === 'frozen') {
        setRestriction({ title: 'Account Frozen', reason: 'Your account is currently frozen. Please contact support.' });
        return;
      }
      if (profile.transfer_restricted) {
        setRestriction({ title: 'Transfer service unavailable', reason: profile.transfer_reason || 'Transfers are currently restricted.' });
        return;
      }
      setTransferError('');
      setShowTransfer(true);
      return;
    }
    if (action === 'statement') {
      printStatementOfAccount();
      return;
    }
    if (action === 'withdraw' && profile.withdraw_restricted) {
      setRestriction({ title: 'Withdrawal unavailable', reason: profile.withdraw_reason });
    }
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
              {profile.account_type || 'Standard'} • {profile.account_id || `•••• ${accountLast4}`}
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
              <button
                onClick={printStatementOfAccount}
                className="mt-5 w-full rounded-xl border border-[#002147] py-3 text-xs font-bold text-[#002147] hover:bg-slate-50"
              >
                📄 Print / Download Statement of Account (PDF)
              </button>
            </section>

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
                <div className={`mb-4 rounded-xl border p-3 text-xs font-medium ${editMessage.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                  {editMessage.text}
                </div>
              )}

              <form onSubmit={handleSaveBasicInfo} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Full Name</label>
                  <input type="text" required disabled={profile.profile_edit_locked} value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none disabled:bg-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Phone Number</label>
                  <input type="tel" disabled={profile.profile_edit_locked} value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none disabled:bg-slate-100" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Address</label>
                  <input type="text" disabled={profile.profile_edit_locked} value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none disabled:bg-slate-100" />
                </div>
                <button disabled={editLoading || profile.profile_edit_locked}
                  className="w-full bg-[#002147] text-white py-3.5 rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-50">
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </section>

            {!isImpersonating && (
              <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-1">Change Password</h3>
                <p className="text-xs text-slate-500 mb-5">Update your login password anytime.</p>

                {pwMessage.text && (
                  <div className={`mb-4 rounded-xl border p-3 text-xs font-medium ${pwMessage.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                    {pwMessage.text}
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">New Password</label>
                    <input type="password" required minLength={6} value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 6 characters"
                      className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#002147]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">Confirm New Password</label>
                    <input type="password" required minLength={6} value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password"
                      className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#002147]" />
                  </div>
                  <button disabled={pwLoading}
                    className="w-full bg-[#002147] text-white py-3.5 rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-50">
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
                <div className="mt-8 flex flex-wrap gap-3">
                  <span className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-bold">Acc: {profile.account_id}</span>
                  <span className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-bold">Insured</span>
                </div>
              </div>
              <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/5 rounded-full blur-3xl"></div>
            </section>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-4 mb-10">
              {[
                { label: 'Transfer', icon: '⇄', color: 'bg-blue-50 text-blue-600', action: 'transfer' },
                { label: 'Statement', icon: '📄', color: 'bg-emerald-50 text-emerald-600', action: 'statement' },
                { label: 'Withdraw', icon: '↓', color: 'bg-purple-50 text-purple-600', action: 'withdraw' },
                { label: 'Settings', icon: '⚙️', color: 'bg-orange-50 text-orange-600', action: 'settings' }
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => item.action === 'settings' ? setActiveTab('more') : handleQuickAction(item.action)}
                  className="flex flex-col items-center gap-2"
                >
                  <div className={`${item.color} w-14 h-14 rounded-2xl flex items-center justify-center text-xl shadow-sm hover:scale-105 transition-transform`}>
                    {item.icon}
                  </div>
                  <span className="text-[11px] font-bold text-slate-600">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Recent Activity (Click any item to print/share receipt) */}
            <section className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-bold text-slate-900">Recent Activity</h3>
                  <p className="text-[11px] text-slate-400">Tap any transaction to print or share receipt</p>
                </div>
                <button onClick={printStatementOfAccount} className="text-blue-600 text-xs font-bold hover:underline">
                  Print Statement
                </button>
              </div>

              <div className="space-y-5">
                {transactions.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setActiveReceipt({
                      reference: t.id?.slice(0, 12).toUpperCase(),
                      amount: t.amount,
                      currency: profile.currency,
                      type: t.type,
                      status: t.status || 'completed',
                      date: t.created_at,
                      sender_name: profile.full_name,
                      sender_account: profile.account_id,
                      description: t.description
                    })}
                    className="flex justify-between items-center group cursor-pointer rounded-2xl p-2 -mx-2 hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-lg font-bold text-[#002147]">
                        {(t.description || 'T')[0]}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900 line-clamp-1">{t.description || 'Transaction'}</p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} • {t.status}
                        </p>
                      </div>
                    </div>
                    <p className={`font-bold text-sm whitespace-nowrap ${t.type === 'credit' ? 'text-emerald-600' : 'text-slate-900'}`}>
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

      {/* Mobile Navigation */}
      <nav className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-between items-center mobile-nav md:hidden">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-[#002147]' : 'text-slate-300'}`}>
          <span className="text-xl">🏠</span>
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button onClick={() => handleQuickAction('transfer')} className="flex flex-col items-center gap-1 text-slate-400">
          <span className="text-xl">⇄</span>
          <span className="text-[10px] font-bold">Transfer</span>
        </button>
        <button onClick={printStatementOfAccount} className="flex flex-col items-center gap-1 text-slate-400">
          <span className="text-xl">📄</span>
          <span className="text-[10px] font-bold">Statement</span>
        </button>
        <button onClick={() => setActiveTab('more')} className={`flex flex-col items-center gap-1 ${activeTab === 'more' ? 'text-[#002147]' : 'text-slate-300'}`}>
          <span className="text-xl">⚙️</span>
          <span className="text-[10px] font-bold">Settings</span>
        </button>
      </nav>

      {/* --- INTRA-BANK TRANSFER MODAL --- */}
      {showTransfer && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <header className="flex shrink-0 items-center justify-between bg-[#002147] p-5 text-white">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">FundFort Intra-Bank</p>
                <h3 className="text-lg font-bold">Send Money</h3>
              </div>
              <button onClick={() => setShowTransfer(false)} className="text-2xl text-white/80 hover:text-white">×</button>
            </header>

            <div className="overflow-y-auto p-6">
              {transferError && (
                <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                  ⚠️ {transferError}
                </div>
              )}

              <form onSubmit={handleTransferSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Recipient Account Number *</label>
                  <input
                    type="text"
                    required
                    value={transferForm.account_id}
                    onChange={(e) => setTransferForm({ ...transferForm, account_id: e.target.value })}
                    placeholder="Enter 10-digit account number"
                    className="w-full border border-slate-200 p-3 rounded-xl font-mono text-sm outline-none focus:ring-2 focus:ring-[#002147]"
                  />
                  {recipientLookup.loading && (
                    <p className="mt-1.5 text-xs text-slate-400">Verifying account number...</p>
                  )}
                  {recipientLookup.name && (
                    <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-800">
                      ✓ Beneficiary: {recipientLookup.name}
                    </div>
                  )}
                  {recipientLookup.error && (
                    <p className="mt-1.5 text-xs font-semibold text-rose-600">{recipientLookup.error}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Amount ({profile.currency || 'USD'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={transferForm.amount}
                    onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full border border-slate-200 p-3 rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-[#002147]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Narration / Description</label>
                  <input
                    type="text"
                    value={transferForm.description}
                    onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })}
                    placeholder="e.g., Payment for services"
                    className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#002147]"
                  />
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
                  <label className="text-xs font-bold text-slate-800 block mb-1">
                    🔒 Confirm Your Password to Authorize *
                  </label>
                  <input
                    type="password"
                    required
                    value={transferForm.password}
                    onChange={(e) => setTransferForm({ ...transferForm, password: e.target.value })}
                    placeholder="Enter your login password"
                    className="w-full border border-slate-300 bg-white p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#002147]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={transferLoading || !recipientLookup.name}
                  className="w-full bg-[#002147] text-white py-3.5 rounded-xl font-bold text-sm hover:bg-slate-800 disabled:opacity-50"
                >
                  {transferLoading ? 'Processing Transfer...' : 'Authorize & Send Money'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- TRANSACTION RECEIPT MODAL (WHATSAPP SHARE + PRINT / DOWNLOAD PDF) --- */}
      {activeReceipt && (
        <div className="fixed inset-0 z-[5500] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="bg-[#002147] p-6 text-center text-white">
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-xl font-bold">
                ✓
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-200">Transaction Receipt</p>
              <h3 className="mt-1 text-3xl font-black">
                {formatMoney(activeReceipt.amount, activeReceipt.currency)}
              </h3>
            </div>

            <div className="p-6 space-y-3 text-xs">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Status</span>
                <span className="font-bold uppercase text-emerald-700">{activeReceipt.status}</span>
              </div>
              {activeReceipt.recipient_name && (
                <div className="flex justify-between border-b pb-2">
                  <span className="text-slate-500">Beneficiary</span>
                  <span className="font-bold text-slate-900">{activeReceipt.recipient_name} ({activeReceipt.recipient_account})</span>
                </div>
              )}
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Description</span>
                <span className="font-semibold text-slate-900 text-right max-w-[60%]">{activeReceipt.description || '—'}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Reference</span>
                <span className="font-mono font-bold text-slate-800">{activeReceipt.reference || '—'}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-slate-500">Date &amp; Time</span>
                <span className="text-slate-700">{new Date(activeReceipt.date).toLocaleString()}</span>
              </div>

              <div className="pt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => shareToWhatsApp(activeReceipt)}
                  className="rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  Share to WhatsApp
                </button>
                <button
                  onClick={() => printReceiptPDF(activeReceipt)}
                  className="rounded-xl bg-[#002147] py-3 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Print / Save PDF
                </button>
              </div>
              <button
                onClick={() => setActiveReceipt(null)}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restriction Modal */}
      {restriction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[5000] p-6">
          <div className="bg-white p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">!</div>
            <h3 className="text-xl font-bold mb-2 text-slate-900">{restriction.title}</h3>
            <p className="text-slate-500 mb-8 text-sm leading-relaxed">{restriction.reason}</p>
            <button onClick={() => setRestriction(null)} className="w-full bg-[#002147] text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:bg-slate-800">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
}
