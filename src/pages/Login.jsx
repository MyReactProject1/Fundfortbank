import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';

const isValidEmail = (value) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(value || '').trim());

export default function Login() {
  const [searchParams] = useSearchParams();
  const paramMode = searchParams.get('mode');
  const validModes = ['login', 'signup', 'verify-otp', 'complete-profile', 'forgot', 'reset-otp', 'force-reset'];
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

  // Essential Records (filled ONLY after OTP verification)
  const [profileForm, setProfileForm] = useState({
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
    // 1. Check if Admin
    const { data: admin } = await supabase
      .from('admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (admin) {
      navigate('/admin');
      return;
    }

    // 2. Enforce First-Time Password Reset (for Admin-created accounts)
    if (user?.user_metadata?.must_change_password) {
      setNewPassword('');
      setConfirmPassword('');
      setMode('force-reset');
      setNotice('Security requirement: Please replace your temporary password before continuing.');
      return;
    }

    // 3. Enforce Essential Records completion (after OTP)
    if (user?.user_metadata?.profile_completed === false) {
      setMode('complete-profile');
      setNotice('Email verified! Complete your essential account details to finish opening your account.');
      return;
    }

    navigate('/dashboard');
  };

  // 1. SIGN IN
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
        if (loginError.message.toLowerCase().includes('email not confirmed')) {
          setMode('verify-otp');
          setNotice('Account not verified yet. Enter the OTP sent to your email to continue.');
        } else {
          setError('Invalid email or password. Please try again.');
        }
        return;
      }

      await routeAfterAuth(authData.user);
    } catch (err) {
      setError(err.message || 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  };

  // 2. STEP 1 OF CREATE ACCOUNT: EMAIL + PASSWORD -> CHECK DUPLICATE -> SEND OTP
  const handleSignupStep1 = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!allowPublicSignup) {
      setPopup({
        title: 'Registration Locked',
        message: 'New account creation is currently locked by the administrator. Please contact support.'
      });
      return;
    }

    if (!checkEmailOrPopup(email)) return;
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error: signupError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            profile_completed: false,
            must_change_password: false
          }
        }
      });

      if (signupError) {
        const msg = signupError.message.toLowerCase();
        if (msg.includes('already') || msg.includes('registered')) {
          setPopup({
            title: 'Email Already Registered',
            message: 'This email address is already registered. Please sign in or reset your password.'
          });
          return;
        }
        if (msg.includes('invalid')) {
          setPopup({
            title: 'Invalid Email Address',
            message: 'The email address you entered is invalid.'
          });
          return;
        }
        throw signupError;
      }

      // CRITICAL: Supabase returns an empty identities array when the email is ALREADY registered
      if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
        setPopup({
          title: 'Email Already Registered',
          message: 'This email address is already registered. Please sign in or reset your password.'
        });
        return;
      }

      setOtp('');
      setMode('verify-otp');
      setNotice('An OTP has been sent to your email. Enter it below to proceed.');
    } catch (err) {
      setError(err.message || 'Could not start account creation.');
    } finally {
      setLoading(false);
    }
  };

  // 3. STEP 2: VERIFY OTP (ONLY WAY TO PROCEED)
  const handleVerifySignupOtp = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!checkEmailOrPopup(email)) return;

    setLoading(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'signup'
      });

      if (verifyError) throw verifyError;

      if (data?.user) {
        await routeAfterAuth(data.user);
      } else {
        setMode('login');
        setNotice('Email verified! Please sign in to continue.');
      }
    } catch (err) {
      setError('Invalid or expired OTP. You cannot proceed without a valid OTP.');
    } finally {
      setLoading(false);
    }
  };

  // RESEND OTP
  const handleResendOtp = async () => {
    clearMessages();
    if (!checkEmailOrPopup(email)) return;

    setLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase()
      });
      if (resendError) throw resendError;
      setNotice('A new OTP code has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Could not resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // 4. STEP 3: FILL ESSENTIAL RECORDS (AFTER OTP VERIFIED)
  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!profileForm.full_name.trim()) {
      setError('Full name is required.');
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMode('verify-otp');
        setError('Session expired. Please verify your OTP or sign in again.');
        return;
      }

      const { error: updateCustomerError } = await supabase
        .from('customers')
        .update({
          full_name: profileForm.full_name.trim(),
          phone: profileForm.phone.trim() || null,
          address: profileForm.address.trim() || null,
          account_type: profileForm.account_type,
          currency: profileForm.currency
        })
        .eq('id', session.user.id);

      if (updateCustomerError) throw updateCustomerError;

      const { error: metaError } = await supabase.auth.updateUser({
        data: {
          full_name: profileForm.full_name.trim(),
          profile_completed: true
        }
      });

      if (metaError) throw metaError;

      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Could not save your account details.');
    } finally {
      setLoading(false);
    }
  };

  // 5. FORCED FIRST-TIME PASSWORD RESET (ADMIN-CREATED ACCOUNTS)
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
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { must_change_password: false }
      });
      if (updateError) throw updateError;

      if (data?.user?.user_metadata?.profile_completed === false) {
        setMode('complete-profile');
        setNotice('Password updated! Now complete your essential account details.');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Could not update password.');
    } finally {
      setLoading(false);
    }
  };

  // 6. FORGOT / RESET PASSWORD (SEND RECOVERY OTP)
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
      setNotice('A password reset OTP has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Could not send reset code.');
    } finally {
      setLoading(false);
    }
  };

  // 7. VERIFY RECOVERY OTP & SET NEW PASSWORD
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

            <div className="mt-6 text-center space-y-2 text-xs text-slate-500">
              <p>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => { clearMessages(); setMode('signup'); }}
                  className="font-bold text-[#002147] hover:underline"
                >
                  Create Account
                </button>
              </p>
              <p>
                Have a verification OTP?{' '}
                <button
                  type="button"
                  onClick={() => { clearMessages(); setMode('verify-otp'); }}
                  className="font-bold text-[#002147] hover:underline"
                >
                  Verify OTP
                </button>
              </p>
            </div>
          </>
        )}

        {/* --- CREATE ACCOUNT STEP 1: EMAIL & PASSWORD ONLY --- */}
        {mode === 'signup' && (
          <>
            <span className="inline-block mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-700">
              Step 1 of 3 • Account Credentials
            </span>
            <h2 className="text-2xl font-semibold mb-2">Create Account</h2>
            {!allowPublicSignup ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 mb-4">
                🔒 Public account creation is currently locked by the administrator.
              </div>
            ) : (
              <p className="text-slate-500 text-sm mb-6">
                Enter your email and password. Next, you&apos;ll verify your email with an OTP.
              </p>
            )}

            <form onSubmit={handleSignupStep1} noValidate className="space-y-4">
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
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Password</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    disabled={!allowPublicSignup}
                    minLength={6}
                    value={password}
                    placeholder="Minimum 6 characters"
                    className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none disabled:bg-slate-100"
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
                disabled={loading || !allowPublicSignup}
                className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Sending OTP...' : 'Continue'}
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

        {/* --- STEP 2: VERIFY OTP --- */}
        {mode === 'verify-otp' && (
          <>
            <span className="inline-block mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-700">
              Step 2 of 3 • Email Verification
            </span>
            <h2 className="text-2xl font-semibold mb-2">Enter OTP Code</h2>
            <p className="text-slate-500 text-sm mb-6">
              Enter the verification code sent to your email. Your account will not be created until verified.
            </p>

            <form onSubmit={handleVerifySignupOtp} noValidate className="space-y-4">
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
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Verification Code (OTP)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={10}
                  value={otp}
                  placeholder="Enter OTP code"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-center font-mono text-lg tracking-[0.3em] focus:ring-2 focus:ring-[#002147] outline-none"
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <button
                disabled={loading}
                className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify OTP & Proceed'}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
              <button
                type="button"
                disabled={loading}
                onClick={handleResendOtp}
                className="font-bold text-[#002147] hover:underline"
              >
                Resend OTP
              </button>
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('login'); }}
                className="font-semibold hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          </>
        )}

        {/* --- STEP 3: FILL ESSENTIAL RECORDS (AFTER OTP VERIFIED) --- */}
        {mode === 'complete-profile' && (
          <>
            <span className="inline-block mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
              Step 3 of 3 • Essential Records
            </span>
            <h2 className="text-2xl font-semibold mb-2">Complete Your Profile</h2>
            <p className="text-slate-500 text-sm mb-6">
              Your email is verified. Fill in your essential records to activate your bank dashboard.
            </p>

            <form onSubmit={handleCompleteProfile} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={profileForm.full_name}
                  placeholder="Jane Doe"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none"
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={profileForm.phone}
                  placeholder="+234 800 000 0000"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none"
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Residential Address *</label>
                <input
                  type="text"
                  required
                  value={profileForm.address}
                  placeholder="Street, City, Country"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none"
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Account Type</label>
                  <select
                    value={profileForm.account_type}
                    onChange={(e) => setProfileForm({ ...profileForm, account_type: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none"
                  >
                    {['Standard', 'Silver', 'Gold', 'Platinum'].map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Currency</label>
                  <select
                    value={profileForm.currency}
                    onChange={(e) => setProfileForm({ ...profileForm, currency: e.target.value })}
                    className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none"
                  >
                    {['USD', 'NGN', 'GBP', 'EUR', 'CAD', 'AUD'].map(x => <option key={x}>{x}</option>)}
                  </select>
                </div>
              </div>
              <button
                disabled={loading}
                className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Activating Account...' : 'Finish & Open Dashboard'}
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
              Enter your registered email address and we&apos;ll send a reset OTP.
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
                {loading ? 'Sending code...' : 'Send Reset OTP'}
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
              Enter the OTP sent to <strong>{email}</strong> and choose your new password.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Reset OTP Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={10}
                  value={otp}
                  placeholder="Enter OTP code"
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
