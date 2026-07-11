export default function CreditsPage() {
  const PACKS = [
    { credits: 10,  price: 2,  label: "Starter",  desc: "Try it out" },
    { credits: 50,  price: 8,  label: "Standard", desc: "Most popular", highlight: true },
    { credits: 200, price: 25, label: "Power",    desc: "For serious commanders" },
  ];

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 py-16 text-center">
      <h1 className="font-orbitron text-4xl font-black tracking-widest text-white mb-3">
        BUY CREDITS
      </h1>
      <p className="text-gray-400 text-sm mb-12">
        Each credit pack lets you forge more games. Tactical scenarios cost 3 credits each.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-2xl">
        {PACKS.map(pack => (
          <div key={pack.label}
            className="flex flex-col rounded-xl p-6 text-center"
            style={{
              background: pack.highlight ? "#0a1440" : "#070d20",
              border: pack.highlight ? "2px solid #4488ff66" : "1px solid #1e2a4a",
              boxShadow: pack.highlight ? "0 0 20px #4488ff22" : "none",
            }}>
            {pack.highlight && (
              <div className="text-xs font-orbitron tracking-widest mb-3" style={{ color: "#ffd700" }}>
                ★ MOST POPULAR
              </div>
            )}
            <div className="font-orbitron font-black text-2xl mb-1 text-white">{pack.label}</div>
            <div className="text-gray-400 text-xs mb-4">{pack.desc}</div>
            <div className="font-orbitron text-4xl font-black mb-1" style={{ color: "#ffd700" }}>
              ⚡ {pack.credits}
            </div>
            <div className="text-gray-500 text-sm mb-6">credits</div>
            <div className="font-orbitron font-black text-xl text-white mb-6">
              ${pack.price}
            </div>
            <button
              disabled
              className="mt-auto py-3 rounded-lg font-orbitron font-bold text-xs tracking-widest opacity-40 cursor-not-allowed"
              style={{ background: "#4488ff22", border: "1px solid #4488ff44", color: "#4488ff" }}>
              COMING SOON
            </button>
          </div>
        ))}
      </div>

      <p className="text-gray-600 text-xs mt-10">
        Payments are coming soon. Stay tuned!
      </p>
    </main>
  );
}
