import type { ConversationMessage, UserMemory } from '@/lib/agents/types';

function formatMemory(memory: UserMemory): string {
  const lines: string[] = [];
  if (memory.corePatterns.length > 0) lines.push(`Tendencies: ${memory.corePatterns.join(', ')}`);
  if (memory.whatHelps.length > 0) lines.push(`What works for them: ${memory.whatHelps.join(', ')}`);
  if (memory.whatHurts.length > 0) lines.push(`What doesn't help: ${memory.whatHurts.join(', ')}`);
  if (memory.lifeContext.length > 0) lines.push(`Life context: ${memory.lifeContext.join(', ')}`);
  if (memory.languageNotes.length > 0) lines.push(`How to speak with them: ${memory.languageNotes.join(', ')}`);
  if (memory.trajectory) lines.push(`Their practice journey: ${memory.trajectory}`);
  return lines.join('\n');
}

export function buildReflectionSystemPrompt(
  locale: string,
  hasHistory: boolean,
  memory?: UserMemory
): string {
  const lang = locale === 'ja' ? 'Japanese' : 'English';
  const memorySection = memory && memory.sessionCount > 0
    ? `\nWhat you know about this person from previous sessions:\n${formatMemory(memory)}\nUse this naturally — don't recite it, just let it inform how you listen.\n`
    : '';

  const q2 = hasHistory
    ? (locale === 'ja' ? '最近の練習はどうですか？' : 'How has practice been going for you lately?')
    : (locale === 'ja' ? '今日ここに来たのは何かきっかけがありましたか？' : "What's bringing you here today?");

  return `You are a warm, grounded presence — like a thoughtful counselor at the start of a session. You have a brief, natural conversation with someone before their mindfulness practice.

ALWAYS respond in ${lang}.
${memorySection}
You ask exactly 3 questions, one at a time, in this order:
1. Current state: ${locale === 'ja' ? '「今、体と心の状態はどうですか？」' : '"How are you feeling right now — in your body and mind?"'}
2. Recent context: "${q2}"
3. Intent: ${locale === 'ja' ? '「今日の練習で、どんなことが役立ちそうですか？」' : '"What would feel most useful from a few minutes of practice right now?"'}

Style:
- Ask one question per message, never two
- Acknowledge what they said briefly (one short sentence) before asking the next question
- Be warm but not effusive — no "wonderful!" or "that's so important"
- Keep each response to 2-3 sentences maximum
- If they mention something specific (shoulders tight, deadline, can't sleep), register it quietly — don't analyze it

After their THIRD response: acknowledge it in one short sentence, then write exactly: [REFLECTION_COMPLETE]

If at any point the user expresses crisis, self-harm, or suicidal thoughts: [CRISIS_DETECTED]`;
}

export function buildExtractionPrompt(
  messages: readonly ConversationMessage[],
  locale: string
): string {
  const transcript = messages
    .map(m => `${m.role === 'agent' ? 'Counselor' : 'Person'}: ${m.content}`)
    .join('\n');

  return `Extract a structured profile from this pre-session reflection conversation.

${transcript}

Return ONLY valid JSON (no markdown, no explanation):
{
  "mood": <1-5, where 1=very low, 3=neutral, 5=good>,
  "tension": <1-5, where 1=none, 5=very high>,
  "selfCritical": <boolean — true if any self-judgment or "should" language>,
  "intent": <"calming" | "grounding" | "checkin">,
  "emotionalTone": <"distressed" | "neutral" | "positive" | "mixed">,
  "freeText": "<1-2 sentence summary of what they shared>",
  "themes": ["<abstract pattern>", ...],
  "anchors": ["<concrete detail they mentioned>", ...]
}

Rules:
- mood/tension: be conservative, lean lower if any distress is present
- intent: calming=wants to reduce activation, grounding=wants present-moment reconnection, checkin=just checking in
- themes: abstract labels like "work_stress", "sleep_issues", "relationship_tension", "physical_pain", "performance_pressure", "self_criticism"
- anchors: SPECIFIC things they mentioned — "tight shoulders", "presentation tomorrow", "didn't sleep well", "kept thinking about the argument"
- freeText: written in ${locale === 'ja' ? 'Japanese' : 'English'}`;
}
