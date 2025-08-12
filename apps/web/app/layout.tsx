import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="m-0 font-sans">
        <header className="px-4 py-3 bg-[#0b5cff] text-white flex items-center justify-between">
          <strong>Project Independent</strong>
          <span className="opacity-90">Phase A</span>
        </header>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
