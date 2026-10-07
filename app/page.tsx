"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Familjen_Grotesk, Instrument_Sans } from "next/font/google";

const display = Familjen_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body" });

/* Palette (flat colours only)
   night  #0C2229  page
   ridge1 #123038  far hills
   ridge2 #0F2830  mid hills
   ridge3 #0A1D23  near hills
   bone   #E8EFEA  text / light panel
   mute   #8FA8A8  secondary text
   sun    #E9A23B  the one accent: route, sun, active states */

function ArrowBox({ dark = false }: { dark?: boolean }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
        dark ? "bg-[#0C2229] text-[#E8EFEA]" : "bg-[#E9A23B] text-[#0C2229]"
      }`}
      aria-hidden
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M3.5 10.5l7-7M4.5 3.5h6v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <path d="M6 20c0-7 14-3 14-12" stroke="#E9A23B" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 4" />
      <circle cx="6" cy="20" r="3.2" fill="#E8EFEA" />
      <circle cx="20" cy="6" r="3.2" stroke="#E8EFEA" strokeWidth="2" />
    </svg>
  );
}

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${
          done ? "bg-[#E9A23B]" : "border border-[#E8EFEA]/30"
        }`}
        aria-hidden
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5.2l2 2L8 3" stroke="#0C2229" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className={done ? "text-[#E8EFEA]" : "text-[#8FA8A8]"}>{children}</span>
    </li>
  );
}

export default function LandingPage() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const route =
    "M150 478 C 330 440, 430 404, 640 424 S 930 392, 1180 410";

  return (
    <div
      className={`${display.variable} ${body.variable} relative min-h-screen overflow-x-hidden bg-[#0C2229] text-[#E8EFEA] selection:bg-[#E9A23B] selection:text-[#0C2229]`}
      style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}
    >
      <style>{`
        @keyframes bba-draw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
        .bba-route { stroke-dasharray: 1; stroke-dashoffset: 0; animation: bba-draw 2.6s cubic-bezier(.6,0,.2,1) .4s both }
        @media (prefers-reduced-motion: reduce) { .bba-route { animation: none } }
      `}</style>

      {/* Navigation */}
      <header className="relative z-20 mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E9A23B]">
          <Mark />
          <span className="text-[17px] font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            BBA Transport
          </span>
        </Link>

        <nav className="hidden items-center gap-9 text-[14px] text-[#E8EFEA]/80 md:flex" aria-label="Primary">
          <a href="#paths" className="transition-colors hover:text-white">Send or ride</a>
          <a href="#facts" className="transition-colors hover:text-white">Fares and safety</a>
        </nav>

        <div className="flex items-center gap-5">
          <Link href="/rider" className="hidden text-[14px] text-[#E8EFEA]/80 transition-colors hover:text-white sm:block">
            Become a rider
          </Link>
          <Link
            href="/sender"
            className="group flex items-center gap-3 rounded-[12px] bg-[#E8EFEA] py-1.5 pl-4 pr-1.5 text-[14px] font-medium text-[#0C2229] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E9A23B]"
          >
            Send a package
            <ArrowBox />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-[1200px] flex-col items-center px-6 pb-0 pt-14 text-center md:pt-20">
        <h1
          className="max-w-[820px] text-[clamp(2.4rem,6vw,4.6rem)] font-medium leading-[1.02] tracking-[-0.035em]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Small parcels carried by riders already nearby.
        </h1>
        <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-[#8FA8A8]">
          Post your parcel, choose a rider close to you, and hand it over with a one-time code.
          Pay the rider in cash. No courier minimums.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sender"
            className="group flex items-center gap-4 rounded-[12px] bg-[#E8EFEA] py-2 pl-5 pr-2 text-[15px] font-medium text-[#0C2229] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E9A23B]"
          >
            Send a package
            <ArrowBox />
          </Link>
          <Link
            href="/rider"
            className="rounded-[12px] border border-[#E8EFEA]/25 px-5 py-[13px] text-[15px] font-medium transition-colors hover:border-[#E8EFEA]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E9A23B]"
          >
            Earn as a rider
          </Link>
        </div>
      </section>

      {/* Scene: hills above Abbottabad, a parcel route, two status panels */}
      <section className="relative mt-10 md:mt-0" aria-label="Example delivery">
        <svg
          viewBox="0 0 1440 520"
          preserveAspectRatio="xMidYMax slice"
          className="block h-[300px] w-full md:h-[520px]"
          role="img"
          aria-label="Hills above Abbottabad at dusk with a delivery route between two points"
        >
          <circle cx="1010" cy="196" r="56" fill="#E9A23B" />
          <path d="M0 300L120 250 240 285 380 200 520 270 660 215 820 290 980 230 1140 285 1300 220 1440 270V520H0Z" fill="#123038" />
          <path d="M0 360L160 320 300 350 470 285 640 345 800 310 980 360 1160 305 1320 345 1440 325V520H0Z" fill="#0F2830" />
          <path d="M0 432L200 402 420 442 650 398 900 447 1150 408 1440 442V520H0Z" fill="#0A1D23" />

          <path d={route} fill="none" stroke="#E9A23B" strokeWidth="3" strokeLinecap="round" pathLength={1} className="bba-route" />
          <circle cx="150" cy="478" r="7" fill="#E8EFEA" />
          <circle cx="1180" cy="410" r="9" fill="#0A1D23" stroke="#E8EFEA" strokeWidth="3" />
          {!still && (
            <circle r="7" fill="#E9A23B" stroke="#0A1D23" strokeWidth="3">
              <animateMotion dur="9s" begin="1s" repeatCount="indefinite" path={route} />
            </circle>
          )}
        </svg>

        <div className="mx-auto -mt-16 flex max-w-[1200px] flex-col gap-4 px-6 md:absolute md:inset-0 md:mt-0 md:block md:max-w-none md:px-0">
          {/* Status panel */}
          <div className="w-full rounded-[18px] border border-[#E8EFEA]/15 bg-[#0C2229]/70 p-5 text-[14px] backdrop-blur-xl md:absolute md:left-[max(24px,calc(50%-560px))] md:top-[56px] md:w-[270px]">
            <div className="flex items-center justify-between">
              <span className="font-medium" style={{ fontFamily: "var(--font-display)" }}>Parcel status</span>
              <span className="text-[12px] text-[#8FA8A8]">7.0 km</span>
            </div>
            <p className="mt-1 text-[13px] text-[#8FA8A8]">Mandian to Jinnah Park</p>
            <div className="my-4 h-px bg-[#E8EFEA]/12" />
            <ul className="space-y-3">
              <Step done>Parcel posted</Step>
              <Step done>Rider accepted</Step>
              <Step done>Pickup code checked</Step>
              <Step done={false}>On the way</Step>
              <Step done={false}>Delivery code checked</Step>
            </ul>
          </div>

          {/* Fare panel */}
          <div className="w-full rounded-[18px] border border-[#E8EFEA]/15 bg-[#0C2229]/70 p-5 text-[14px] backdrop-blur-xl md:absolute md:right-[max(24px,calc(50%-560px))] md:top-[96px] md:w-[290px]">
            <div className="flex items-center gap-2 text-[13px] text-[#8FA8A8]">
              <span className="h-2 w-2 rounded-full bg-[#E9A23B]" aria-hidden />
              Fare accepted
            </div>
            <p className="mt-3 text-[44px] font-medium leading-none tracking-[-0.03em]" style={{ fontFamily: "var(--font-display)" }}>
              Rs 325
            </p>
            <p className="mt-2 text-[13px] text-[#8FA8A8]">4 kg parcel, paid in cash to the rider</p>
            <div className="my-4 h-px bg-[#E8EFEA]/12" />
            <dl className="space-y-2.5">
              <div className="flex justify-between"><dt className="text-[#8FA8A8]">Rider</dt><dd>Usman, 4 min away</dd></div>
              <div className="flex justify-between"><dt className="text-[#8FA8A8]">Pickup code</dt><dd className="tracking-[0.18em]">4271</dd></div>
            </dl>
          </div>
        </div>
      </section>

      {/* Facts */}
      <section id="facts" className="relative z-10 border-t border-[#E8EFEA]/10 bg-[#0A1D23]">
        <div className="mx-auto grid max-w-[1200px] gap-px px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Up to 10 kg", "Small parcels only, so a motorbike is enough and the fare stays low."],
            ["From Rs 120", "A fixed fare based on distance and weight, shown before you post."],
            ["Two one-time codes", "One at pickup and one at delivery. A parcel is only handed over to the right person."],
            ["Riders vetted by phone", "Every rider is approved by our team before they can go online."],
          ].map(([t, d]) => (
            <div key={t} className="border-l border-[#E8EFEA]/12 py-1 pl-5 pr-6 sm:py-2">
              <h3 className="text-[18px] font-medium tracking-tight" style={{ fontFamily: "var(--font-display)" }}>{t}</h3>
              <p className="mt-2 max-w-[260px] text-[14px] leading-relaxed text-[#8FA8A8]">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Two paths */}
      <section id="paths" className="relative z-10 bg-[#0A1D23] pb-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <h2 className="max-w-[560px] text-[clamp(1.8rem,3.4vw,2.6rem)] font-medium leading-[1.08] tracking-[-0.03em]" style={{ fontFamily: "var(--font-display)" }}>
            Have something to send, or a bike and free hours?
          </h2>

          <div className="mt-10 grid gap-4 lg:grid-cols-[7fr_5fr]">
            <Link
              href="/sender"
              className="group flex min-h-[280px] flex-col justify-between rounded-[22px] bg-[#E8EFEA] p-8 text-[#0C2229] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E9A23B]"
            >
              <div>
                <h3 className="text-[30px] font-medium tracking-[-0.025em]" style={{ fontFamily: "var(--font-display)" }}>Send a package</h3>
                <p className="mt-3 max-w-[420px] text-[16px] leading-relaxed text-[#0C2229]/70">
                  Drop a pin for pickup and drop-off, see the fare, and a nearby rider takes the job. Track them on the map until the delivery code is entered.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium">Start a delivery</span>
                <ArrowBox dark />
              </div>
            </Link>

            <Link
              href="/rider"
              className="group flex min-h-[280px] flex-col justify-between rounded-[22px] border border-[#E8EFEA]/18 bg-[#123038] p-8 transition-colors hover:border-[#E9A23B]/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E9A23B]"
            >
              <div>
                <h3 className="text-[30px] font-medium tracking-[-0.025em]" style={{ fontFamily: "var(--font-display)" }}>Earn as a rider</h3>
                <p className="mt-3 max-w-[360px] text-[16px] leading-relaxed text-[#8FA8A8]">
                  Go online, see jobs near you at a clear fare, and keep the cash you collect. Free of commission while we launch.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium">Apply to ride</span>
                <ArrowBox />
              </div>
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-[#E8EFEA]/10 bg-[#0A1D23]">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-3 px-6 py-8 text-[13px] text-[#8FA8A8] sm:flex-row sm:items-center">
          <span className="flex items-center gap-2.5 text-[#E8EFEA]"><Mark />BBA Transport</span>
          <span>Peer-to-peer delivery in Abbottabad, Khyber Pakhtunkhwa</span>
        </div>
      </footer>
    </div>
  );
}