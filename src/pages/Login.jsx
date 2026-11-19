import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';

const isValidEmail = (value) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(value || '').trim());

export default function Login() {
  const [searchParams] = useSearchParams();
  const paramMode = searchParams.get('mode');
  const validModes = ['login', 'signup', 'verify-otp', 'complete-signup', 'forgot', 'reset-otp', 'force-reset'];
  const initialMode = validModes.includes(paramMode) ? paramMode : 'login';

  const [mode, setMode] = useState(initialMode);
  const [allowPublicSignup, setAllowPublicSignup] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [popup, setPopup] = useState(null); // { title, message }

  // Step 3: Password + Essential Records (filled ONLY after OTP is verified)
  const [signupForm, setSignupForm] = useState({
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
    address: '',
    account_type: 'Standard',
    currency: 'USD'
  });

  const navigate = useNavigate();

  useEffect(() => {
    const m = searchParams.get('mode');
    if (validModes.includes(m)) setMode(m);
  }, [searchParams]);

  // Check if Admin has locked public account creation
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'allow_public_signup')
        .maybeSingle();
      if (data && data.value === false) {
        setAllowPublicSignup(false);
      }
    })();
  }, []);

  const clearMessages = () => {
    setError('');
    setNotice('');
  };

  const checkEmailOrPopup = (value) => {
    if (!isValidEmail(value)) {
      setPopup({
        title: 'Invalid Email Address',
        message: 'The email address you entered is invalid. Please enter a real, valid email address to continue.'
      });
      return false;
    }
    return true;
  };

  const routeAfterAuth = async (user) => {
    const { data: admin } = await supabase
      .from('admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (admin) {
      navigate('/admin');
      return;
    }

    if (user?.user_metadata?.must_change_password) {
      setNewPassword('');
      setConfirmPassword('');
      setMode('force-reset');
      setNotice('Security requirement: Please replace your temporary password before continuing.');
      return;
    }

    navigate('/dashboard');
  };

  // --- SIGN IN ---
  const handleLogin = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!checkEmailOrPopup(email)) return;

    setLoading(true);
    try {
      const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (loginError) {
        setError('Invalid email or password. Please try again.');
        return;
      }

      await routeAfterAuth(authData.user);
    } catch (err) {
      setError(err.message || 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 1: ENTER EMAIL ONLY -> SEND 5-DIGIT OTP (NOTHING STORED IN AUTH/CUSTOMERS) ---
  const handleSendSignupOtp = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!allowPublicSignup) {
      setPopup({
        title: 'Registration Locked',
        message: 'New account creation is currently locked by the administrator.'
      });
      return;
    }

    if (!checkEmailOrPopup(email)) return;

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('auth-otp-signup', {
        body: {
          action: 'send_otp',
          email: email.trim().toLowerCase()
        }
      });

      if (fnError) {
        // Parse edge function error body if available
        let errMsg = fnError.message;
        try {
          const parsed = await fnError.context?.json();
          if (parsed?.error === 'ALREADY_REGISTERED') {
            setPopup({
              title: 'Email Already Registered',
              message: 'This email address is already registered. Please sign in or reset your password.'
            });
            return;
          }
          if (parsed?.error === 'INVALID_EMAIL') {
            setPopup({
              title: 'Invalid Email Address',
              message: 'The email address you entered is invalid.'
            });
            return;
          }
          if (parsed?.message) errMsg = parsed.message;
        } catch (_) {}
        throw new Error(errMsg);
      }

      if (data?.error === 'ALREADY_REGISTERED') {
        setPopup({
          title: 'Email Already Registered',
          message: 'This email address is already registered. Please sign in or reset your password.'
        });
        return;
      }

      if (!data?.success) {
        throw new Error(data?.message || 'Could not send OTP.');
      }

      setOtp('');
      setMode('verify-otp');
      setNotice('A 5-digit OTP has been sent to your email. Enter it below to continue.');
    } catch (err) {
      setError(err.message || 'Could not send OTP.');
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 2: VERIFY 5-DIGIT OTP ---
  const handleVerifySignupOtp = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!checkEmailOrPopup(email)) return;

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('auth-otp-signup', {
        body: {
          action: 'verify_otp',
          email: email.trim().toLowerCase(),
          otp: otp.trim()
        }
      });

      if (fnError) {
        let errMsg = 'Invalid or expired OTP code.';
        try {
          const parsed = await fnError.context?.json();
          if (parsed?.message) errMsg = parsed.message;
        } catch (_) {}
        throw new Error(errMsg);
      }

      if (!data?.verified) {
        throw new Error(data?.message || 'Invalid OTP code.');
      }

      setMode('complete-signup');
      setNotice('Email verified! Now create your password and complete your account details.');
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 3: SET PASSWORD & ESSENTIAL RECORDS -> CREATE REAL ACCOUNT ---
  const handleCompleteSignup = async (e) => {
    e.preventDefault();
    clearMessages();

    if (signupForm.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (signupForm.password !== signupForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!signupForm.full_name.trim()) {
      setError('Full name is required.');
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error: fnError } = await supabase.functions.invoke('auth-otp-signup', {
        body: {
          action: 'complete_signup',
          email: cleanEmail,
          password: signupForm.password,
          full_name: signupForm.full_name.trim(),
          phone: signupForm.phone.trim(),
          address: signupForm.address.trim(),
          account_type: signupForm.account_type,
          currency: signupForm.currency
        }
      });

      if (fnError) {
        let errMsg = 'Could not complete registration.';
        try {
          const parsed = await fnError.context?.json();
          if (parsed?.error === 'OTP_REQUIRED') {
            setMode('verify-otp');
            setError('Your email verification expired. Please verify your OTP again.');
            return;
          }
          if (parsed?.message) errMsg = parsed.message;
        } catch (_) {}
        throw new Error(errMsg);
      }

      if (!data?.success) {
        throw new Error(data?.message || 'Could not create account.');
      }

      // Automatically sign the user into their brand-new account
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: signupForm.password
      });

      if (signInError) {
        setMode('login');
        setNotice('Account created! Please sign in with your new password.');
        return;
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Could not complete account creation.');
    } finally {
      setLoading(false);
    }
  };

  // --- FORCED FIRST-TIME PASSWORD RESET (ADMIN-CREATED ACCOUNTS) ---
  const handleForceResetPassword = async (e) => {
    e.preventDefault();
    clearMessages();
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false }
      });
      if (updateError) throw updateError;
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Could not update password.');
    } finally {
      setLoading(false);
    }
  };

  // --- FORGOT / RESET PASSWORD ---
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!checkEmailOrPopup(email)) return;

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase()
      );
      if (resetError) throw resetError;

      setOtp('');
      setNewPassword('');
      setMode('reset-otp');
      setNotice('A password reset code has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Could not send reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    clearMessages();
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'recovery'
      });
      if (verifyError) throw verifyError;

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false }
      });
      if (updateError) throw updateError;

      await supabase.auth.signOut();
      setPassword('');
      setMode('login');
      setNotice('Password updated! Sign in with your new password.');
    } catch (err) {
      setError(err.message || 'Invalid code or could not update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <Link to="/" className="flex items-center gap-2 mb-8">
        <div className="bg-[#002147] text-white p-1.5 rounded-lg font-bold text-xl">FF</div>
        <span className="text-2xl font-bold text-[#002147] tracking-tight">FundFort Bank</span>
      </Link>

      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        {error && (
          <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
            ⚠️ {error}
          </div>
        )}
        {notice && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-700">
            {notice}
          </div>
        )}

        {/* --- SIGN IN VIEW --- */}
        {mode === 'login' && (
          <>
            <h2 className="text-2xl font-semibold mb-2">Welcome back</h2>
            <p className="text-slate-500 text-sm mb-6">Please enter your details to sign in.</p>

            <form onSubmit={handleLogin} noValidate className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  placeholder="name@email.com"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <label className="text-xs font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => { clearMessages(); setMode('forgot'); }}
                    className="text-xs font-semibold text-[#002147] hover:underline"
                  >
                    Reset password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    value={password}
                    placeholder="Enter your password"
                    className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className="absolute right-4 top-4 text-xs font-bold text-slate-400"
                  >
                    {show ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <button
                disabled={loading}
                className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('signup'); }}
                className="font-bold text-[#002147] hover:underline"
              >
                Create Account
              </button>
            </p>
          </>
        )}

        {/* --- STEP 1: ENTER EMAIL ONLY -> SEND 5-DIGIT OTP --- */}
        {mode === 'signup' && (
          <>
            <span className="inline-block mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-700">
              Step 1 of 3 • Email Verification
            </span>
            <h2 className="text-2xl font-semibold mb-2">Create Account</h2>
            {!allowPublicSignup ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 mb-4">
                🔒 Public account creation is currently locked by the administrator.
              </div>
            ) : (
              <p className="text-slate-500 text-sm mb-6">
                Enter your email address. We&apos;ll send a 5-digit OTP to verify your email before creating your account.
              </p>
            )}

            <form onSubmit={handleSendSignupOtp} noValidate className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Email Address</label>
                <input
                  type="email"
                  required
                  disabled={!allowPublicSignup}
                  value={email}
                  placeholder="name@email.com"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none disabled:bg-slate-100"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button
                disabled={loading || !allowPublicSignup}
                className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Sending 5-Digit OTP...' : 'Continue'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('login'); }}
                className="font-bold text-[#002147] hover:underline"
              >
                Sign In
              </button>
            </p>
          </>
        )}

        {/* --- STEP 2: VERIFY 5-DIGIT OTP --- */}
        {mode === 'verify-otp' && (
          <>
            <span className="inline-block mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-700">
              Step 2 of 3 • Enter 5-Digit OTP
            </span>
            <h2 className="text-2xl font-semibold mb-2">Verify Your Email</h2>
            <p className="text-slate-500 text-sm mb-6">
              Enter the 5-digit code sent to <strong>{email}</strong>.
            </p>

            <form onSubmit={handleVerifySignupOtp} noValidate className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">5-Digit OTP Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={5}
                  value={otp}
                  placeholder="12345"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-center font-mono text-2xl tracking-[0.5em] focus:ring-2 focus:ring-[#002147] outline-none"
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <button
                disabled={loading || otp.length < 5}
                className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify OTP & Continue'}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
              <button
                type="button"
                disabled={loading}
                onClick={handleSendSignupOtp}
                className="font-bold text-[#002147] hover:underline"
              >
                Resend 5-Digit OTP
              </button>
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('signup'); }}
                className="font-semibold hover:underline"
              >
                Change Email
              </button>
            </div>
          </>
        )}

        {/* --- STEP 3: SET PASSWORD & ESSENTIAL RECORDS (ONLY AFTER OTP VERIFIED) --- */}
        {mode === 'complete-signup' && (
          <>
            <span className="inline-block mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
              Step 3 of 3 • Complete Account
            </span>
            <h2 className="text-2xl font-semibold mb-2">Set Password &amp; Details</h2>
            <p className="text-slate-500 text-sm mb-5">
              Verified email: <strong>{email}</strong>
            </p>

            <form onSubmit={handleCompleteSignup} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1 ml-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={signupForm.full_name}
                  placeholder="Jane Doe"
                  className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#002147]"
                  onChange={(e) => setSignupForm({ ...signupForm, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1 ml-1">Create Password *</label>
                <input
                  type={show ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={signupForm.password}
                  placeholder="Minimum 6 characters"
                  className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#002147]"
                  onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1 ml-1">Confirm Password *</label>
                <input
                  type={show ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={signupForm.confirmPassword}
                  placeholder="Re-enter password"
                  className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#002147]"
                  onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1 ml-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={signupForm.phone}
                  placeholder="+234 800 000 0000"
                  className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#002147]"
                  onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1 ml-1">Residential Address *</label>
                <input
                  type="text"
                  required
                  value={signupForm.address}
                  placeholder="Street, City, Country"
                  className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#002147]"
                  onChange={(e) => setSignupForm({ ...signupForm, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1 ml-1">Account Type</label>
                  <select
                    value={signupForm.account_type}
                    onChange={(e) => setSignupForm({ ...signupForm, account_type: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none"
                  >
                    {['Standard', 'Silver', 'Gold', 'Platinum'].map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1 ml-1">Currency</label>
                  <select
                    value={signupForm.currency}
                    onChange={(e) => setSignupForm({ ...signupForm, currency: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none"
                  >
                    {['USD', 'NGN', 'GBP', 'EUR', 'CAD', 'AUD'].map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
              </div>
              <button
                disabled={loading}
                className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50 mt-2"
              >
                {loading ? 'Creating Account...' : 'Create Account & Open Dashboard'}
              </button>
            </form>
          </>
        )}

        {/* --- FORCED FIRST-TIME PASSWORD RESET VIEW --- */}
        {mode === 'force-reset' && (
          <>
            <span className="inline-block mb-3 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
              First-Time Login Security
            </span>
            <h2 className="text-2xl font-semibold mb-2">Reset Your Password</h2>
            <p className="text-slate-500 text-sm mb-6">
              You signed in with a temporary password. Create your own secure password to continue.
            </p>

            <form onSubmit={handleForceResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">New Password</label>
                <input
                  type={show ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  placeholder="Minimum 6 characters"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none"
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Confirm New Password</label>
                <input
                  type={show ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  placeholder="Re-enter new password"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button
                disabled={loading}
                className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Saving Password...' : 'Save Password & Continue'}
              </button>
            </form>
          </>
        )}

        {/* --- FORGOT / RESET PASSWORD VIEW --- */}
        {mode === 'forgot' && (
          <>
            <h2 className="text-2xl font-semibold mb-2">Reset Password</h2>
            <p className="text-slate-500 text-sm mb-6">
              Enter your registered email address and we&apos;ll send a reset code.
            </p>

            <form onSubmit={handleForgotPassword} noValidate className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  placeholder="name@email.com"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button
                disabled={loading}
                className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Sending code...' : 'Send Reset Code'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('login'); }}
                className="font-bold text-[#002147] hover:underline"
              >
                Back to Sign In
              </button>
            </p>
          </>
        )}

        {/* --- RESET PASSWORD WITH OTP VIEW --- */}
        {mode === 'reset-otp' && (
          <>
            <h2 className="text-2xl font-semibold mb-2">Set New Password</h2>
            <p className="text-slate-500 text-sm mb-6">
              Enter the code sent to <strong>{email}</strong> and choose your new password.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Reset Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={10}
                  value={otp}
                  placeholder="Enter reset code"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-center font-mono text-lg tracking-[0.3em] focus:ring-2 focus:ring-[#002147] outline-none"
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">New Password</label>
                <input
                  type={show ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  placeholder="Minimum 6 characters"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none"
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <button
                disabled={loading}
                className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Updating password...' : 'Reset Password'}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-slate-500">
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('login'); }}
                className="font-bold text-[#002147] hover:underline"
              >
                Back to Sign In
              </button>
            </p>
          </>
        )}
      </div>

      <p className="mt-8 text-xs text-slate-400">Protected by industry-standard 256-bit encryption.</p>

      {/* --- POPUP MODAL (INVALID EMAIL / ALREADY REGISTERED / REGISTRATION LOCKED) --- */}
      {popup && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-900/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-2xl font-bold text-rose-600">
              !
            </div>
            <h3 className="text-lg font-bold text-slate-900">{popup.title}</h3>
            <p className="mt-2 text-sm text-slate-500">{popup.message}</p>
            <button
              onClick={() => setPopup(null)}
              className="mt-6 w-full rounded-xl bg-[#002147] py-3.5 text-sm font-bold text-white hover:bg-slate-800"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
