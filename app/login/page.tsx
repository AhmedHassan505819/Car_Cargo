'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Familjen_Grotesk, Instrument_Sans } from 'next/font/google';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { login, signup } from './actions';

const display = Familjen_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body' });

/* Palette: night #0C2229 · deep #0A1D23 · teal #123038 · bone #E8EFEA · mute #8FA8A8
   amber #E9A23B (action) · mint #8ED1B4 (success) · coral #F07F6B (error) */

const field =
  'w-full rounded-[12px] border border-[#E8EFEA]/15 bg-[#0C2229] px-4 py-3.5 text-[15px] text-[#E8EFEA] placeholder:text-[#8FA8A8]/70 outline-none transition-colors focus:border-[#E9A23B]';

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <path d="M6 20c0-7 14-3 14-12" stroke="#E9A23B" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 4" />
      <circle cx="6" cy="20" r="3.2" fill="#E8EFEA" />
      <circle cx="20" cy="6" r="3.2" stroke="#E8EFEA" strokeWidth="2" />
    </svg>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'sender' | 'rider'>(redirectUrl.includes('rider') ? 'rider' : 'sender');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const formData = new FormData(e.currentTarget);
    formData.append('redirectUrl', redirectUrl);

    // Role comes from the picker; fall back to the redirect URL if it is missing
    if (!isLogin && !formData.has('role')) {
      formData.append('role', redirectUrl.includes('rider') ? 'rider' : 'sender');
    }

    const action = isLogin ? login : signup;

    try {
      const res = await action(formData) as any;
      if (res?.error) setError(res.error);
      else if (res?.success) setSuccessMsg(res.success);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (login: boolean) => {
    setIsLogin(login);
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <div className="w-full max-w-[420px]">
      {/* Mode switch */}
      <div className="grid grid-cols-2 rounded-[14px] border border-[#E8EFEA]/12 bg-[#0A1D23] p-1" role="group" aria-label="Sign in or create account">
        {[
          { v: true, t: 'Sign in' },
          { v: false, t: 'Create account' },
        ].map((o) => (
          <button
            key={o.t}
            type="button"
            aria-pressed={isLogin === o.v}
            onClick={() => switchMode(o.v)}
            className={`h-11 rounded-[10px] text-[14px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E9A23B] ${
              isLogin === o.v ? 'bg-[#E8EFEA] text-[#0C2229]' : 'text-[#8FA8A8] hover:text-[#E8EFEA]'
            }`}
          >
            {o.t}
          </button>
        ))}
      </div>

      <h1 className="mt-9 text-[34px] font-medium leading-[1.05] tracking-[-0.03em]" style={{ fontFamily: 'var(--font-display)' }}>
        {isLogin ? 'Welcome back' : 'Create your account'}
      </h1>
      <p className="mt-2 text-[15px] text-[#8FA8A8]">
        {isLogin ? 'Sign in to send a parcel or pick up deliveries.' : 'Choose how you will use BBA Transport, then add your details.'}
      </p>

      {error && (
        <div role="alert" className="mt-6 rounded-[12px] border border-[#F07F6B]/40 bg-[#F07F6B]/10 px-4 py-3 text-[14px] text-[#F5A294]">
          {error}
        </div>
      )}
      {successMsg && (
        <div role="status" className="mt-6 rounded-[12px] border border-[#8ED1B4]/40 bg-[#8ED1B4]/10 px-4 py-3 text-[14px] text-[#8ED1B4]">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        {!isLogin && (
          <>
            <fieldset>
              <legend className="mb-2 text-[13px] text-[#8FA8A8]">I want to</legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: 'sender' as const, t: 'Send parcels', c: '#8ED1B4' },
                  { v: 'rider' as const, t: 'Ride and earn', c: '#E9A23B' },
                ].map((o) => (
                  <label
                    key={o.v}
                    className="cursor-pointer rounded-[12px] border px-4 py-3 text-[14px] font-medium transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#E9A23B]"
                    style={{ borderColor: role === o.v ? o.c : 'rgba(232,239,234,.15)', background: role === o.v ? `${o.c}1f` : 'transparent' }}
                  >
                    <input type="radio" name="role" value={o.v} checked={role === o.v} onChange={() => setRole(o.v)} className="sr-only" />
                    {o.t}
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="fullName" className="mb-1.5 block text-[13px] text-[#8FA8A8]">Full name</label>
              <input id="fullName" name="fullName" type="text" required autoComplete="name" className={field} placeholder="Ahmed Khan" />
            </div>
          </>
        )}

        <div>
          <label htmlFor="email" className="mb-1.5 block text-[13px] text-[#8FA8A8]">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className={field} placeholder="you@example.com" />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-[13px] text-[#8FA8A8]">Password</label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPw ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              className={`${field} pr-12`}
              placeholder="At least 6 characters"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[#8FA8A8] hover:text-[#E8EFEA]"
            >
              {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 h-14 w-full rounded-[14px] bg-[#E9A23B] text-[16px] font-medium text-[#0C2229] transition-colors hover:bg-[#f0b052] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8EFEA]"
        >
          {loading ? 'One moment' : isLogin ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      className={`${display.variable} ${body.variable} grid min-h-[100dvh] bg-[#0C2229] text-[#E8EFEA] selection:bg-[#E9A23B] selection:text-[#0C2229] lg:grid-cols-[1.05fr_1fr]`}
      style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}
    >
      {/* Brand panel (large screens) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0A1D23] lg:flex">
        <div className="relative z-10 p-10">
          <Link href="/" className="flex w-fit items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E9A23B]">
            <Mark />
            <span className="text-[17px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>BBA Transport</span>
          </Link>
          <h2 className="mt-16 max-w-[460px] text-[44px] font-medium leading-[1.04] tracking-[-0.035em]" style={{ fontFamily: 'var(--font-display)' }}>
            Small parcels across Abbottabad, carried by riders already nearby.
          </h2>
          <p className="mt-5 max-w-[400px] text-[16px] leading-relaxed text-[#8FA8A8]">
            Fixed fares from Rs 120. One-time codes at pickup and delivery. Cash paid straight to the rider.
          </p>
        </div>

        <svg viewBox="0 0 720 360" preserveAspectRatio="xMidYMax slice" className="block h-[300px] w-full" aria-hidden>
          <circle cx="520" cy="130" r="42" fill="#E9A23B" />
          <path d="M0 190L90 150 180 175 280 110 380 165 470 125 570 180 660 140 720 165V360H0Z" fill="#123038" />
          <path d="M0 245L110 215 210 238 320 190 430 232 540 205 640 240 720 222V360H0Z" fill="#0F2830" />
          <path d="M0 300L130 280 280 308 430 275 580 310 720 288V360H0Z" fill="#0C2229" />
          <path d="M70 330 C 200 300, 300 285, 430 298 S 600 280, 660 292" fill="none" stroke="#E9A23B" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 9" />
          <circle cx="70" cy="330" r="5" fill="#E8EFEA" />
          <circle cx="660" cy="292" r="6" fill="#0C2229" stroke="#E8EFEA" strokeWidth="2.5" />
        </svg>
      </aside>

      {/* Form side */}
      <main className="relative flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="group flex items-center gap-2 rounded-full border border-[#E8EFEA]/18 py-2 pl-3 pr-4 text-[14px] font-medium transition-colors hover:border-[#E8EFEA]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E9A23B]"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Home
          </Link>
          <span className="flex items-center gap-2 text-[15px] font-semibold lg:hidden" style={{ fontFamily: 'var(--font-display)' }}>
            <Mark /> BBA Transport
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <Suspense
            fallback={
              <div className="flex min-h-[400px] w-full max-w-[420px] items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#E9A23B] border-t-transparent" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}