import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';

const money = (amount, currency = 'USD') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' })
    .format(Number(amount || 0));

const dateTime = (value) => value ? new Date(value).toLocaleString() : '—';

const emptyProfile = {
  full_name: '', phone: '', address: '', account_type: 'Standard',
  currency: 'USD', avatar_url: ''
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('overview');
  const [transactions, setTransactions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [adjustment, setAdjustment] = useState({
    type: 'credit', amount: '', description: '', reference: ''
  });
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const [controlForm, setControlForm] = useState({
    account_status: 'active',
    withdraw_restricted: false,
    withdraw_reason: '',
    transfer_restricted: false,
    transfer_reason: '',
    daily_transfer_limit: '',
    daily_withdrawal_limit: ''
  });

  const run = async (task, successMessage = '') => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await task();
      if (successMessage) setNotice(successMessage);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'The action could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  const verifyAdmin = useCallback(async () => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) {
      navigate('/');
      return false;
    }

    // The database/RPC functions must independently enforce admin permissions.
    const { data, error: adminError } = await supabase
      .from('admins')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle();

    if (adminError) throw adminError;
    if (!data) {
      await supabase.auth.signOut();
      navigate('/');
      return false;
    }
    return true;
  }, [navigate]);

  const fetchCustomers = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (queryError) throw queryError;
    setCustomers(data || []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const isAdmin = await verifyAdmin();
        if (isAdmin) await fetchCustomers();
      } catch (err) {
        setError(err.message || 'Could not verify administrator access.');
      }
    })();
  }, [verifyAdmin, fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesSearch = !term || [
        customer.full_name, customer.email, customer.account_id
      ].some((value) => String(value || '').toLowerCase().includes(term));
      const status = customer.account_status || 'active';
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [customers, search, statusFilter]);

  const totals = useMemo(() => ({
    customers: customers.length,
    active: customers.filter(c => (c.account_status || 'active') === 'active').length,
    frozen: customers.filter(c => c.account_status === 'frozen').length,
    restricted: customers.filter(c =>
      c.withdraw_restricted || c.transfer_restricted || c.account_status === 'restricted'
    ).length
  }), [customers]);

  const openCustomer = async (customer) => {
    setSelected(customer);
    setTab('overview');
    setProfileForm({
      full_name: customer.full_name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      account_type: customer.account_type || 'Standard',
      currency: customer.currency || 'USD',
      avatar_url: customer.avatar_url || ''
    });
    setControlForm({
      account_status: customer.account_status || 'active',
      withdraw_restricted: Boolean(customer.withdraw_restricted),
      withdraw_reason: customer.withdraw_reason || '',
      transfer_restricted: Boolean(customer.transfer_restricted),
      transfer_reason: customer.transfer_reason || '',
      daily_transfer_limit: customer.daily_transfer_limit ?? '',
      daily_withdrawal_limit: customer.daily_withdrawal_limit ?? ''
    });
    await loadCustomerRecords(customer.id);
  };

  const loadCustomerRecords = async (customerId) => {
    await run(async () => {
      const [{ data: tx, error: txError }, { data: logs, error: logError }] = await Promise.all([
        supabase.from('transactions').select('*').eq('customer_id', customerId)
          .order('created_at', { ascending: false }).limit(100),
        supabase.from('admin_audit_logs').select('*').eq('customer_id', customerId)
          .order('created_at', { ascending: false }).limit(50)
      ]);
      if (txError) throw txError;
      // Audit-log read permission is optional in early setups.
      if (logError && !String(logError.message).toLowerCase().includes('permission')) throw logError;
      setTransactions(tx || []);
      setAuditLogs(logs || []);
    });
  };

  const refreshSelected = async () => {
    await fetchCustomers();
    if (!selected) return;
    const { data, error: queryError } = await supabase
      .from('customers').select('*').eq('id', selected.id).single();
    if (queryError) throw queryError;
    setSelected(data);
    await loadCustomerRecords(data.id);
  };

  const adjustBalance = async (event) => {
    event.preventDefault();
    if (!selected) return;
    const amount = Number(adjustment.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!adjustment.description.trim()) {
      setError('Enter a reason or description for this adjustment.');
      return;
    }
    if (!window.confirm(
      `${adjustment.type.toUpperCase()} ${money(amount, selected.currency || 'USD')} ` +
      `for ${selected.full_name}? This will create a permanent simulated ledger entry.`
    )) return;

    await run(async () => {
      const { error: rpcError } = await supabase.rpc('admin_adjust_customer_balance', {
        p_customer_id: selected.id,
        p_amount: amount,
        p_type: adjustment.type,
        p_description: adjustment.description.trim(),
        p_reference: adjustment.reference.trim() || null
      });
      if (rpcError) throw rpcError;
      setAdjustment({ type: 'credit', amount: '', description: '', reference: '' });
      await refreshSelected();
    }, 'Balance adjustment recorded.');
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!selected) return;
    await run(async () => {
      const { error: rpcError } = await supabase.rpc('admin_update_customer_profile', {
        p_customer_id: selected.id,
        p_full_name: profileForm.full_name.trim(),
        p_phone: profileForm.phone.trim() || null,
        p_address: profileForm.address.trim() || null,
        p_account_type: profileForm.account_type,
        p_currency: profileForm.currency,
        p_avatar_url: profileForm.avatar_url.trim() || null
      });
      if (rpcError) throw rpcError;
      await refreshSelected();
    }, 'Customer profile updated.');
  };

  const saveControls = async (event) => {
    event.preventDefault();
    if (!selected) return;
    await run(async () => {
      const { error: rpcError } = await supabase.rpc('admin_update_customer_controls', {
        p_customer_id: selected.id,
        p_account_status: controlForm.account_status,
        p_withdraw_restricted: controlForm.withdraw_restricted,
        p_withdraw_reason: controlForm.withdraw_reason,
        p_transfer_restricted: controlForm.transfer_restricted,
        p_transfer_reason: controlForm.transfer_reason,
        p_daily_transfer_limit: controlForm.daily_transfer_limit === '' ? null : Number(controlForm.daily_transfer_limit),
        p_daily_withdrawal_limit: controlForm.daily_withdrawal_limit === '' ? null : Number(controlForm.daily_withdrawal_limit)
      });
      if (rpcError) throw rpcError;
      await refreshSelected();
    }, 'Account controls updated.');
  };

  const changeStatus = async (status) => {
    if (!selected) return;
    if (!window.confirm(`Change ${selected.full_name}'s account status to ${status.toUpperCase()}?`)) return;
    setControlForm(current => ({ ...current, account_status: status }));
    await run(async () => {
      const { error: rpcError } = await supabase.rpc('admin_update_customer_controls', {
        p_customer_id: selected.id,
        p_account_status: status,
        p_withdraw_restricted: controlForm.withdraw_restricted,
        p_withdraw_reason: controlForm.withdraw_reason,
        p_transfer_restricted: controlForm.transfer_restricted,
        p_transfer_reason: controlForm.transfer_reason,
        p_daily_transfer_limit: controlForm.daily_transfer_limit === '' ? null : Number(controlForm.daily_transfer_limit),
        p_daily_withdrawal_limit: controlForm.daily_withdrawal_limit === '' ? null : Number(controlForm.daily_withdrawal_limit)
      });
      if (rpcError) throw rpcError;
      await refreshSelected();
    }, `Account status changed to ${status}.`);
  };

  const closeCustomer = () => {
    setSelected(null);
    setTransactions([]);
    setAuditLogs([]);
  };

  const statusBadge = (status) => {
    const value = status || 'active';
    const classes = value === 'active' ? 'bg-emerald-100 text-emerald-700'
      : value === 'frozen' ? 'bg-rose-100 text-rose-700'
      : 'bg-amber-100 text-amber-800';
    return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase ${classes}`}>{value}</span>;
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      {loading && <div className="fixed left-0 top-0 z-[1000] h-1 w-full animate-pulse bg-blue-600" />}
      <Navbar userType="Super Administrator" />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-700">FundFort Bank • Experimental</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">God Mode Control Centre</h1>
            <p className="mt-1 text-sm text-slate-500">Administrative tools for simulated customer accounts.</p>
          </div>
          <button onClick={() => run(fetchCustomers, 'Customer list refreshed.')}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold hover:bg-slate-50">
            Refresh data
          </button>
        </div>

        {(notice || error) && (
          <div className={`mb-5 rounded-lg border p-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
            {error || notice}
            <button className="float-right font-bold" onClick={() => { setError(''); setNotice(''); }}>×</button>
          </div>
        )}

        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['Total customers', totals.customers],
            ['Active accounts', totals.active],
            ['Frozen accounts', totals.frozen],
            ['Restricted accounts', totals.restricted]
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-black text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Customer directory</h2>
              <p className="text-xs text-slate-500">Select a customer to open their administrative workspace.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email or account ID"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-700 sm:w-72" />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="restricted">Restricted</option>
                <option value="frozen">Frozen</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="p-4">Customer</th><th className="p-4">Account ID</th>
                  <th className="p-4 text-right">Simulated balance</th><th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img src={customer.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer.full_name || 'Customer')}`}
                          alt="" className="h-10 w-10 rounded-full border object-cover" />
                        <div><p className="font-bold text-slate-800">{customer.full_name || 'Unnamed customer'}</p>
                          <p className="text-xs text-slate-400">{customer.email}</p></div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{customer.account_id || '—'}</td>
                    <td className="p-4 text-right font-bold">{money(customer.balance, customer.currency || 'USD')}</td>
                    <td className="p-4">{statusBadge(customer.account_status)}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => openCustomer(customer)}
                        className="rounded-lg bg-[#002147] px-4 py-2 text-xs font-bold text-white hover:bg-slate-700">
                        OPEN GOD MODE
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && <tr><td colSpan="5" className="p-10 text-center text-sm text-slate-400">No matching customers found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <p className="mt-4 text-xs text-slate-400">Demo environment only. All balances and ledger entries are simulated and must not represent real funds.</p>
      </main>

      {selected && (
        <div className="fixed inset-0 z-[500] overflow-y-auto bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6">
          <section className="mx-auto my-4 max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex flex-col gap-4 bg-[#002147] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <img src={selected.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selected.full_name || 'Customer')}`}
                  alt="" className="h-14 w-14 rounded-full border-2 border-white/30 object-cover" />
                <div><p className="text-xs font-bold uppercase tracking-widest text-blue-200">Individual account workspace</p>
                  <h2 className="text-xl font-black">{selected.full_name}</h2>
                  <p className="text-xs text-blue-100">{selected.account_id} · {selected.email}</p></div>
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(selected.account_status)}
                <button onClick={closeCustomer} className="text-3xl leading-none text-white/80 hover:text-white" aria-label="Close">×</button>
              </div>
            </header>

            <nav className="flex gap-1 overflow-x-auto border-b bg-slate-50 p-2">
              {[
                ['overview', 'Overview'], ['financials', 'Financials'], ['profile', 'Profile'],
                ['security', 'Security & limits'], ['transactions', 'Transactions'], ['audit', 'Audit trail']
              ].map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold ${tab === key ? 'bg-[#002147] text-white' : 'text-slate-500 hover:bg-white'}`}>
                  {label}
                </button>
              ))}
            </nav>

            <div className="max-h-[72vh] overflow-y-auto p-5 sm:p-7">
              {tab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ['Simulated balance', money(selected.balance, selected.currency || 'USD')],
                      ['Account type', selected.account_type || 'Standard'],
                      ['Account created', selected.created_at ? new Date(selected.created_at).toLocaleDateString() : '—'],
                      ['Account status', selected.account_status || 'active']
                    ].map(([label, value]) => <div key={label} className="rounded-xl border bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-400">{label}</p><p className="mt-2 break-words text-lg font-black text-slate-900">{value}</p>
                    </div>)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setTab('financials')} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white">CREDIT / DEBIT</button>
                    <button onClick={() => changeStatus('frozen')} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white">FREEZE ACCOUNT</button>
                    <button onClick={() => changeStatus('active')} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white">UNFREEZE / ACTIVATE</button>
                    <button onClick={() => setTab('profile')} className="rounded-lg border px-4 py-2 text-xs font-bold">EDIT PROFILE</button>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    This is a simulated account-control interface. Actions are recorded in the administrative audit trail.
                  </div>
                </div>
              )}

              {tab === 'financials' && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border p-5">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Current simulated balance</p>
                    <p className="my-3 text-3xl font-black text-slate-900">{money(selected.balance, selected.currency || 'USD')}</p>
                    <form onSubmit={adjustBalance} className="space-y-4">
                      <label className="block text-xs font-bold text-slate-600">Adjustment type
                        <select value={adjustment.type} onChange={e => setAdjustment({...adjustment, type: e.target.value})}
                          className="mt-1 w-full rounded-lg border p-3 text-sm">
                          <option value="credit">Credit (add to simulated balance)</option>
                          <option value="debit">Debit (subtract from simulated balance)</option>
                        </select>
                      </label>
                      <label className="block text-xs font-bold text-slate-600">Amount
                        <input type="number" min="0.01" step="0.01" required value={adjustment.amount}
                          onChange={e => setAdjustment({...adjustment, amount: e.target.value})}
                          className="mt-1 w-full rounded-lg border p-3 text-lg" placeholder="0.00" />
                      </label>
                      <label className="block text-xs font-bold text-slate-600">Description / reason
                        <input required value={adjustment.description} onChange={e => setAdjustment({...adjustment, description: e.target.value})}
                          className="mt-1 w-full rounded-lg border p-3 text-sm" placeholder="Demo adjustment reason" />
                      </label>
                      <label className="block text-xs font-bold text-slate-600">Reference (optional)
                        <input value={adjustment.reference} onChange={e => setAdjustment({...adjustment, reference: e.target.value})}
                          className="mt-1 w-full rounded-lg border p-3 text-sm" placeholder="Internal reference" />
                      </label>
                      <button disabled={loading} className="w-full rounded-lg bg-[#002147] p-3 text-sm font-bold text-white disabled:opacity-50">
                        {loading ? 'Processing…' : 'POST SIMULATED ADJUSTMENT'}
                      </button>
                    </form>
                  </div>
                  <div className="rounded-xl border p-5">
                    <h3 className="font-bold">Account controls snapshot</h3>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between gap-4"><dt className="text-slate-500">Withdrawals</dt><dd className="font-bold">{selected.withdraw_restricted ? 'Restricted' : 'Enabled'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-slate-500">Transfers</dt><dd className="font-bold">{selected.transfer_restricted ? 'Restricted' : 'Enabled'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-slate-500">Daily transfer limit</dt><dd className="font-bold">{selected.daily_transfer_limit ?? 'Not set'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-slate-500">Daily withdrawal limit</dt><dd className="font-bold">{selected.daily_withdrawal_limit ?? 'Not set'}</dd></div>
                    </dl>
                    <button onClick={() => setTab('security')} className="mt-6 rounded-lg border px-4 py-2 text-xs font-bold">MANAGE LIMITS & RESTRICTIONS</button>
                  </div>
                </div>
              )}

              {tab === 'profile' && (
                <form onSubmit={saveProfile} className="grid gap-4 md:grid-cols-2">
                  {[
                    ['full_name', 'Full name'], ['phone', 'Phone'], ['address', 'Address'],
                    ['avatar_url', 'Avatar image URL']
                  ].map(([key, label]) => <label key={key} className="text-xs font-bold text-slate-600">{label}
                    <input value={profileForm[key]} onChange={e => setProfileForm({...profileForm, [key]: e.target.value})}
                      className="mt-1 w-full rounded-lg border p-3 text-sm" />
                  </label>)}
                  <label className="text-xs font-bold text-slate-600">Account type
                    <select value={profileForm.account_type} onChange={e => setProfileForm({...profileForm, account_type: e.target.value})}
                      className="mt-1 w-full rounded-lg border p-3 text-sm">
                      {['Standard', 'Silver', 'Gold', 'Platinum', 'Private Banking'].map(x => <option key={x}>{x}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-bold text-slate-600">Currency
                    <select value={profileForm.currency} onChange={e => setProfileForm({...profileForm, currency: e.target.value})}
                      className="mt-1 w-full rounded-lg border p-3 text-sm">
                      {['USD', 'NGN', 'GBP', 'EUR', 'CAD', 'AUD'].map(x => <option key={x}>{x}</option>)}
                    </select>
                  </label>
                  <div className="md:col-span-2"><button disabled={loading} className="rounded-lg bg-[#002147] px-6 py-3 text-xs font-bold text-white">SAVE PROFILE CHANGES</button></div>
                </form>
              )}

              {tab === 'security' && (
                <form onSubmit={saveControls} className="grid gap-5 md:grid-cols-2">
                  <label className="text-xs font-bold text-slate-600">Account status
                    <select value={controlForm.account_status} onChange={e => setControlForm({...controlForm, account_status: e.target.value})}
                      className="mt-1 w-full rounded-lg border p-3 text-sm">
                      <option value="active">Active</option><option value="restricted">Restricted</option><option value="frozen">Frozen</option>
                    </select>
                  </label>
                  <div className="rounded-lg border p-4">
                    <label className="flex items-center justify-between gap-3 text-sm font-bold">Restrict withdrawals
                      <input type="checkbox" checked={controlForm.withdraw_restricted}
                        onChange={e => setControlForm({...controlForm, withdraw_restricted: e.target.checked})} />
                    </label>
                    <input value={controlForm.withdraw_reason} onChange={e => setControlForm({...controlForm, withdraw_reason: e.target.value})}
                      placeholder="Reason shown to the demo customer" className="mt-3 w-full rounded-lg border p-2 text-sm" />
                  </div>
                  <div className="rounded-lg border p-4">
                    <label className="flex items-center justify-between gap-3 text-sm font-bold">Restrict transfers
                      <input type="checkbox" checked={controlForm.transfer_restricted}
                        onChange={e => setControlForm({...controlForm, transfer_restricted: e.target.checked})} />
                    </label>
                    <input value={controlForm.transfer_reason} onChange={e => setControlForm({...controlForm, transfer_reason: e.target.value})}
                      placeholder="Reason shown to the demo customer" className="mt-3 w-full rounded-lg border p-2 text-sm" />
                  </div>
                  <label className="text-xs font-bold text-slate-600">Daily transfer limit
                    <input type="number" min="0" value={controlForm.daily_transfer_limit}
                      onChange={e => setControlForm({...controlForm, daily_transfer_limit: e.target.value})}
                      className="mt-1 w-full rounded-lg border p-3 text-sm" placeholder="Leave blank for no configured limit" />
                  </label>
                  <label className="text-xs font-bold text-slate-600">Daily withdrawal limit
                    <input type="number" min="0" value={controlForm.daily_withdrawal_limit}
                      onChange={e => setControlForm({...controlForm, daily_withdrawal_limit: e.target.value})}
                      className="mt-1 w-full rounded-lg border p-3 text-sm" placeholder="Leave blank for no configured limit" />
                  </label>
                  <div className="md:col-span-2"><button disabled={loading} className="rounded-lg bg-[#002147] px-6 py-3 text-xs font-bold text-white">SAVE SECURITY CONTROLS</button></div>
                </form>
              )}

              {tab === 'transactions' && (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                      <th className="p-3">Date</th><th className="p-3">Description</th><th className="p-3">Type</th>
                      <th className="p-3 text-right">Amount</th><th className="p-3">Status</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {transactions.map(tx => <tr key={tx.id}>
                        <td className="p-3 text-xs text-slate-500">{dateTime(tx.created_at)}</td>
                        <td className="p-3 font-semibold">{tx.description || '—'}</td>
                        <td className="p-3 capitalize">{tx.type || '—'}</td>
                        <td className="p-3 text-right font-bold">{money(tx.amount, selected.currency || 'USD')}</td>
                        <td className="p-3">{tx.status || '—'}</td>
                      </tr>)}
                      {transactions.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-slate-400">No ledger entries.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {tab === 'audit' && (
                <div className="space-y-3">
                  {auditLogs.map(log => <article key={log.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{log.action}</strong><span className="text-xs text-slate-400">{dateTime(log.created_at)}</span></div>
                    <p className="mt-1 text-xs text-slate-500">Administrator: {log.actor_id || '—'}</p>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-xs">{JSON.stringify(log.details || {}, null, 2)}</pre>
                  </article>)}
                  {auditLogs.length === 0 && <p className="rounded-lg border p-8 text-center text-sm text-slate-400">No audit records available for this customer yet.</p>}
                </div>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-slate-50 p-4">
              <span className="text-[11px] text-slate-400">Admin actions are permission-checked and audited by the database.</span>
              <button onClick={closeCustomer} className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-xs font-bold">CLOSE WORKSPACE</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
