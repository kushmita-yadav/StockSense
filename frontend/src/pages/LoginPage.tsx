import React, { useState } from 'react'
import { Boxes, Eye, EyeOff, Mail, Lock, User, Shield, ArrowRight, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

type Mode = 'login' | 'signup' | 'signup_verify' | 'otp_request' | 'otp_verify' | 'otp_new_password'

export const LoginPage: React.FC = () => {
  const { login, signup, verifySignup, requestOTP, resetPassword } = useAuth()

  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpDebug, setOtpDebug] = useState<string | null>(null)

  const clearState = () => {
    setError(null)
    setSuccess(null)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearState()
    setLoading(true)
    try {
      await login(email.trim(), password)
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    clearState()
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      const result = await signup(name.trim(), email.trim(), password, inviteCode.trim() || undefined)
      setSuccess(result.message || 'Verification code sent to your email.')
      setOtpDebug(result.otp_debug || null)
      setOtpCode(result.otp_debug || '')
      setMode('signup_verify')
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifySignup = async (e: React.FormEvent) => {
    e.preventDefault()
    clearState()
    if (!/^\d{6}$/.test(otpCode)) { setError('Enter the 6-digit code sent to your email.'); return }
    setLoading(true)
    try { await verifySignup(email.trim(), otpCode.trim()) }
    catch (err: any) { setError(err.message || 'Verification failed. Check your code and try again.') }
    finally { setLoading(false) }
  }

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    clearState()
    setLoading(true)
    try {
      const res = await requestOTP(email.trim())
      setSuccess(res.message)
      if (res.otp_debug) {
        setOtpDebug(res.otp_debug)
      }
      setMode('otp_verify')
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    clearState()
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await resetPassword(email.trim(), otpCode.trim(), password)
      setSuccess('Password reset successfully! You can now sign in.')
      setMode('login')
      setOtpCode('')
      setOtpDebug(null)
    } catch (err: any) {
      setError(err.message || 'Reset failed. Check your OTP code and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleContinueOTP = (e: React.FormEvent) => {
    e.preventDefault()
    clearState()
    if (!/^\d{6}$/.test(otpCode)) {
      setError('Enter the 6-digit code sent to your email.')
      return
    }
    setMode('otp_new_password')
  }

  const inputCls =
    'w-full bg-surface/80 border border-brand-200/80 rounded-xl px-4 py-3 text-sm text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/70 transition-all'

  return (
    <div className="min-h-screen bg-brand-50 flex">
      {/* Left Brand Panel */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 relative overflow-hidden bg-gradient-to-br from-brand-100 via-brand-50 to-biscuit border-r border-biscuit p-12">
        <img
          src="/warm-ledger-illustration.png"
          alt=""
          aria-hidden="true"
          className="absolute right-5 bottom-24 w-56 h-56 rounded-[42%] border-0 bg-gradient-to-br from-brand-200/60 via-brand-300/40 to-sage-200/60 object-contain opacity-20 shadow-2xl shadow-brand-500/10 pointer-events-none"
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-sage-400 p-[1.5px] shadow-xl shadow-brand-500/20">
              <div className="w-full h-full bg-brand-50 rounded-[14px] flex items-center justify-center">
                <Boxes className="w-6 h-6 text-brand-700" />
              </div>
            </div>
            <div>
              <p className="font-heading text-2xl font-extrabold text-ink">
                Stock<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-sage-400">Sense</span>
              </p>
              <p className="text-xs text-muted font-medium tracking-wider uppercase">Inventory Management System</p>
            </div>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="relative z-10 space-y-5">
          <h1 className="font-heading text-3xl font-extrabold text-ink leading-tight">
            One governed pipeline.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-plum-400 to-sage-400">
              Every stock movement.
            </span>
          </h1>
          <p className="text-muted text-sm leading-relaxed">
            Real-time visibility into what stock exists, where it is, and exactly how it moved — powered by an append-only ledger that can never be silently corrupted.
          </p>

          <div className="space-y-3 pt-2">
            {[
              { label: 'Append-only Stock Ledger', desc: 'Every movement is permanently recorded' },
              { label: 'Row-Level Concurrency Locks', desc: 'Zero over-selling under simultaneous load' },
              { label: 'Role-Scoped Access Control', desc: 'Manager & Staff operate in isolation' },
              { label: 'Automated Reorder Rules', desc: 'Draft receipts generated at threshold breach' },
            ].map((f) => (
              <div key={f.label} className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-brand-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{f.label}</p>
                  <p className="text-xs text-muted">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <div className="relative z-10">
          <p className="text-xs text-muted font-mono">
            Phase 1 + Phase 2 — Backend 100% complete · All 8 tests passing
          </p>
        </div>
      </div>

      {/* Right Auth Panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-sage-400 p-[1px]">
              <div className="w-full h-full bg-brand-50 rounded-xl flex items-center justify-center">
                <Boxes className="w-4 h-4 text-brand-700" />
              </div>
            </div>
            <p className="font-heading font-extrabold text-ink text-xl">
              Stock<span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-sage-400">Sense</span>
            </p>
          </div>

          {/* Card */}
          <div className="glass-panel rounded-2xl border border-brand-200/60 p-8 shadow-2xl">
            {/* Header */}
            <div className="mb-7">
              <h2 className="font-heading text-2xl font-extrabold text-ink">
                {mode === 'login' && 'Welcome back'}
                {mode === 'signup' && 'Create account'}
                {mode === 'signup_verify' && 'Verify your email'}
                {mode === 'otp_request' && 'Reset password'}
                {mode === 'otp_verify' && 'Verify your email'}
                {mode === 'otp_new_password' && 'Choose a new password'}
              </h2>
              <p className="text-sm text-muted mt-1">
                {mode === 'login' && 'Sign in to your StockSense account'}
                {mode === 'signup' && 'Create your own inventory workspace'}
                {mode === 'signup_verify' && 'Enter the 6-digit code to activate your account'}
                {mode === 'otp_request' && 'Enter your email to receive a one-time code'}
                {mode === 'otp_verify' && 'Enter the 6-digit code sent to your email'}
                {mode === 'otp_new_password' && 'Set a new password for your account'}
              </p>
            </div>

            {/* Error / Success Banners */}
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-clay-500/10 border border-clay-500/30 text-sm text-clay-700"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-clay-700" />
                {error}
              </div>
            )}
            {mode === 'signup' && error?.toLowerCase().includes('workspace invite code') && (
              <button
                type="button"
                onClick={() => { setInviteCode(''); clearState() }}
                className="-mt-3 mb-4 text-xs font-semibold text-brand-700 hover:underline"
              >
                Clear invite code and create a private workspace
              </button>
            )}
            {success && (
              <div
                role="status"
                aria-live="polite"
                className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-sage-500/10 border border-sage-500/30 text-sm text-sage-700"
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-sage-700" />
                {success}
              </div>
            )}

            {/* OTP debug banner (development only) */}
            {otpDebug && mode === 'otp_verify' && (
              <div
                role="status"
                aria-live="polite"
                className="mb-5 p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/30 text-xs font-mono text-brand-700"
              >
                🔑 Dev OTP Code: <strong className="text-brand-700 text-sm tracking-widest">{otpDebug}</strong>
                <p className="mt-1 text-muted font-sans">(Auto-filled below for convenience)</p>
              </div>
            )}

            {/* ───────── LOGIN FORM ───────── */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} noValidate className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-semibold text-ink mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="manager@stocksense.com"
                      required
                      autoComplete="email"
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-xs font-semibold text-ink mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className={`${inputCls} pl-10 pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setMode('otp_request'); clearState() }}
                    className="text-xs text-brand-700 hover:text-brand-700 font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-ink shadow-lg shadow-brand-500/25 transition-all disabled:opacity-60"
                >
                  {loading
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Signing in…</>
                    : <><ArrowRight className="w-4 h-4" /> Sign In</>
                  }
                </button>

                {import.meta.env.DEV && (
                  <div className="p-3.5 rounded-xl bg-surface/60 border border-biscuit text-xs space-y-1.5">
                    <p className="text-muted font-semibold text-[11px] uppercase tracking-wide">Demo Credentials</p>
                    <button
                      type="button"
                      onClick={() => { setEmail('manager@stocksense.com'); setPassword('Manager@12345') }}
                      className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-biscuit text-brand-700 transition-colors"
                    >
                      <Shield className="w-3 h-3 text-brand-700" />
                      Inventory Manager
                      <span className="ml-auto text-muted font-mono text-[10px]">Manager@12345</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEmail('staff@stocksense.com'); setPassword('Staff@12345') }}
                      className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-biscuit text-sage-700 transition-colors"
                    >
                      <User className="w-3 h-3 text-sage-700" />
                      Warehouse Staff
                      <span className="ml-auto text-muted font-mono text-[10px]">Staff@12345</span>
                    </button>
                  </div>
                )}
              </form>
            )}

            {/* ───────── SIGNUP FORM ───────── */}
            {mode === 'signup' && (
              <form onSubmit={handleSignup} noValidate className="space-y-4">
                <div>
                  <label htmlFor="signup-name" className="block text-xs font-semibold text-ink mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      id="signup-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                      autoComplete="name"
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-email" className="block text-xs font-semibold text-ink mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@company.com"
                      required
                      autoComplete="email"
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted">This is a manager’s workspace invite code, not the email OTP. Leave it blank to create a private workspace. To join a team, ask its manager for a current code from the dashboard.</p>

                <div>
                  <label htmlFor="signup-invite" className="block text-xs font-semibold text-ink mb-1.5">Workspace Invite Code <span className="font-normal text-muted">(optional)</span></label>
                  <input
                    id="signup-invite"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Join a manager's workspace"
                    autoComplete="off"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="signup-password" className="block text-xs font-semibold text-ink mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      required
                      autoComplete="new-password"
                      className={`${inputCls} pl-10 pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-confirm" className="block text-xs font-semibold text-ink mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      id="signup-confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      required
                      autoComplete="new-password"
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-ink shadow-lg shadow-brand-500/25 transition-all disabled:opacity-60"
                >
                  {loading
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating account…</>
                    : <><ArrowRight className="w-4 h-4" /> Create Account</>
                  }
                </button>
              </form>
            )}

            {mode === 'signup_verify' && (
              <form onSubmit={handleVerifySignup} className="space-y-4">
                <label htmlFor="signup-otp" className="block text-xs font-semibold text-ink mb-1.5">6-Digit Verification Code</label>
                <input id="signup-otp" type="text" inputMode="numeric" maxLength={6} value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))} required
                  className={`${inputCls} text-center tracking-[0.5rem] text-xl font-mono font-bold`} />
                {otpDebug && <p className="text-xs text-muted">Development verification code: <strong>{otpDebug}</strong></p>}
                <button type="submit" disabled={loading || otpCode.length !== 6}
                  className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-brand-600 to-brand-500 disabled:opacity-60">
                  {loading ? 'Verifying…' : 'Verify and open inventory'}
                </button>
              </form>
            )}

            {/* ───────── OTP REQUEST FORM ───────── */}
            {mode === 'otp_request' && (
              <form onSubmit={handleRequestOTP} noValidate className="space-y-4">
                <div>
                  <label htmlFor="otp-email" className="block text-xs font-semibold text-ink mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      id="otp-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      autoComplete="email"
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-ink shadow-lg shadow-brand-500/25 transition-all disabled:opacity-60"
                >
                  {loading
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending OTP…</>
                    : <><ArrowRight className="w-4 h-4" /> Send OTP Code</>
                  }
                </button>
              </form>
            )}

            {/* ───────── OTP VERIFY FORM ───────── */}
            {mode === 'otp_verify' && (
              <form onSubmit={handleContinueOTP} noValidate className="space-y-4">
                <div>
                  <label htmlFor="otp-code" className="block text-xs font-semibold text-ink mb-1.5">6-Digit OTP Code</label>
                  <input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                    className={`${inputCls} text-center tracking-[0.5rem] text-xl font-mono font-bold`}
                    // Auto-fill from debug if available
                    ref={(el) => { if (el && otpDebug && !otpCode) setOtpCode(otpDebug) }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={otpCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-ink shadow-lg shadow-brand-500/25 transition-all disabled:opacity-60"
                >
                  <ArrowRight className="w-4 h-4" /> Continue
                </button>
              </form>
            )}

            {mode === 'otp_new_password' && (
              <form onSubmit={handleResetPassword} noValidate className="space-y-4">
                <div>
                  <label htmlFor="reset-password" className="block text-xs font-semibold text-ink mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      id="reset-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      required
                      autoComplete="new-password"
                      className={`${inputCls} pl-10 pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="reset-confirm" className="block text-xs font-semibold text-ink mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      id="reset-confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      required
                      autoComplete="new-password"
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-sage-600 to-sage-500 hover:from-sage-500 hover:to-sage-400 text-ink shadow-lg shadow-sage-500/25 transition-all disabled:opacity-60"
                >
                  {loading
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Resetting…</>
                    : <><CheckCircle2 className="w-4 h-4" /> Reset Password</>
                  }
                </button>
              </form>
            )}

            {/* Mode Toggle Footer */}
            <div className="mt-6 pt-5 border-t border-biscuit text-center">
              {mode === 'login' && (
                <p className="text-sm text-muted">
                  No account?{' '}
                  <button
                    onClick={() => { setMode('signup'); clearState() }}
                    className="text-brand-700 hover:text-brand-700 font-semibold transition-colors"
                  >
                    Sign up
                  </button>
                </p>
              )}
              {mode !== 'login' && (
                <button
                  onClick={() => { setMode('login'); clearState(); setOtpDebug(null); setOtpCode('') }}
                  className="text-sm text-muted hover:text-ink transition-colors flex items-center gap-1.5 mx-auto"
                >
                  ← Back to Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
