"use client";
import { useState, useCallback } from "react";
import type { SolitaireScenario, PlayingCard } from "@/lib/generators/card";

const RED = "#ef4444";
const BLACK = "#e2e8f0";
const isRed = (c: PlayingCard) => c.suit === "♥" || c.suit === "♦";

const VALUES_ORDER = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const valIdx = (v: string) => VALUES_ORDER.indexOf(v);

function CardView({ card, faceDown, selected, small, onClick }: {
  card?: PlayingCard; faceDown?: boolean; selected?: boolean; small?: boolean; onClick?: () => void;
}) {
  const w = small ? 44 : 56, h = small ? 64 : 80;
  if (!card) return (
    <div style={{ width: w, height: h, borderRadius: 6, border: "1px dashed #1e2a4a", flexShrink: 0 }} />
  );
  if (faceDown) return (
    <div onClick={onClick} style={{ width: w, height: h, borderRadius: 6, border: "1px solid #1e2a4a", background: "#070d20", flexShrink: 0, cursor: onClick ? "pointer" : "default", boxShadow: selected ? "0 0 0 2px #4488ff" : undefined }} />
  );
  const color = isRed(card) ? RED : BLACK;
  const fs = small ? 9 : 11;
  return (
    <div onClick={onClick}
      style={{ width: w, height: h, borderRadius: 6, border: `1px solid ${selected ? "#4488ff" : "#2a3a5a"}`, background: "#0c1428", flexShrink: 0, cursor: onClick ? "pointer" : "default", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 4, boxShadow: selected ? "0 0 0 2px #4488ff" : undefined, userSelect: "none" }}>
      <div style={{ color, fontSize: fs, fontWeight: "bold", lineHeight: 1 }}>{card.value}<br />{card.suit}</div>
      <div style={{ color, fontSize: small ? 16 : 20, textAlign: "center" }}>{card.suit}</div>
      <div style={{ color, fontSize: fs, fontWeight: "bold", lineHeight: 1, transform: "rotate(180deg)" }}>{card.value}<br />{card.suit}</div>
    </div>
  );
}

// ── Klondike Engine ──────────────────────────────────────────────────────────

function initKlondike(deck: PlayingCard[]) {
  const d = [...deck];
  const tableau: PlayingCard[][] = Array.from({ length: 7 }, () => []);
  for (let col = 0; col < 7; col++)
    for (let row = 0; row <= col; row++)
      tableau[col].push(d.shift()!);
  return { tableau, stock: d, waste: [] as PlayingCard[], foundation: [[], [], [], []] as PlayingCard[][] };
}

function KlondikeGame({ scenario }: { scenario: SolitaireScenario }) {
  const [state, setState] = useState(() => initKlondike(scenario.deck));
  const [sel, setSel] = useState<{ pile: string; idx: number } | null>(null);
  const [won, setWon] = useState(false);

  const checkWin = (foundation: PlayingCard[][]) => foundation.every(f => f.length === 13);

  const flipStock = useCallback(() => {
    setSel(null);
    setState(s => {
      if (s.stock.length === 0) return { ...s, stock: [...s.waste].reverse(), waste: [] };
      const card = s.stock[s.stock.length - 1];
      return { ...s, stock: s.stock.slice(0, -1), waste: [...s.waste, card] };
    });
  }, []);

  const canStack = (card: PlayingCard, onto: PlayingCard | undefined) => {
    if (!onto) return card.value === "K";
    return valIdx(card.value) === valIdx(onto.value) - 1 && isRed(card) !== isRed(onto);
  };

  const canFoundation = (card: PlayingCard, foundation: PlayingCard[]) => {
    if (foundation.length === 0) return card.value === "A";
    const top = foundation[foundation.length - 1];
    return card.suit === top.suit && valIdx(card.value) === valIdx(top.value) + 1;
  };

  const clickWaste = () => {
    if (!state.waste.length) return;
    const card = state.waste[state.waste.length - 1];
    if (sel) { setSel(null); return; }
    setSel({ pile: "waste", idx: 0 });
    // Try auto-foundation
    const fi = state.foundation.findIndex(f => canFoundation(card, f));
    if (fi >= 0) {
      setState(s => {
        const foundation = s.foundation.map((f, i) => i === fi ? [...f, card] : f);
        const waste = s.waste.slice(0, -1);
        if (checkWin(foundation)) setWon(true);
        return { ...s, waste, foundation };
      });
      setSel(null);
    }
  };

  const clickTableau = (col: number) => {
    const pile = state.tableau[col];
    const topCard = pile[pile.length - 1];
    if (!topCard) {
      if (sel) {
        // Move selection here
        setState(s => {
          const newTab = s.tableau.map(p => [...p]);
          if (sel.pile === "waste") {
            const card = s.waste[s.waste.length - 1];
            if (canStack(card, undefined)) { newTab[col].push(card); return { ...s, tableau: newTab, waste: s.waste.slice(0, -1) }; }
          } else if (sel.pile.startsWith("tab-")) {
            const fromCol = parseInt(sel.pile.split("-")[1]);
            const cards = newTab[fromCol].splice(sel.idx);
            if (cards.length && canStack(cards[0], undefined)) { newTab[col].push(...cards); return { ...s, tableau: newTab }; }
            else { newTab[fromCol].push(...cards); }
          }
          return s;
        });
        setSel(null);
      }
      return;
    }

    if (sel) {
      // Try to place selection here
      setState(s => {
        const newTab = s.tableau.map(p => [...p]);
        const onto = newTab[col][newTab[col].length - 1];
        if (sel.pile === "waste") {
          const card = s.waste[s.waste.length - 1];
          if (canStack(card, onto)) { newTab[col].push(card); return { ...s, tableau: newTab, waste: s.waste.slice(0, -1) }; }
        } else if (sel.pile.startsWith("tab-")) {
          const fromCol = parseInt(sel.pile.split("-")[1]);
          const cards = newTab[fromCol].splice(sel.idx);
          if (cards.length && canStack(cards[0], onto)) { newTab[col].push(...cards); return { ...s, tableau: newTab }; }
          else { newTab[fromCol].push(...cards); }
        }
        return s;
      });
      setSel(null);
    } else {
      // Try auto-foundation first
      const fi = state.foundation.findIndex(f => canFoundation(topCard, f));
      if (fi >= 0 && pile.length - 1 === pile.length - 1) { // only move top card
        setState(s => {
          const newTab = s.tableau.map(p => [...p]);
          const card = newTab[col].pop()!;
          const foundation = s.foundation.map((f, i) => i === fi ? [...f, card] : f);
          if (checkWin(foundation)) setWon(true);
          return { ...s, tableau: newTab, foundation };
        });
      } else {
        setSel({ pile: `tab-${col}`, idx: pile.length - 1 });
      }
    }
  };

  const clickFoundation = (fi: number) => {
    if (!sel) return;
    setState(s => {
      const foundation = s.foundation.map(f => [...f]);
      if (sel.pile === "waste") {
        const card = s.waste[s.waste.length - 1];
        if (canFoundation(card, foundation[fi])) {
          foundation[fi].push(card);
          if (checkWin(foundation)) setWon(true);
          return { ...s, waste: s.waste.slice(0, -1), foundation };
        }
      } else if (sel.pile.startsWith("tab-")) {
        const fromCol = parseInt(sel.pile.split("-")[1]);
        const newTab = s.tableau.map(p => [...p]);
        const top = newTab[fromCol][newTab[fromCol].length - 1];
        if (canFoundation(top, foundation[fi])) {
          newTab[fromCol].pop();
          foundation[fi].push(top);
          if (checkWin(foundation)) setWon(true);
          return { ...s, tableau: newTab, foundation };
        }
      }
      return s;
    });
    setSel(null);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] px-3 py-4" style={{ background: "#05071a" }}>
      <div className="max-w-3xl mx-auto w-full">
        <div className="text-center mb-4">
          <div className="font-orbitron font-black text-lg text-white">{scenario.title}</div>
          <div className="text-gray-500 text-xs">{scenario.flavour}</div>
        </div>

        {won && (
          <div className="text-center py-3 rounded-xl mb-4 font-orbitron font-black"
            style={{ background: "#ffd70022", border: "2px solid #ffd700", color: "#ffd700" }}>
            🏆 YOU WIN!
          </div>
        )}

        {/* Top row: stock, waste, gap, 4 foundations */}
        <div className="flex items-start gap-2 mb-4 flex-wrap">
          <CardView card={state.stock[state.stock.length - 1]} faceDown onClick={flipStock} />
          <CardView card={state.waste[state.waste.length - 1]} selected={sel?.pile === "waste"} onClick={clickWaste} />
          <div className="flex-1" />
          {state.foundation.map((f, fi) => (
            <CardView key={fi} card={f[f.length - 1]} selected={false} onClick={() => clickFoundation(fi)} />
          ))}
        </div>

        {/* Tableau */}
        <div className="flex gap-2 items-start">
          {state.tableau.map((pile, col) => (
            <div key={col} className="flex flex-col" style={{ minHeight: 80, flex: 1 }}>
              {pile.length === 0 ? (
                <CardView card={undefined} onClick={() => clickTableau(col)} />
              ) : pile.map((card, i) => (
                <div key={i} style={{ marginTop: i === 0 ? 0 : -60, zIndex: i }}>
                  <CardView card={card} small
                    selected={sel?.pile === `tab-${col}` && i >= sel.idx}
                    onClick={() => i === pile.length - 1 ? clickTableau(col) : undefined} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-4 text-center">
          <div className="font-orbitron text-xs text-gray-600 mb-2">RULES</div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {scenario.rules.map((r, i) => (
              <span key={i} className="text-gray-600 text-xs">• {r}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CardGame({ scenario }: { scenario: SolitaireScenario }) {
  return <KlondikeGame scenario={scenario} />;
}
