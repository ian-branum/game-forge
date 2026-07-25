export interface TriviaQuestion {
  q: string;
  options: [string, string, string, string];
  answer: number; // 0-3
  explanation: string;
}

export interface TriviaScenario {
  title: string;
  topic: string;
  questions: TriviaQuestion[];
}

const SYSTEM_PROMPT = `You are a trivia game designer. Given a topic, generate a quiz with exactly 8 multiple-choice questions.

Output ONLY valid JSON, no markdown, no explanation. Schema:
{
  "title": string (catchy quiz title),
  "topic": string (the subject area),
  "questions": [
    {
      "q": string (the question, max 120 chars),
      "options": [string, string, string, string] (exactly 4 options, each max 60 chars),
      "answer": number (0-3, index of correct option),
      "explanation": string (1 sentence explaining the correct answer, max 100 chars)
    }
  ]
}

Rules:
- Exactly 8 questions
- Mix difficulty: 2 easy, 4 medium, 2 hard
- Wrong options should be plausible, not obviously silly
- Vary the position of the correct answer (don't always put it at index 0 or 1)
- Keep all strings concise to stay within token limits`;

export async function generateTriviaScenario(prompt: string): Promise<TriviaScenario> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY is not set in environment variables");
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Generate a trivia quiz about: ${prompt}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "(unreadable)");
    throw new Error(`DeepSeek API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error(`DeepSeek returned no content. Full response: ${JSON.stringify(data)}`);

  let raw: TriviaScenario;
  try {
    raw = JSON.parse(rawContent);
  } catch (e) {
    throw new Error(`Failed to parse DeepSeek JSON: ${e}. Raw: ${rawContent.slice(0, 500)}`);
  }

  if (!raw.questions?.length) throw new Error("DeepSeek returned no questions");
  return raw;
}
