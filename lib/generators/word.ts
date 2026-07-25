export interface WordPuzzle {
  title: string;
  topic: string;
  words: string[];       // the hidden words (uppercase, 3-10 chars)
  grid: string[][];      // 12x12 letter grid
  clues: string[];       // one clue per word (same order)
}

const SYSTEM_PROMPT = `You are a word search puzzle designer. Given a theme, output a word search puzzle.

Output ONLY valid JSON, no markdown. Schema:
{
  "title": string,
  "topic": string,
  "words": string[] (exactly 10 thematic words, uppercase, 4-9 letters each, no spaces),
  "grid": string[][] (12 rows × 12 cols of uppercase letters; the 10 words must be hidden horizontally left-to-right or vertically top-to-bottom; remaining cells filled with random uppercase letters),
  "clues": string[] (one short clue per word, same order as words array, max 60 chars each)
}

Critical grid rules:
- The grid must be exactly 12 rows, each row exactly 12 uppercase letters
- Every word in the words array must appear in the grid exactly once, either left-to-right on a row or top-to-bottom on a column
- No diagonal words
- Fill remaining cells with random uppercase consonants (B,C,D,F,G,H,J,K,L,M,N,P,R,S,T,V,W,X,Z)
- Return grid as array of 12 strings, each string exactly 12 characters`;

function placeWordsInGrid(words: string[]): { grid: string[][]; placed: string[] } {
  const ROWS = 12, COLS = 12;
  const grid: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
  const FILL = "BCDFGHJKLMNPRSTVWXZ";
  const placed: string[] = [];

  const canPlaceH = (word: string, r: number, c: number) => {
    if (c + word.length > COLS) return false;
    for (let i = 0; i < word.length; i++) {
      const existing = grid[r][c + i];
      if (existing && existing !== word[i]) return false;
    }
    return true;
  };
  const canPlaceV = (word: string, r: number, c: number) => {
    if (r + word.length > ROWS) return false;
    for (let i = 0; i < word.length; i++) {
      const existing = grid[r + i][c];
      if (existing && existing !== word[i]) return false;
    }
    return true;
  };

  for (const word of words) {
    let attempts = 0;
    let success = false;
    while (attempts < 200 && !success) {
      const horiz = Math.random() < 0.5;
      const r = Math.floor(Math.random() * ROWS);
      const c = Math.floor(Math.random() * COLS);
      if (horiz && canPlaceH(word, r, c)) {
        for (let i = 0; i < word.length; i++) grid[r][c + i] = word[i];
        success = true;
      } else if (!horiz && canPlaceV(word, r, c)) {
        for (let i = 0; i < word.length; i++) grid[r + i][c] = word[i];
        success = true;
      }
      attempts++;
    }
    if (success) placed.push(word);
  }

  // Fill empty cells
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (!grid[r][c]) grid[r][c] = FILL[Math.floor(Math.random() * FILL.length)];

  return { grid, placed };
}

export async function generateWordPuzzle(prompt: string): Promise<WordPuzzle> {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is not set");

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Generate a word search about: ${prompt}. Focus on generating the words and clues; I will build the grid myself.` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "(unreadable)");
    throw new Error(`DeepSeek API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error(`DeepSeek returned no content: ${JSON.stringify(data)}`);

  let raw: { title: string; topic: string; words: string[]; clues: string[] };
  try { raw = JSON.parse(rawContent); }
  catch (e) { throw new Error(`Failed to parse DeepSeek JSON: ${e}. Raw: ${rawContent.slice(0, 500)}`); }

  // Sanitize words: uppercase, letters only, 4-9 chars
  const cleanWords = (raw.words ?? [])
    .map((w: string) => w.toUpperCase().replace(/[^A-Z]/g, ""))
    .filter((w: string) => w.length >= 4 && w.length <= 9)
    .slice(0, 10);

  // Build grid server-side (reliable placement)
  const { grid, placed } = placeWordsInGrid(cleanWords);
  const placedSet = new Set(placed);
  const finalWords = cleanWords.filter((w: string) => placedSet.has(w));
  const finalClues = finalWords.map((w: string) => {
    const idx = cleanWords.indexOf(w);
    return raw.clues?.[idx] ?? w;
  });

  return {
    title: raw.title ?? "Word Search",
    topic: raw.topic ?? prompt,
    words: finalWords,
    grid,
    clues: finalClues,
  };
}
