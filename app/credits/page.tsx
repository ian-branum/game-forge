"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { CREDIT_PACKS } from "@/lib/stripe";

function CreditsInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [banner, setBanner] = useState<"success" | "cancelled" | null>(null);

  useEffect(() => {
    if (searchParams.get("success")) setBanner("success");
    if (searchParams.get("cancelled")) setBanner("cancelled");
  }, [searchParams]);

  async function handleBuy(packId: string) {
    setLoading(packId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Something went wrong. Please try again.");
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 py-16 text-center">
      <h1 className="font-orbitron text-4xl font-black tracking-widest text-white mb-3">
        BUY CREDITS
      </h1>
      <p className="text-gray-400 text-sm mb-6">
        Each credit pack lets you forge and modify more games.
      </p>

      {/* Banners */}
      {banner === "success" && (
        <div className="mb-8 px-6 py-3 rounded-lg text-sm font-orbitron tracking-wide"
          style={{ background: "#0a2a0a", border: "1px solid #2a6a2a", color: "#6aff6a" }}>
          ✓ Payment successful — credits added to your account!
        </div>
      )}
      {banner === "cancelled" && (
        <div className="mb-8 px-6 py-3 rounded-lg text-sm font-orbitron tracking-wide"
          style={{ background: "#2a0a0a", border: "1px solid #6a2a2a", color: "#ff6a6a" }}>
          Payment cancelled. No charge was made.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-2xl">
        {CREDIT_PACKS.map(pack => {
          const isLoading = loading === pack.id;
          const priceDisplay = `$${(pack.price / 100).toFixed(0)}`;
          const centsEach = (pack.price / pack.credits).toFixed(0);

          return (
            <div key={pack.id}
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
              <div className="text-gray-500 text-sm mb-1">credits</div>
              <div className="text-gray-600 text-xs mb-4">{centsEach}¢ each</div>
              <div className="font-orbitron font-black text-xl text-white mb-6">
                {priceDisplay}
              </div>
              <button
                onClick={() => handleBuy(pack.id)}
                disabled={!!loading}
                className="mt-auto py-3 rounded-lg font-orbitron font-bold text-xs tracking-widest transition-opacity"
                style={{
                  background: pack.highlight ? "#4488ff33" : "#4488ff22",
                  border: `1px solid ${pack.highlight ? "#4488ff88" : "#4488ff44"}`,
                  color: "#4488ff",
                  opacity: loading ? 0.5 : 1,
                  cursor: loading ? "not-allowed" : "pointer",
                }}>
                {isLoading ? "REDIRECTING…" : "BUY NOW"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-gray-600 text-xs mt-10">
        Payments are processed securely by Stripe. Credits are added instantly after payment.
      </p>
    </main>
  );
}

export default function CreditsPage() {
  return (
    <Suspense>
      <CreditsInner />
    </Suspense>
  );
}
