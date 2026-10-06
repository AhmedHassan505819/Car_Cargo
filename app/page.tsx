import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="z-10 w-full max-w-md text-center space-y-10">
        <div className="space-y-4">
          <h1 className="text-5xl font-extrabold tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">
              BBA Transport
            </span>
          </h1>
          <p className="text-lg text-[#9ca3af]">
            Peer-to-peer delivery across Abbottabad.
            <br /> Fast, affordable, and trusted.
          </p>
        </div>

        <div className="grid gap-4">
          <Link 
            href="/sender"
            className="group relative flex items-center justify-between p-6 glass-panel hover-lift border-[#4f46e5]/30 hover:border-[#4f46e5]/60 transition-colors"
          >
            <div className="text-left">
              <h2 className="text-xl font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors">
                Send a Package
              </h2>
              <p className="text-sm text-[#9ca3af]">
                Get a trusted rider in minutes.
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/40 transition-colors">
              <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </Link>

          <Link 
            href="/rider"
            className="group relative flex items-center justify-between p-6 glass-panel hover-lift border-[#10b981]/30 hover:border-[#10b981]/60 transition-colors"
          >
            <div className="text-left">
              <h2 className="text-xl font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                Earn as a Rider
              </h2>
              <p className="text-sm text-[#9ca3af]">
                Accept deliveries, get paid instantly.
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/40 transition-colors">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
