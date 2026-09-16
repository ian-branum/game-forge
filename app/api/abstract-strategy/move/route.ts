import { NextRequest, NextResponse } from "next/server";
import { fenToPosition, legalMoves, squareName, PieceType } from "@/games/abstract-strategy/games/chess-engine";

// POST body: { fen: string, history: string[], aiPersonality?: string }
// Response:  { move: string }  on success
//            { move: null, resigned: true, error?: string }  when no legal move can be obtained

interface RequestBody {
  fen?: string;
  history?: string[];
  aiPersonality?: string;
}

/** Turn a legal move into the "from-to" coordinate format we ask the model for. */
function moveToCoord(from: { r: number; c: number }, to: { r: number; c: number }, promotion?: PieceType): string {
  const base = squareName(from) + squareName(to);
  return promotion && promotion !== "Q" ? base + promotion.toLowerCase() : base;
}

export async function POST(req: NextRequest) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json({ error: "DEEPSEEK_API_KEY is not set" }, { status: 500 });
  }

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { fen, history, aiPersonality } = body;
  if (!fen) {
    return NextResponse.json({ error: "Missing fen" }, { status: 400 });
  }

  let position;
  try {
    position = fenToPosition(fen);
  } catch {
    return NextResponse.json({ error: "Invalid FEN" }, { status: 400 });
  }

  const legal = legalMoves(position);
  if (legal.length === 0) {
    return NextResponse.json({ move: null, resigned: false, error: "No legal moves available" }, { status: 200 });
  }

  // Help the model by listing every legal move in the requested format.
  const legalList = legal.map(m => moveToCoord(m.from, m.to, m.promotion)).join(", ");
  const personality = aiPersonality ? `Your playing personality is: ${aiPersonality}.` : "";

  const legalSet = new Set(legal.map(m => moveToCoord(m.from, m.to, m.promotion)));
  const legalSetNoPromo = new Set(legal.map(m => squareName(m.from) + squareName(m.to)));

  const systemPrompt = `You are a strong chess engine playing as Black. ${personality}
You are given a position as a FEN string and the move history. Respond with EXACTLY ONE legal move.

Output ONLY valid JSON:
{ "move": string }

The move must be in "from-to" coordinate notation, e.g. "e7e5" or "g8f6". For pawn promotion append the piece letter, e.g. "e7e8q".
You MUST choose a move from this list of legal moves:
${legalList}

Do not explain. Do not include algebraic notation. Only output the JSON object.`;

  const historyText = history && history.length > 0 ? history.join(" ") : "(none)";

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `FEN: ${fen}\nMove history: ${historyText}\nPlay your move as Black.` },
  ];

  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const attemptMessages = attempt === 0
      ? messages
      : [...messages, {
          role: "user",
          content: `Your previous response "${lastError}" was not a legal move. Respond again with ONLY a JSON object {"move": string} using one of these legal moves: ${legalList}`,
        }];

    let content: string | undefined;
    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          messages: attemptMessages,
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 128,
          reasoning_effort: "none",
        }),
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "(unreadable)");
        lastError = `API ${response.status}: ${errBody.slice(0, 200)}`;
        continue;
      }

      const data = await response.json();
      content = data.choices?.[0]?.message?.content;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      continue;
    }

    if (!content) { lastError = "(no content)"; continue; }

    let rawMove: unknown;
    try {
      const parsed = JSON.parse(content) as { move?: unknown };
      rawMove = parsed.move;
    } catch {
      // The model may have replied with a bare move string.
      rawMove = content;
    }

    if (typeof rawMove !== "string") { lastError = String(rawMove); continue; }

    const candidate = rawMove.trim().toLowerCase().replace(/[\s\-x]/g, "");
    if (legalSet.has(candidate) || legalSetNoPromo.has(candidate)) {
      // Normalise promotions: bare "e7e8" resolves to the queen-promotion entry.
      const normalised = legalSet.has(candidate) ? candidate : candidate + "q";
      return NextResponse.json({ move: normalised });
    }

    lastError = rawMove;
  }

  // Both attempts failed — the AI forfeits.
  return NextResponse.json({ move: null, resigned: true, error: lastError }, { status: 200 });
}
