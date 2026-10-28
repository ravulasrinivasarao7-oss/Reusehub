export default function Footer() {
  return (
    <footer className="bg-green-900 text-green-50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-8 text-sm sm:flex-row">
        <p className="font-semibold">ReUseHub — A Smart Material Reuse Platform</p>
        <p>© {new Date().getFullYear()} ReUseHub. Reduce waste. Reuse more.</p>
      </div>
    </footer>
  );
}
