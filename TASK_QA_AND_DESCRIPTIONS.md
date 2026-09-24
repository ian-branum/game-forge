# TASK: QA Gate + Longer Descriptions + Retry UX in /api/generate

## Overview
Three changes:
1. Add a DeepSeek-powered QA check that runs in parallel with `generateDescription`
2. If QA fails, **auto-retry once** and surface a friendly status message to the user during the wait
3. Make marketplace descriptions ~2x longer

---

## Change 1: Switch /api/generate to Server-Sent Events (SSE)

The route currently returns a single JSON blob. To surface a "retrying" message to the user mid-request without a full streaming rewrite, switch to SSE. The client reads events and handles two message types:

- `status` — informational message to display in the UI during loading
- `done` — final result (success with `id`, or error with `error` + `issues`)

### API route changes

Replace `NextResponse.json(...)` with an SSE `Response`:

```ts
// Helper to create SSE response
function sseStream(handler: (send: (event: string, data: object) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        await handler(send);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

Early exits (auth failure, missing params, unknown gameType, insufficient credits) can still return plain `NextResponse.json` error responses — SSE only applies to the generation path.

### Generation flow inside the SSE handler

```ts
return sseStream(async (send) => {
  // First attempt
  let payload = await plugin.generate(prompt);
  plugin.validate(payload);
  const html = (payload as { html?: string }).html;

  let [description, qaResult] = await Promise.all([
    generateDescription(prompt, title, gameType),
    html ? runQACheck(html) : Promise.resolve({ pass: true }),
  ]);

  // If QA fails, retry once
  if (!qaResult.pass) {
    console.warn("[/api/generate] QA failed, retrying:", qaResult.issues);
    send("status", {
      message: "My first attempt wasn't great. Let me try again — hang in there! 🛠️",
    });

    payload = await plugin.generate(prompt);
    plugin.validate(payload);
    const html2 = (payload as { html?: string }).html;

    [description, qaResult] = await Promise.all([
      generateDescription(prompt, title, gameType),
      html2 ? runQACheck(html2) : Promise.resolve({ pass: true }),
    ]);

    // If second attempt also fails, proceed anyway (fail open — better a potentially
    // imperfect game than a dead end for the user)
    if (!qaResult.pass) {
      console.warn("[/api/generate] QA failed on retry too, proceeding anyway:", qaResult.issues);
    }
  }

  // Write to DB
  const [scenario] = await prisma.$transaction([
    prisma.scenario.create({ ... }), // unchanged
    prisma.user.update({ ... }),
    prisma.creditTransaction.create({ ... }),
  ]);

  send("done", { id: scenario.id });
});
```

**Fail-open policy on second attempt:** Don't block the user. Log the issues, save the game anyway. The QA gate is a quality improvement, not a hard blocker.

---

## Change 2: New `runQACheck` function

```ts
const QA_MODEL = "deepseek-v4-flash";

const QA_SYSTEM_PROMPT = `You are a senior browser game QA engineer. You will be given the full HTML source of a self-contained browser game. Your job is to identify bugs that would cause the game to be visually broken or unplayable on first load.

Check specifically for:
1. BLANK RENDER: Canvas element present but getContext('2d') never called, or canvas dimensions are 0
2. DEAD LOOP: Game loop (requestAnimationFrame or setInterval) never started, or only starts on an event that hasn't fired
3. DEAD INPUT: Click/keydown/touchstart handlers not attached, or attached to the wrong element
4. INVISIBLE PIECES: Game state initialised but draw() never called on first load
5. SILENT CRASH: Obvious JS errors that would throw on init (undefined variable, missing function call)
6. MISSING INIT: Game setup function defined but never called

Do NOT flag style issues, performance concerns, missing features, or anything that works but could be better.

Respond in this exact JSON format (no markdown, no preamble):
{"pass": true}
or
{"pass": false, "issues": ["brief description of issue 1"]}`;

async function runQACheck(html: string): Promise<{ pass: boolean; issues?: string[] }> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { pass: true };

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: QA_MODEL,
        messages: [
          { role: "system", content: QA_SYSTEM_PROMPT },
          { role: "user", content: `Review this game HTML:\n\n${html}` },
        ],
        temperature: 0,
        max_tokens: 200,
        reasoning_effort: "none",
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) return { pass: true };
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { pass: true };
    const result = JSON.parse(content);
    return { pass: result.pass === true, issues: result.issues ?? [] };
  } catch {
    return { pass: true };
  }
}
```

---

## Change 3: Frontend — consume SSE in forge/page.tsx

Replace the `fetch("/api/generate", ...)` call in `handleGenerate()` with an SSE reader:

```ts
async function handleGenerate() {
  if (!prompt.trim()) return;
  if (!session) { signIn(); return; }
  setLoading(true);
  setStatusMessage(null);  // new state: string | null
  setError(null);

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, category }),
    });

    // Handle non-SSE early errors (auth, validation, etc.)
    if (!res.ok) {
      const data = await res.json();
      setError({ message: `HTTP ${res.status}: ${data.error ?? "Unknown error"}`, detail: data.stack });
      setLoading(false);
      return;
    }

    // Read SSE stream
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const block of events) {
        const eventLine = block.match(/^event: (.+)$/m)?.[1];
        const dataLine = block.match(/^data: (.+)$/m)?.[1];
        if (!eventLine || !dataLine) continue;

        const payload = JSON.parse(dataLine);

        if (eventLine === "status") {
          setStatusMessage(payload.message);
        } else if (eventLine === "done") {
          if (payload.id) {
            router.push(`/play/${payload.id}`);
          } else {
            setError({ message: payload.error ?? "Unknown error" });
            setLoading(false);
          }
        }
      }
    }
  } catch (e) {
    setError({ message: `Network error: ${e instanceof Error ? e.message : String(e)}` });
    setLoading(false);
  }
}
```

Add `statusMessage` state and display it below the "FORGING..." button:

```tsx
const [statusMessage, setStatusMessage] = useState<string | null>(null);

// In JSX, below the Forge button:
{loading && statusMessage && (
  <p className="text-blue-400 text-sm text-center mt-3 font-orbitron animate-pulse">
    {statusMessage}
  </p>
)}
```

---

## Change 4: Longer Descriptions

**System prompt** (replace in `generateDescription`):
```ts
const DESCRIPTION_SYSTEM_PROMPT =
  "You are a game curator. Write 2–3 punchy sentences (max 300 characters total) describing this game for a marketplace listing. Cover: what type of game it is, what makes it interesting or unique, and what the player does. No preamble, no quotes — just the sentences.";
```

**max_tokens** (replace):
```ts
max_tokens: 160,
```

---

## Scope
- `app/api/generate/route.ts` — SSE, QA function, retry logic, longer descriptions
- `app/forge/page.tsx` — SSE reader, statusMessage state + display

## Acceptance
- Normal generation (QA passes): user sees "FORGING..." → redirected to game. No change from today.
- QA fails on first attempt: user sees "FORGING..." then the retry message appears mid-wait → redirected to game
- If both attempts fail QA: game saves anyway, user is redirected (fail open)
- QA infrastructure failure (API down, bad key): fails open, no impact on user
- Descriptions are visibly 2–3 sentences vs current 1-liner
- Early error responses (401, 400, 402) still work as plain JSON — SSE only applies to the generation path

## Context
- Stack: Next.js, TypeScript, DeepSeek API (`deepseek-v4-flash`)
- `DEEPSEEK_API_KEY` already in env
- Only sandbox game type has `.html` in payload — the `html ?` guard handles tactical/narrative
- Retry message: `"My first attempt wasn't great. Let me try again — hang in there! 🛠️"`
