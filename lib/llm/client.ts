import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function isLLMConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function getLLMClient(): OpenAI {
  if (!_client) {
    if (!isLLMConfigured()) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

export async function completeChat(
  system: string,
  messages: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>,
  maxTokens = 512
): Promise<string> {
  const client = getLLMClient();
  const response = await client.chat.completions.create({
    model: 'gpt-5.4',
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      ...messages,
    ],
  });
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error('Unexpected LLM response');
  return text;
}

export async function complete(system: string, userMessage: string, maxTokens = 512): Promise<string> {
  const client = getLLMClient();
  const response = await client.chat.completions.create({
    model: 'gpt-5.4',
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
  });
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error('Unexpected LLM response');
  return text;
}
