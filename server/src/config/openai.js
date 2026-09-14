import OpenAI from 'openai';

let openaiClient = null;

export function getOpenAIClient() {
  if (openaiClient) return openaiClient;

  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.bazaarlink.ai/v1';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  openaiClient = new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  return openaiClient;
}

export function getAgentModel() {
  return process.env.OPENAI_AGENT_MODEL || 'gpt-4o-mini';
}

export function getEmbeddingModel() {
  return process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
}

export async function generateOpenAIResponse({
  systemPrompt,
  messages,
  temperature = 0.2,
  maxTokens = 2048,
  responseFormat = { type: 'json_object' }
}) {
  const client = getOpenAIClient();
  const model = getAgentModel();

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'assistant' : m.role,
      content: m.content
    }))
  ];

  const response = await client.chat.completions.create({
    model,
    messages: formattedMessages,
    temperature,
    max_tokens: maxTokens,
    response_format: responseFormat,
  });

  const text = response.choices[0]?.message?.content?.trim();

  if (!text) {
    throw new Error('OpenAI response was empty');
  }

  return { text, model };
}

export async function generateOpenAIEmbedding(text) {
  const client = getOpenAIClient();
  const model = getEmbeddingModel();

  const response = await client.embeddings.create({
    model,
    input: text,
  });

  return response.data[0]?.embedding || [];
}

export function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}