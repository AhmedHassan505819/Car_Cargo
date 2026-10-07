'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Familjen_Grotesk, Instrument_Sans } from 'next/font/google';
import { ArrowLeft, Check, Minus, Plus, Pencil } from 'lucide-react';
import { calculateQuote } from '@/lib/pricing/quote';
import type { QuoteResult, SizeClass } from '@/types/database.types';

const display = Familjen_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body' });

// Leaflet needs the browser, so the map is loaded client-side only
const MapView = dynamic(() => import('@/components/map/Map'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0A1D23]">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#E9A23B] border-t-transparent" />
    </div>
  ),
});

/* Palette: night #0C2229 · deep #0A1D23 · teal #123038 · bone #E8EFEA · mute #8FA8A8
   Step colours: mint #8ED1B4 (pickup) · amber #E9A23B (drop-off) · sky #8FB8E8 (parcel) · bone (review) */

const STEPS = [
  { id: 'PICKUP', label: 'Pickup', accent: '#8ED1B4' },
  { id: 'DROPOFF', label: 'Drop-off', accent: '#E9A23B' },
  { id: 'DETAILS', label: 'Parcel', accent: '#8FB8E8' },
  { id: 'CONFIRM', label: 'Review', accent: '#E8EFEA' },
] as const;

type StepId = (typeof STEPS)[number]['id'];
type Step = StepId | 'POSTED';
type Point = { lat: number; lng: number; label?: string };

const SIZES: { id: SizeClass; name: string; hint: string }[] = [
  { id: 'S', name: 'Small', hint: 'Envelope or documents' },
  { id: 'M', name: 'Medium', hint: 'Shoebox or a few books' },
  { id: 'L', name: 'Large', hint: 'Microwave-size box' },
];

const coords = (p: Point) => `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;

async function reverseLabel(ll: { lat: number; lng: number }): Promise<string | null> {
  try {
    const r = await fetch(`https://photon.komoot.io/reverse?lon=${ll.lng}&lat=${ll.lat}`);
    const p = (await r.json()).features?.[0]?.properties;
    const name = [p?.name ?? p?.street, p?.district ?? p?.city].filter(Boolean).join(', ');
    return name || null;
  } catch {
    return null;
  }
}

export default function SenderDashboard() {
  const [step, setStep] = useState<Step>('PICKUP');
  const [pickup, setPickup] = useState<Point | null>(null);
  const [dropoff, setDropoff] = useState<Point | null>(null);

  const [description, setDescription] = useState('');
  const [weightKg, setWeightKg] = useState(2);
  const [sizeClass, setSizeClass] = useState<SizeClass>('M');
  const [fragile, setFragile] = useState(false);

  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [price, setPrice] = useState(0);

  const stepIndex = step === 'POSTED' ? STEPS.length : STEPS.findIndex((s) => s.id === step);
  const current = step === 'POSTED' ? STEPS[3] : STEPS[stepIndex];
  const accent = step === 'POSTED' ? '#E9A23B' : current.accent;
  const selecting = step === 'PICKUP' || step === 'DROPOFF';

  /* ---------- map interaction ---------- */
  const setPoint = (kind: 'pickup' | 'dropoff', ll: { lat: number; lng: number }, label?: string) => {
    const setter = kind === 'pickup' ? setPickup : setDropoff;
    setter({ ...ll, label });
    if (!label) {
      reverseLabel(ll).then((name) => {
        if (name) setter((prev) => (prev && prev.lat === ll.lat && prev.lng === ll.lng ? { ...prev, label: name } : prev));
      });
    }
  };

  const handleMapClick = (ll: { lat: number; lng: number }, label?: string) => {
    if (step === 'PICKUP') setPoint('pickup', ll, label);
    else if (step === 'DROPOFF') setPoint('dropoff', ll, label);
  };

  const handleMarkerDrag = (id: string, ll: { lat: number; lng: number }) => setPoint(id === 'pickup' ? 'pickup' : 'dropoff', ll);

  const markers = [
    ...(pickup ? [{ id: 'pickup', ...pickup, color: STEPS[0].accent, label: 'A' }] : []),
    ...(dropoff ? [{ id: 'dropoff', ...dropoff, color: STEPS[1].accent, label: 'B' }] : []),
  ];

  const hint =
    step === 'PICKUP'
      ? pickup ? 'Drag the pin to fine-tune, or tap to move it' : 'Tap the map to drop your pickup pin'
      : step === 'DROPOFF'
        ? dropoff ? 'Drag the pin to fine-tune, or tap to move it' : 'Tap the map to drop the drop-off pin'
        : undefined;

  /* ---------- flow ---------- */
  const canNext =
    (step === 'PICKUP' && !!pickup) ||
    (step === 'DROPOFF' && !!dropoff) ||
    (step === 'DETAILS' && description.trim().length > 0 && weightKg > 0) ||
    step === 'CONFIRM';

  const next = () => {
    if (step === 'PICKUP') setStep('DROPOFF');
    else if (step === 'DROPOFF') setStep('DETAILS');
    else if (step === 'DETAILS') {
      const res = calculateQuote({
        pickupLat: pickup!.lat,
        pickupLng: pickup!.lng,
        dropoffLat: dropoff!.lat,
        dropoffLng: dropoff!.lng,
        weightKg,
        sizeClass,
      });
      setQuote(res);
      setPrice(res.suggested_price_pkr);
      setStep('CONFIRM');
    } else if (step === 'CONFIRM') {
      // TODO: replace with POST /api/deliveries { pickup, dropoff, description, weightKg, sizeClass, fragile, price }
      setStep('POSTED');
    }
  };

  const back = () => {
    if (step === 'POSTED') return setStep('CONFIRM');
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1].id);
  };

  const reset = () => {
    setPickup(null);
    setDropoff(null);
    setDescription('');
    setWeightKg(2);
    setSizeClass('M');
    setFragile(false);
    setQuote(null);
    setStep('PICKUP');
  };

  // Scroll to top of the page on step change (helps on stacked tablet layout)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const primaryLabel =
    step === 'PICKUP' ? 'Confirm pickup'
    : step === 'DROPOFF' ? 'Confirm drop-off'
    : step === 'DETAILS' ? 'See the fare'
    : `Post for Rs ${price}`;

  const minPrice = quote ? Math.round((quote.suggested_price_pkr * 0.85) / 10) * 10 : 0;
  const maxPrice = quote ? Math.round((quote.suggested_price_pkr * 1.5) / 10) * 10 : 0;

  const field =
    'w-full rounded-[12px] border border-[#E8EFEA]/15 bg-[#0C2229] px-4 py-3 text-[15px] text-[#E8EFEA] placeholder:text-[#8FA8A8] outline-none transition-colors focus:border-[#8FB8E8]';

  /* ---------- render ---------- */
  return (
    <div
      className={`${display.variable} ${body.variable} min-h-[100dvh] bg-[#0C2229] text-[#E8EFEA] selection:bg-[#E9A23B] selection:text-[#0C2229]`}
      style={{ fontFamily: 'var(--font-body), system-ui, sans-serif' }}
    >
      <style>{`
        @keyframes bba-search { 0% { transform: scale(.4); opacity: .6 } 100% { transform: scale(1.5); opacity: 0 } }
        .bba-search-ring { animation: bba-search 2.2s ease-out infinite }
        @media (prefers-reduced-motion: reduce) { .bba-search-ring { animation: none; opacity: .25 } }
        input[type=range].bba-range { accent-color: var(--acc); height: 28px; width: 100%; }
      `}</style>

      {/* Header */}
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4">
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-full border border-[#E8EFEA]/18 py-2 pl-3 pr-4 text-[14px] font-medium transition-colors hover:border-[#E8EFEA]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E9A23B]"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Home
        </Link>
        <span className="text-[16px] font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          BBA Transport
        </span>
      </header>

      <main className="mx-auto grid max-w-[1180px] gap-4 px-5 pb-8 lg:grid-cols-[minmax(0,1fr)_390px]">
        {/* Map card */}
        <section
          aria-label="Map"
          className="relative h-[42vh] min-h-[300px] overflow-hidden rounded-[22px] border border-[#E8EFEA]/12 bg-[#0A1D23] lg:h-[calc(100dvh-112px)] lg:max-h-[700px]"
        >
          <MapView
            markers={markers}
            onMapClick={handleMapClick}
            onMarkerDrag={handleMarkerDrag}
            draggableIds={step === 'PICKUP' ? ['pickup'] : step === 'DROPOFF' ? ['dropoff'] : []}
            showRoute={!!pickup && !!dropoff && (step === 'CONFIRM' || step === 'POSTED')}
            fitToMarkers={step === 'CONFIRM' || step === 'POSTED'}
            hint={selecting ? hint : undefined}
            accent={accent}
          />
        </section>

        {/* Control panel */}
        <aside
          className="flex flex-col overflow-hidden rounded-[22px] border border-[#E8EFEA]/12 bg-[#0A1D23] lg:h-[calc(100dvh-112px)] lg:max-h-[700px]"
          style={{ ['--acc' as string]: accent }}
        >
          {/* Stepper */}
          <nav aria-label="Progress" className="grid grid-cols-4 gap-2 px-5 pt-5">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              const clickable = done && step !== 'POSTED';
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!clickable}
                  onClick={() => setStep(s.id)}
                  aria-current={active ? 'step' : undefined}
                  className="group text-left disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E9A23B]"
                >
                  <span className="block h-[4px] rounded-full transition-colors duration-300" style={{ background: done || active ? s.accent : 'rgba(232,239,234,.14)', opacity: done && !active ? 0.55 : 1 }} />
                  <span className={`mt-2 flex items-center gap-1 text-[12px] ${active ? 'font-medium text-[#E8EFEA]' : 'text-[#8FA8A8]'} ${clickable ? 'group-hover:text-[#E8EFEA]' : ''}`}>
                    {done ? <Check className="h-3 w-3" style={{ color: s.accent }} /> : <span>{i + 1}</span>}
                    {s.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 pt-6">
            {selecting && (
              <div>
                <h1 className="text-[26px] font-medium leading-[1.1] tracking-[-0.025em]" style={{ fontFamily: 'var(--font-display)' }}>
                  {step === 'PICKUP' ? 'Where should the rider collect it?' : 'Where is it going?'}
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-[#8FA8A8]">
                  Search for a place, use your location, or tap the map. You can drag the pin afterwards.
                </p>
              </div>
            )}

            {step === 'DETAILS' && (
              <div className="space-y-6">
                <h1 className="text-[26px] font-medium leading-[1.1] tracking-[-0.025em]" style={{ fontFamily: 'var(--font-display)' }}>
                  Tell the rider what they are carrying
                </h1>

                <div>
                  <label htmlFor="desc" className="mb-2 block text-[13px] text-[#8FA8A8]">What is in the parcel?</label>
                  <input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Two books in a small box" className={field} />
                </div>

                <div>
                  <div className="mb-1 flex items-baseline justify-between">
                    <label htmlFor="kg" className="text-[13px] text-[#8FA8A8]">Weight</label>
                    <span className="text-[20px] font-medium" style={{ fontFamily: 'var(--font-display)' }}>{weightKg} kg</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="Lighter" onClick={() => setWeightKg((w) => Math.max(0.5, +(w - 0.5).toFixed(1)))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E8EFEA]/18 hover:bg-[#123038]">
                      <Minus className="h-4 w-4" />
                    </button>
                    <input id="kg" type="range" min={0.5} max={10} step={0.5} value={weightKg} onChange={(e) => setWeightKg(parseFloat(e.target.value))} className="bba-range" />
                    <button type="button" aria-label="Heavier" onClick={() => setWeightKg((w) => Math.min(10, +(w + 0.5).toFixed(1)))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E8EFEA]/18 hover:bg-[#123038]">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1 text-[12px] text-[#8FA8A8]">We carry parcels up to 10 kg.</p>
                </div>

                <fieldset>
                  <legend className="mb-2 text-[13px] text-[#8FA8A8]">Size</legend>
                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                    {SIZES.map((s) => {
                      const on = sizeClass === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSizeClass(s.id)}
                          aria-pressed={on}
                          className="rounded-[12px] border px-4 py-3 text-left transition-colors"
                          style={{ borderColor: on ? '#8FB8E8' : 'rgba(232,239,234,.15)', background: on ? 'rgba(143,184,232,.12)' : 'transparent' }}
                        >
                          <span className="block text-[14px] font-medium">{s.name}</span>
                          <span className="block text-[12px] text-[#8FA8A8]">{s.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <button
                  type="button"
                  role="switch"
                  aria-checked={fragile}
                  onClick={() => setFragile(!fragile)}
                  className="flex w-full items-center justify-between rounded-[12px] border border-[#E8EFEA]/15 px-4 py-3 text-left"
                >
                  <span>
                    <span className="block text-[14px] font-medium">Fragile</span>
                    <span className="block text-[12px] text-[#8FA8A8]">Rider will handle with extra care</span>
                  </span>
                  <span className="relative h-6 w-11 rounded-full transition-colors" style={{ background: fragile ? '#8FB8E8' : 'rgba(232,239,234,.2)' }}>
                    <span className="absolute top-0.5 h-5 w-5 rounded-full bg-[#0C2229] transition-all" style={{ left: fragile ? 22 : 2 }} />
                  </span>
                </button>
              </div>
            )}

            {step === 'CONFIRM' && quote && (
              <div className="space-y-5">
                <h1 className="text-[26px] font-medium leading-[1.1] tracking-[-0.025em]" style={{ fontFamily: 'var(--font-display)' }}>
                  Check the details and post
                </h1>

                <div className="rounded-[16px] bg-[#123038] p-5">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[12px] text-[#8FA8A8]">Distance</p>
                      <p className="text-[18px] font-medium">{quote.distance_km} km</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] text-[#8FA8A8]">Your fare</p>
                      <p className="text-[38px] font-medium leading-none tracking-[-0.03em] text-[#E9A23B]" style={{ fontFamily: 'var(--font-display)' }}>Rs {price}</p>
                    </div>
                  </div>

                  <div className="mt-5">
                    <input
                      type="range"
                      aria-label="Adjust fare"
                      min={minPrice}
                      max={maxPrice}
                      step={10}
                      value={price}
                      onChange={(e) => setPrice(parseInt(e.target.value, 10))}
                      className="bba-range"
                      style={{ ['--acc' as string]: '#E9A23B' }}
                    />
                    <div className="flex justify-between text-[12px] text-[#8FA8A8]">
                      <span>Rs {minPrice}</span>
                      <span>Rs {maxPrice}</span>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#8FA8A8]">
                      {price < quote.suggested_price_pkr
                        ? 'Below the suggested fare. Riders may skip it.'
                        : price > quote.suggested_price_pkr
                          ? 'Higher fares are usually picked up faster.'
                          : 'Suggested fare. Slide up to get picked up faster.'}
                    </p>
                  </div>
                </div>

                <dl className="space-y-2 text-[14px]">
                  {[
                    ['Base fare', quote.breakdown.base],
                    ['Distance', quote.breakdown.distance_fee],
                    ...(quote.breakdown.weight_fee > 0 ? [['Weight', quote.breakdown.weight_fee]] : []),
                    ...(quote.breakdown.size_fee > 0 ? [['Size', quote.breakdown.size_fee]] : []),
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between">
                      <dt className="text-[#8FA8A8]">{k}</dt>
                      <dd>Rs {v}</dd>
                    </div>
                  ))}
                </dl>

                <p className="rounded-[12px] border border-[#E8EFEA]/12 px-4 py-3 text-[13px] leading-relaxed text-[#8FA8A8]">
                  You pay the rider in cash at pickup. You will get a pickup code and a delivery code to confirm the handover.
                </p>
              </div>
            )}

            {step === 'POSTED' && (
              <div className="flex flex-col items-center pt-4 text-center">
                <div className="relative flex h-28 w-28 items-center justify-center">
                  <span className="bba-search-ring absolute inset-0 rounded-full bg-[#E9A23B]/40" />
                  <span className="bba-search-ring absolute inset-0 rounded-full bg-[#E9A23B]/40" style={{ animationDelay: '1.1s' }} />
                  <span className="relative h-5 w-5 rounded-full bg-[#E9A23B]" />
                </div>
                <h1 className="mt-6 text-[26px] font-medium leading-[1.1] tracking-[-0.025em]" style={{ fontFamily: 'var(--font-display)' }}>
                  Looking for a rider
                </h1>
                <p className="mt-2 max-w-[300px] text-[14px] leading-relaxed text-[#8FA8A8]">
                  We are asking riders near {pickup?.label ?? 'your pickup'} first, then widening the search. This usually takes a few minutes.
                </p>
                <p className="mt-4 text-[22px] font-medium" style={{ fontFamily: 'var(--font-display)' }}>Rs {price}</p>
              </div>
            )}

            {/* Pickup and drop-off summary: tap to edit */}
            {step !== 'POSTED' && (
              <div className="mt-6 space-y-2">
                {[
                  { kind: 'PICKUP' as const, name: 'Pickup', pt: pickup, color: STEPS[0].accent, letter: 'A' },
                  { kind: 'DROPOFF' as const, name: 'Drop-off', pt: dropoff, color: STEPS[1].accent, letter: 'B' },
                ].map((row) => (
                  <button
                    key={row.kind}
                    type="button"
                    onClick={() => row.pt && setStep(row.kind)}
                    disabled={!row.pt}
                    className="flex w-full items-center gap-3 rounded-[14px] border px-3 py-3 text-left transition-colors disabled:cursor-default"
                    style={{ borderColor: step === row.kind ? row.color : 'rgba(232,239,234,.12)', background: step === row.kind ? 'rgba(232,239,234,.04)' : 'transparent' }}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-[#0C2229]" style={{ background: row.pt ? row.color : 'rgba(232,239,234,.18)' }}>
                      {row.letter}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] text-[#8FA8A8]">{row.name}</span>
                      <span className="block truncate text-[14px]">{row.pt ? row.pt.label ?? coords(row.pt) : 'Not set yet'}</span>
                    </span>
                    {row.pt && step !== row.kind && <Pencil className="h-4 w-4 shrink-0 text-[#8FA8A8]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-3 border-t border-[#E8EFEA]/10 bg-[#0A1D23] p-4">
            {step === 'POSTED' ? (
              <>
                <button type="button" onClick={back} className="h-12 rounded-[12px] border border-[#E8EFEA]/20 px-5 text-[14px] font-medium transition-colors hover:bg-[#123038]">
                  Cancel request
                </button>
                <button type="button" onClick={reset} className="h-12 flex-1 rounded-[12px] bg-[#E8EFEA] text-[15px] font-medium text-[#0C2229]">
                  Send another
                </button>
              </>
            ) : (
              <>
                {stepIndex > 0 && (
                  <button type="button" onClick={back} className="h-12 rounded-[12px] border border-[#E8EFEA]/20 px-5 text-[14px] font-medium transition-colors hover:bg-[#123038] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E9A23B]">
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={next}
                  disabled={!canNext}
                  className="h-12 flex-1 rounded-[12px] text-[15px] font-medium text-[#0C2229] transition-[opacity,background] duration-200 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E8EFEA]"
                  style={{ background: accent }}
                >
                  {primaryLabel}
                </button>
              </>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}