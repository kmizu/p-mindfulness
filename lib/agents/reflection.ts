import type { ConversationMessage, ReflectionProfile, UserMemory } from './types';
import { detectCrisis } from '@/lib/supervisor/rules';
import { completeChat, complete } from '@/lib/llm/client';
import { buildReflectionSystemPrompt, buildExtractionPrompt } from '@/prompts/reflection';

export interface ReflectionTurnResult {
  readonly agentMessage: string;
  readonly userTurnCount: number;
  readonly done: boolean;
  readonly crisis: boolean;
  readonly profile?: ReflectionProfile;
}

export async function reflectionTurn(
  messages: readonly ConversationMessage[],
  locale: string,
  hasHistory: boolean,
  memory: UserMemory | null
): Promise<ReflectionTurnResult> {
  // Crisis check on latest user message — synchronous, before any LLM call
  if (messages.length > 0) {
    const last = messages[messages.length - 1];
    if (last.role === 'user' && detectCrisis(last.content)) {
      return {
        agentMessage: locale === 'ja'
          ? 'このアプリは今必要なサポートを提供できません。信頼できる人や危機相談窓口に連絡してください。'
          : "This app isn't the right support for what you're going through. Please reach out to someone you trust or a crisis line.",
        userTurnCount: countUserTurns(messages),
        done: false,
        crisis: true,
      };
    }
  }

  const systemPrompt = buildReflectionSystemPrompt(locale, hasHistory, memory ?? undefined);
  const chatHistory = messages.map(m => ({
    role: m.role === 'agent' ? 'assistant' as const : 'user' as const,
    content: m.content,
  }));

  const raw = await completeChat(systemPrompt, chatHistory, 200);
  const userTurnCount = countUserTurns(messages);

  if (raw.includes('[CRISIS_DETECTED]')) {
    return {
      agentMessage: locale === 'ja'
        ? 'このアプリは今必要なサポートを提供できません。信頼できる人や危機相談窓口に連絡してください。'
        : "This app isn't the right support for what you're going through. Please reach out to someone you trust or a crisis line.",
      userTurnCount,
      done: false,
      crisis: true,
    };
  }

  const cleanMessage = raw
    .replace('[REFLECTION_COMPLETE]', '')
    .replace('[CRISIS_DETECTED]', '')
    .trim();

  const isDone = raw.includes('[REFLECTION_COMPLETE]') || userTurnCount >= 3;

  if (isDone) {
    const fullConversation: readonly ConversationMessage[] = [
      ...messages,
      { role: 'agent', content: cleanMessage },
    ];
    const profile = await extractProfile(fullConversation, locale);
    return { agentMessage: cleanMessage, userTurnCount, done: true, crisis: false, profile };
  }

  return { agentMessage: cleanMessage, userTurnCount, done: false, crisis: false };
}

async function extractProfile(
  messages: readonly ConversationMessage[],
  locale: string
): Promise<ReflectionProfile> {
  const prompt = buildExtractionPrompt(messages, locale);
  const raw = await complete('You extract structured data from conversations. Return only valid JSON.', prompt, 400);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in extraction response');

  const p = JSON.parse(jsonMatch[0]);

  const clamp = (v: unknown, fallback: number): 1 | 2 | 3 | 4 | 5 =>
    Math.max(1, Math.min(5, typeof v === 'number' ? Math.round(v) : fallback)) as 1 | 2 | 3 | 4 | 5;

  return {
    mood: clamp(p.mood, 3),
    tension: clamp(p.tension, 3),
    selfCritical: Boolean(p.selfCritical),
    intent: ['calming', 'grounding', 'checkin'].includes(p.intent) ? p.intent : 'checkin',
    emotionalTone: ['distressed', 'neutral', 'positive', 'mixed'].includes(p.emotionalTone)
      ? p.emotionalTone : 'neutral',
    freeText: typeof p.freeText === 'string' ? p.freeText : '',
    themes: Array.isArray(p.themes) ? p.themes : [],
    anchors: Array.isArray(p.anchors) ? p.anchors : [],
  };
}

// Convert static CheckinData-style input to ReflectionProfile (no-LLM fallback)
export function checkinToProfile(data: {
  mood: 1 | 2 | 3 | 4 | 5;
  tension: 1 | 2 | 3 | 4 | 5;
  selfCritical: boolean;
  intent: 'calming' | 'grounding' | 'checkin';
  lastSessionOutcome?: 'relieving' | 'neutral' | 'pressuring';
  freeText?: string;
}): ReflectionProfile {
  const tone = data.tension >= 4 ? 'distressed' : data.mood >= 4 ? 'positive' : 'neutral';
  return {
    mood: data.mood,
    tension: data.tension,
    selfCritical: data.selfCritical,
    intent: data.intent,
    lastSessionOutcome: data.lastSessionOutcome,
    freeText: data.freeText ?? '',
    themes: [],
    anchors: [],
    emotionalTone: tone as ReflectionProfile['emotionalTone'],
  };
}

function countUserTurns(messages: readonly ConversationMessage[]): number {
  return messages.filter(m => m.role === 'user').length;
}
