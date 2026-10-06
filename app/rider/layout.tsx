import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rider Dashboard",
};

export default function RiderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <header className="px-4 py-3 border-b border-[#ffffff15] bg-[#121212] flex items-center justify-between sticky top-0 z-50">
        <div className="font-bold text-lg text-emerald-400">BBA Rider</div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-sm font-medium">
            R
          </div>
        </div>
      </header>
      <main className="flex-1 relative flex flex-col p-4 max-w-lg mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
