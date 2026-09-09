const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function hasGemini() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function getGeminiModel() {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

export async function generateGeminiResponse({ systemPrompt, messages, temperature = 0.2 }) {
  const model = getGeminiModel();
  const response = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: messages
        .filter(message => message.role !== 'system')
        .map(message => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        })),
      generationConfig: {
        temperature,
        maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '2048', 10)
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts
    ?.map(part => part.text || '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini response was empty');
  }

  return { text, model };
}
