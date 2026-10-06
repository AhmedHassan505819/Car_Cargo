import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Send a Package",
};

export default function SenderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <header className="px-4 py-3 border-b border-[#ffffff15] bg-[#121212] flex items-center justify-between sticky top-0 z-50">
        <div className="font-bold text-lg">BBA Transport</div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-sm font-medium">
            Me
          </div>
        </div>
      </header>
      <main className="flex-1 relative flex flex-col">
        {children}
      </main>
    </div>
  );
}
