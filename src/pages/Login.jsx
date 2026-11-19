import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';

const isValidEmail = (value) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(String(value || '').trim());

export default function Login() {
  const [searchParams] = useSearchParams();
  const paramMode = searchParams.get('mode');
  const initialMode = ['signup', 'force-reset', 'verify-otp'].includes(paramMode) ? paramMode : 'login';

  const [mode, setMode] = useState(initialMode); // 'login' | 'signup' | 'verify-otp' | 'forgot' | 'reset-otp' | 'force-reset'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const m = searchParams.get('mode');
    if (['signup', 'login', 'force-reset', 'verify-otp'].includes(m)) {
      setMode(m);
    }
  }, [searchParams]);

  const clearMessages = () => {
    setError('');
    setNotice('');
  };

  const validateEmailOrError = (value) => {
    if (!isValidEmail(value)) {
      setError('Invalid email address. Please enter a valid email (e.g., name@domain.com).');
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

    // 2. Enforce First-Time Password Reset for Admin-Created Accounts
    if (user?.user_metadata?.must_change_password) {
      setNewPassword('');
      setConfirmPassword('');
      setMode('force-reset');
      setNotice('Security requirement: Please replace your temporary password before accessing your account.');
      return;
    }

    navigate('/dashboard');
  };

  // 1. SIGN IN
  const handleLogin = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!validateEmailOrError(email)) return;

    setLoading(true);
    try {
      const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (loginError) {
        if (loginError.message.toLowerCase().includes('email not confirmed')) {
          setMode('verify-otp');
          setNotice('Account not activated. Enter the 6-digit OTP sent to your email to complete opening.');
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

  // 2. SELF-REGISTRATION (CREATE ACCOUNT)
  const handleSignup = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!validateEmailOrError(email)) return;
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { error: signupError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            must_change_password: false
          }
        }
      });

      if (signupError) throw signupError;

      setOtp('');
      setMode('verify-otp');
      setNotice('OTP sent! Your account will not be created until you submit the 6-digit code from your email.');
    } catch (err) {
      setError(err.message || 'Could not create account.');
    } finally {
      setLoading(false);
    }
  };

  // 3. VERIFY SIGNUP / ADMIN-CREATED ACCOUNT OTP
  const handleVerifySignupOtp = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!validateEmailOrError(email)) return;

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
        setNotice('Email verified! You can now sign in.');
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP code. Account opening cannot continue without a valid OTP.');
    } finally {
      setLoading(false);
    }
  };

  // RESEND SIGNUP OTP
  const handleResendOtp = async () => {
    clearMessages();
    if (!validateEmailOrError(email)) return;

    setLoading(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase()
      });
      if (resendError) throw resendError;
      setNotice('A new 6-digit verification code has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Could not resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  // 4. FORCED FIRST-TIME PASSWORD RESET (ADMIN-CREATED ACCOUNTS)
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

  // 5. FORGOT PASSWORD (SEND RECOVERY OTP)
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    clearMessages();
    if (!validateEmailOrError(email)) return;

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase()
      );
      if (resetError) throw resetError;

      setOtp('');
      setNewPassword('');
      setMode('reset-otp');
      setNotice('A 6-digit password reset code has been sent to your email.');
    } catch (err) {
      setError(err.message || 'Could not send reset code.');
    } finally {
      setLoading(false);
    }
  };

  // 6. VERIFY RECOVERY OTP & SET NEW PASSWORD
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
      setNotice('Password updated successfully! Sign in with your new password.');
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
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none transition-all"
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
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    value={password}
                    placeholder="Enter your password"
                    className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none transition-all"
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
                className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-blue-900/10 disabled:opacity-50"
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
                Have an activation OTP?{' '}
                <button
                  type="button"
                  onClick={() => { clearMessages(); setMode('verify-otp'); }}
                  className="font-bold text-[#002147] hover:underline"
                >
                  Verify Account
                </button>
              </p>
            </div>
          </>
        )}

        {/* --- CREATE ACCOUNT VIEW --- */}
        {mode === 'signup' && (
          <>
            <h2 className="text-2xl font-semibold mb-2">Open an account</h2>
            <p className="text-slate-500 text-sm mb-6">Create your FundFort Bank account in seconds.</p>

            <form onSubmit={handleSignup} noValidate className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  placeholder="Jane Doe"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none transition-all"
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  placeholder="name@email.com"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none transition-all"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Password</label>
                <div className="relative">
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    placeholder="Minimum 6 characters"
                    className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none transition-all"
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
                className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-blue-900/10 disabled:opacity-50"
              >
                {loading ? 'Creating account...' : 'Create Account'}
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

        {/* --- VERIFY SIGNUP OTP VIEW --- */}
        {mode === 'verify-otp' && (
          <>
            <h2 className="text-2xl font-semibold mb-2">Verify your email</h2>
            <p className="text-slate-500 text-sm mb-6">
              Enter the 6-digit OTP sent to your email. Account creation will not complete without it.
            </p>

            <form onSubmit={handleVerifySignupOtp} noValidate className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  placeholder="name@email.com"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none transition-all"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">6-Digit OTP Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={otp}
                  placeholder="123456"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-center font-mono text-lg tracking-[0.4em] focus:ring-2 focus:ring-[#002147] outline-none transition-all"
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>
              <button
                disabled={loading}
                className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Complete Opening'}
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

        {/* --- FORCED FIRST-TIME PASSWORD RESET VIEW --- */}
        {mode === 'force-reset' && (
          <>
            <span className="inline-block mb-3 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
              First-Time Login Security
            </span>
            <h2 className="text-2xl font-semibold mb-2">Reset Your Password</h2>
            <p className="text-slate-500 text-sm mb-6">
              You signed in with a temporary password. Create your own secure password to continue to your dashboard.
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
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none transition-all"
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
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none transition-all"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button
                disabled={loading}
                className="w-full bg-[#002147] text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Saving Password...' : 'Save Password & Enter Dashboard'}
              </button>
            </form>
          </>
        )}

        {/* --- FORGOT PASSWORD VIEW --- */}
        {mode === 'forgot' && (
          <>
            <h2 className="text-2xl font-semibold mb-2">Forgot password</h2>
            <p className="text-slate-500 text-sm mb-6">
              Enter your email address and we&apos;ll send a 6-digit reset code.
            </p>

            <form onSubmit={handleForgotPassword} noValidate className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  placeholder="name@email.com"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none transition-all"
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
            <h2 className="text-2xl font-semibold mb-2">Set new password</h2>
            <p className="text-slate-500 text-sm mb-6">
              Enter the 6-digit code sent to <strong>{email}</strong> and choose a new password.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5 ml-1">6-Digit Reset Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  value={otp}
                  placeholder="123456"
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-center font-mono text-lg tracking-[0.4em] focus:ring-2 focus:ring-[#002147] outline-none transition-all"
                  onChange={(e) => setOtp(e.target.value)}
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
                  className="w-full border border-slate-200 p-3.5 rounded-xl text-sm focus:ring-2 focus:ring-[#002147] outline-none transition-all"
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
    </div>
  );
}
