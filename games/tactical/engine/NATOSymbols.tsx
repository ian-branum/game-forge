"use client";

// ─── NATO symbology ───────────────────────────────────────────────────────────
// Shared by the tactical game (gameplay) and the scenario editor so counters and
// palette chips always look identical.

/** Gameplay counter colors (as used on the battle map). */
export const FACTION_FILL: Record<string, string> = { allied: "#4a5e2a", axis: "#6b7355" };
export const FACTION_STROKE: Record<string, string> = { allied: "#a0b860", axis: "#c8ceb0" };

/** Editor palette/chip colors — cooler blue for allied, warm brown for axis. */
export const EDITOR_FACTION_FILL: Record<string, string> = { allied: "#2a3d6e", axis: "#4a3010" };
export const EDITOR_FACTION_STROKE: Record<string, string> = { allied: "#6080c0", axis: "#b08040" };

export type NATOProps = { fill: string; stroke: string; opacity?: number };

export function NATOInfantry({ fill, stroke, opacity = 1 }: NATOProps) {
  return (
    <g opacity={opacity}>
      <rect x="2" y="7" width="32" height="18" fill={fill} stroke={stroke} strokeWidth="1.5" rx="1" />
      <line x1="2" y1="7" x2="34" y2="25" stroke={stroke} strokeWidth="1.5" />
      <line x1="34" y1="7" x2="2" y2="25" stroke={stroke} strokeWidth="1.5" />
      <circle cx="13" cy="3.5" r="2" fill={stroke} />
      <circle cx="23" cy="3.5" r="2" fill={stroke} />
    </g>
  );
}

/** Assault squad — infantry frame with a close-combat bar across the base. */
export function NATOAssault({ fill, stroke, opacity = 1 }: NATOProps) {
  return (
    <g opacity={opacity}>
      <rect x="2" y="7" width="32" height="18" fill={fill} stroke={stroke} strokeWidth="1.5" rx="1" />
      <line x1="2" y1="7" x2="34" y2="25" stroke={stroke} strokeWidth="1.5" />
      <line x1="34" y1="7" x2="2" y2="25" stroke={stroke} strokeWidth="1.5" />
      <line x1="11" y1="21" x2="25" y2="21" stroke={stroke} strokeWidth="2.5" />
      <circle cx="13" cy="3.5" r="2" fill={stroke} />
      <circle cx="23" cy="3.5" r="2" fill={stroke} />
    </g>
  );
}

export function NATOMG({ fill, stroke, opacity = 1 }: NATOProps) {
  return (
    <g opacity={opacity}>
      <rect x="2" y="7" width="32" height="18" fill={fill} stroke={stroke} strokeWidth="1.5" rx="1" />
      <line x1="2" y1="7" x2="34" y2="25" stroke={stroke} strokeWidth="1.5" />
      <line x1="34" y1="7" x2="2" y2="25" stroke={stroke} strokeWidth="1.5" />
      <text x="18" y="20" textAnchor="middle" fontSize="7" fill={stroke} fontWeight="bold" fontFamily="monospace">MG</text>
      <circle cx="18" cy="3.5" r="2" fill={stroke} />
    </g>
  );
}

/** Mortar — plain frame with a single filled dot (NATO APP-6). */
export function NATOMortar({ fill, stroke, opacity = 1 }: NATOProps) {
  return (
    <g opacity={opacity}>
      <rect x="1" y="5" width="34" height="16" fill={fill} stroke={stroke} strokeWidth="1.5" rx="1" />
      <circle cx="18" cy="13" r="4" fill={stroke} />
    </g>
  );
}

export function NATOLeader({ fill, stroke, label, opacity = 1 }: NATOProps & { label: string }) {
  return (
    <g opacity={opacity}>
      <rect x="2" y="4" width="32" height="20" fill={fill} stroke={stroke} strokeWidth="1.5" rx="1" />
      <text x="18" y="17" textAnchor="middle" fontSize="7.5" fill={stroke} fontWeight="bold" fontFamily="monospace">
        {label}
      </text>
    </g>
  );
}

/** Parse a leader's name into a NATO echelon label. */
export function leaderLabel(name: string): string {
  const n = name.toLowerCase();
  return n.includes("plt") || n.includes("platoon") ? "PLT"
    : n.includes("coy") || n.includes("company") || n.includes("cdr") ? "COY"
    : n.includes("1sg") || n.includes("first sgt") ? "1SG"
    : n.includes("sgt") || n.includes("sergeant") || n.includes("feldwebel") ? "SGT"
    : n.includes("lt") || n.includes("lieutenant") || n.includes("leutnant") ? "LT"
    : "LDR";
}

/**
 * Draw the symbol for a unit type using explicit colors.
 * Accepts any object shaped like `{ type, name? }` so both engine `Unit`s and
 * plain scenario definitions can be rendered.
 */
export function NATOTypeSymbol({
  type,
  name = "",
  fill,
  stroke,
  opacity = 1,
}: {
  type: string;
  name?: string;
  fill: string;
  stroke: string;
  opacity?: number;
}) {
  if (type === "leader") {
    return <NATOLeader fill={fill} stroke={stroke} label={leaderLabel(name)} opacity={opacity} />;
  }
  if (type === "assault") return <NATOAssault fill={fill} stroke={stroke} opacity={opacity} />;
  if (type === "mg") return <NATOMG fill={fill} stroke={stroke} opacity={opacity} />;
  if (type === "mortar") return <NATOMortar fill={fill} stroke={stroke} opacity={opacity} />;
  return <NATOInfantry fill={fill} stroke={stroke} opacity={opacity} />;
}

/** Symbol for a full unit, colored by faction (gameplay palette). */
export function NATOSymbol({
  unit,
  opacity,
  fill,
  stroke,
}: {
  unit: { faction: string; type: string; name: string };
  opacity?: number;
  fill?: string;
  stroke?: string;
}) {
  return (
    <NATOTypeSymbol
      type={unit.type}
      name={unit.name}
      fill={fill ?? FACTION_FILL[unit.faction] ?? "#666"}
      stroke={stroke ?? FACTION_STROKE[unit.faction] ?? "#999"}
      opacity={opacity ?? 1}
    />
  );
}
