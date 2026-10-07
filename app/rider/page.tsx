'use client';

import { useEffect, useState } from 'react';
import { Familjen_Grotesk, Instrument_Sans } from 'next/font/google';
import { Check } from 'lucide-react';
import { useRiderHeartbeat } from '@/hooks/useRiderHeartbeat';

const display = Familjen_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body' });

/* Palette: night #0C2229 · deep #0A1D23 · teal #123038 · bone #E8EFEA · mute #8FA8A8
   Online = mint #8ED1B4 · requests/price = amber #E9A23B · urgent = coral #F07F6B */

type Req = { id: string; pickup: string; trip: string; price: number; weight: string; size: string; expiresIn: number; total: number };

const ACTIONS = ['Arrived at pickup', 'Pickup code verified', 'Arrived at drop-off', 'Delivery code verified', 'Cash received'];

const MOCK_REQUESTS: Req[] = [
  { id: '1', pickup: '1.2 km away', trip: '4.5 km trip', price: 250, weight: '2 kg', size: 'Medium', expiresIn: 45, total: 60 },
  { id: '2', pickup: '3.0 km away', trip: '8.1 km trip', price: 380, weight: '5 kg', size: 'Large', expiresIn: 30, total: 60 },
];

function Ring({ left, total }: { left: number; total: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const urgent = left <= 15;
  return (
    <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center" role="timer" aria-label={`${left} seconds left`}>
      <svg width="52" height="52" viewBox="0 0 52 52" className="-rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(232,239,234,.14)" strokeWidth="3" />
        <circle
          cx="26" cy="26" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
          stroke={urgent ? '#F07F6B' : '#E9A23B'}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - left / total)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s' }}
        />
      </svg>
      <span className="absolute text-[14px] font-medium tabular-nums">{left}</span>
    </div>
  );
}

export default function RiderDashboard() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<Req[]>([]);
  const [job, setJob] = useState<Req | null>(null);
  const [stage, setStage] = useState(0);
  const [earned, setEarned] = useState(0);
  const [jobsDone, setJobsDone] = useState(0);

  // Using a mock riderId for UI development before auth is wired up
  const mockRiderId = 'mock-uuid-1234';
  const heartbeat = useRiderHeartbeat({ riderId: mockRiderId, enabled });

  const toggleOnline = async () => {
    setError(null);
    setBusy(true);
    try {
      if (enabled) {
        await heartbeat.goOffline();
        setEnabled(false);
        setRequests([]);
      } else {
        await heartbeat.goOnline();
        setEnabled(true);
        setRequests(MOCK_REQUESTS); // TODO: replace with delivery_dispatches subscription
      }
    } catch {
      setError('Could not go online. Check that location access is allowed for this site.');
    } finally {
      setBusy(false);
    }
  };

  // Live countdown: requests expire and drop out of the feed
  useEffect(() => {
    if (!enabled || requests.length === 0) return;
    const t = setInterval(() => {
      setRequests((rs) => rs.map((r) => ({ ...r, expiresIn: r.expiresIn - 1 })).filter((r) => r.expiresIn > 0));
    }, 1000);
    return () => clearInterval(t);
  }, [enabled, requests.length]);

  const accept = (r: Req) => {
    // TODO: call accept_delivery RPC; handle "someone else got it"
    setJob(r);
    setStage(0);
    setRequests([]);
  };

  const advance = () => {
    if (!job) return;
    if (stage < ACTIONS.length - 1) return setStage(stage + 1);
    setEarned((e) => e + job.price);
    setJobsDone((j) => j + 1);
    setJob(null);
    setStage(0);
  };

  const status = job ? 'On a delivery' : enabled ? 'You are online' : 'You are offline';
  const dot = job ? '#E9A23B' : enabled ? '#8ED1B4' : '#8FA8A8';

  return (
    <div
      className={`${display.variable} ${body.variable} min-h-[calc(100dvh-3.5rem)] bg-[#0C2229] text-[#E8EFEA] selection:bg-[#E9A23B] selection:text-[#0C2229]`}
      style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}
    >
      <style>{`
        @keyframes bba-live { 0% { transform: scale(.6); opacity: .7 } 100% { transform: scale(2.2); opacity: 0 } }
        .bba-live { animation: bba-live 1.8s ease-out infinite }
        @media (prefers-reduced-motion: reduce) { .bba-live { animation: none; opacity: .3 } }
      `}</style>

      <main className="mx-auto grid max-w-[1180px] grid-cols-1 gap-5 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-5 sm:pt-6 lg:grid-cols-[330px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Status panel */}
        <aside className="min-w-0 rounded-[22px] border border-[#E8EFEA]/12 bg-[#0A1D23] p-5 sm:p-6 lg:sticky lg:top-24">
          <div className="flex items-center gap-3">
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
              {(enabled || job) && <span className="bba-live absolute h-full w-full rounded-full" style={{ background: dot }} />}
              <span className="relative h-4 w-4 rounded-full" style={{ background: dot }} />
            </span>
            <h1 className="min-w-0 text-[22px] font-medium leading-tight tracking-[-0.025em] sm:text-[24px]" style={{ fontFamily: 'var(--font-display)' }}>{status}</h1>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-[#8FA8A8]">
            {job ? 'Finish the steps below to get paid.' : enabled ? 'We are looking for parcels near you.' : 'Go online to start receiving delivery requests near you.'}
          </p>

          <button
            type="button"
            onClick={toggleOnline}
            disabled={busy || !!job}
            className={`mt-5 h-14 w-full rounded-[14px] text-[16px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8EFEA] ${
              enabled ? 'border border-[#E8EFEA]/25 hover:bg-[#123038]' : 'bg-[#8ED1B4] text-[#0C2229] hover:bg-[#9edcc0]'
            }`}
          >
            {busy ? 'One moment' : enabled ? 'Go offline' : 'Go online'}
          </button>

          {error && <p role="alert" className="mt-3 rounded-[10px] border border-[#F07F6B]/40 bg-[#F07F6B]/10 px-3 py-2 text-[13px] leading-snug text-[#F5A294]">{error}</p>}

          {enabled && (
            <p className="mt-4 flex items-start gap-2 text-[12px] leading-snug text-[#8FA8A8]">
              <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8ED1B4]" />
              <span>{heartbeat.wakeLockActive ? 'Screen is kept awake. Keep the app open.' : 'Keep this screen open so we can see you nearby.'}</span>
            </p>
          )}

          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-[#E8EFEA]/10 pt-5">
            <div className="min-w-0">
              <dt className="text-[12px] text-[#8FA8A8]">Earned today</dt>
              <dd className="mt-1 truncate text-[24px] font-medium text-[#E9A23B]" style={{ fontFamily: 'var(--font-display)' }}>Rs {earned}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[12px] text-[#8FA8A8]">Deliveries</dt>
              <dd className="mt-1 text-[24px] font-medium" style={{ fontFamily: 'var(--font-display)' }}>{jobsDone}</dd>
            </div>
          </dl>
        </aside>

        {/* Feed / active job */}
        <section aria-live="polite" className="min-w-0">
          {job ? (
            <div className="rounded-[22px] border border-[#E9A23B]/50 bg-[#0A1D23] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[12px] text-[#8FA8A8]">Current delivery</p>
                  <p className="mt-1 text-[34px] font-medium leading-none tracking-[-0.03em] text-[#E9A23B] sm:text-[36px]" style={{ fontFamily: 'var(--font-display)' }}>Rs {job.price}</p>
                </div>
                <p className="shrink-0 text-right text-[14px] leading-snug text-[#8FA8A8]">{job.trip}<br />{job.weight}, {job.size}</p>
              </div>

              <ul className="mt-6 space-y-3.5">
                {ACTIONS.map((a, i) => {
                  const done = i < stage;
                  const now = i === stage;
                  return (
                    <li key={a} className="flex items-center gap-3 text-[15px]">
                      <span
                        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
                        style={{ background: done ? '#8ED1B4' : 'transparent', border: done ? 'none' : `1.5px solid ${now ? '#E9A23B' : 'rgba(232,239,234,.25)'}` }}
                      >
                        {done && <Check className="h-3.5 w-3.5 text-[#0C2229]" />}
                      </span>
                      <span className={done ? 'text-[#E8EFEA]' : now ? 'font-medium text-[#E8EFEA]' : 'text-[#8FA8A8]'}>{a}</span>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                onClick={advance}
                className="mt-7 h-14 w-full rounded-[14px] bg-[#E9A23B] text-[16px] font-medium text-[#0C2229] transition-colors hover:bg-[#f0b052] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8EFEA]"
              >
                {ACTIONS[stage]}
              </button>
              <p className="mt-3 text-[12px] text-[#8FA8A8]">Preview only. Codes and addresses will come from the live delivery.</p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
                <h2 className="text-[20px] font-medium tracking-[-0.02em]" style={{ fontFamily: 'var(--font-display)' }}>Delivery requests</h2>
                {enabled && <span className="shrink-0 text-[13px] text-[#8FA8A8]">{requests.length} nearby</span>}
              </div>

              {requests.length === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[22px] border border-dashed border-[#E8EFEA]/18 px-6 py-12 text-center">
                  <p className="text-[16px] font-medium">{enabled ? 'No requests nearby right now' : 'You are offline'}</p>
                  <p className="mx-auto mt-2 max-w-[320px] text-[14px] leading-relaxed text-[#8FA8A8]">
                    {enabled ? 'Stay online. New requests appear here with a countdown, and the first rider to accept gets the job.' : 'Tap Go online and new requests will appear here.'}
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {requests.map((r) => (
                    <li key={r.id} className="rounded-[22px] border border-[#E8EFEA]/12 bg-[#0A1D23] p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[32px] font-medium leading-none tracking-[-0.03em] text-[#E9A23B] sm:text-[34px]" style={{ fontFamily: 'var(--font-display)' }}>Rs {r.price}</p>
                          <p className="mt-2 text-[14px] leading-snug text-[#8FA8A8]">{r.trip}. Pickup {r.pickup}.</p>
                        </div>
                        <Ring left={r.expiresIn} total={r.total} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
                        <span className="rounded-full bg-[#123038] px-3 py-1.5">{r.weight}</span>
                        <span className="rounded-full bg-[#123038] px-3 py-1.5">{r.size} size</span>
                      </div>

                      <div className="mt-5 grid grid-cols-[1fr_2fr] gap-3">
                        <button
                          type="button"
                          onClick={() => setRequests((rs) => rs.filter((x) => x.id !== r.id))}
                          className="h-12 whitespace-nowrap rounded-[12px] border border-[#E8EFEA]/22 px-2 text-[15px] font-medium transition-colors hover:bg-[#123038] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E9A23B]"
                        >
                          Skip
                        </button>
                        <button
                          type="button"
                          onClick={() => accept(r)}
                          className="h-12 whitespace-nowrap rounded-[12px] bg-[#E9A23B] px-2 text-[15px] font-medium text-[#0C2229] transition-colors hover:bg-[#f0b052] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8EFEA]"
                        >
                          Accept delivery
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}