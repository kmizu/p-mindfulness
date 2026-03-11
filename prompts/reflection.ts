import type { ConversationMessage, UserMemory } from '@/lib/agents/types';

// ── Mindfulness concept mini-database (paper §3.2 RAG simplified) ─────────────
// When a user mentions one of these concepts, the agent can explain it in Turn 3.

const CONCEPTS: Record<string, { en: string; ja: string }> = {
  breath: {
    en: 'Breath awareness means noticing the physical sensation of breathing — the movement in your chest or belly, the air at your nostrils — without trying to control or deepen it.',
    ja: '呼吸への気づきとは、呼吸の物理的な感覚 — 胸やお腹の動き、鼻の空気 — をコントロールしようとせず、ただ観察することです。',
  },
  body: {
    en: 'Body awareness means slowly noticing sensations throughout your body — pressure, temperature, contact — without trying to change them. Just observing what\'s already there.',
    ja: '身体感覚への気づきとは、体のさまざまな場所にある感覚 — 圧力、温度、接触感 — を変えようとせず、ただ観察することです。',
  },
  sound: {
    en: 'Sound anchoring means letting environmental sounds come to you naturally, without labeling or judging them — the hum of a fan, traffic, voices. They wash through your awareness.',
    ja: '音への集中とは、扇風機の音、車の音など、周囲の音をラベルや判断なしに自然に受け取ること。意識の中を流れるままにします。',
  },
  open: {
    en: 'Open awareness means widening your attention to include everything at once — sounds, sensations, thoughts — without fixing on any single thing. A wide, receptive noticing.',
    ja: '開かれた気づきとは、音、感覚、思考など、すべてを一度に受け取ること。特定の何かに集中するのではなく、広く受け取る姿勢です。',
  },
  scan: {
    en: 'A body scan means moving attention slowly from one part of your body to another — often from feet upward — noticing whatever sensations are present without trying to change them.',
    ja: 'ボディスキャンとは、体の各部位に注意をゆっくりと移していくこと。多くは足から上へ。そこにある感覚をただ観察します。',
  },
};

function detectConceptMention(text: string): string | null {
  const lower = text.toLowerCase();
  if (/breath|呼吸|breathing/.test(lower)) return 'breath';
  if (/body scan|scan|スキャン/.test(lower)) return 'scan';
  if (/body|bodies|身体|体/.test(lower)) return 'body';
  if (/sound|sounds|listen|音|耳/.test(lower)) return 'sound';
  if (/open|awareness|全体|open/.test(lower)) return 'open';
  return null;
}

function formatMemory(memory: UserMemory): string {
  const lines: string[] = [];
  if (memory.sessionCount > 0) lines.push(`Sessions together: ${memory.sessionCount}`);
  if (memory.corePatterns.length > 0) lines.push(`Tendencies I've noticed: ${memory.corePatterns.join(', ')}`);
  if (memory.whatHelps.length > 0) lines.push(`What tends to help them: ${memory.whatHelps.join(', ')}`);
  if (memory.whatHurts.length > 0) lines.push(`What hasn't helped: ${memory.whatHurts.join(', ')}`);
  if (memory.lifeContext.length > 0) lines.push(`Their life context: ${memory.lifeContext.join(', ')}`);
  if (memory.trajectory) lines.push(`Their journey so far: ${memory.trajectory}`);
  return lines.join('\n');
}

// ── System prompt ─────────────────────────────────────────────────────────────

export function buildReflectionSystemPrompt(
  locale: string,
  hasHistory: boolean,
  memory?: UserMemory
): string {
  const lang = locale === 'ja' ? 'Japanese' : 'English';
  const isJa = locale === 'ja';

  const memorySection = memory && memory.sessionCount > 0
    ? `\nWhat you know about this person from your time together:\n${formatMemory(memory)}\nLet this inform how you listen — don't recite it, just notice what feels relevant.\n`
    : '';

  // Turn 2 question depends on whether they have practice history (paper §3.2)
  const turn2 = hasHistory
    ? (isJa
        ? '前回の練習から何か変化はありましたか？'
        : 'How has it been since your last session — anything shift?')
    : (isJa
        ? '今日ここに来たのは何かきっかけがありましたか？'
        : "What's brought you here today?");

  return `You are a warm, unhurried companion — like a thoughtful counselor at the start of a session. You hold space for someone before their mindfulness practice.

ALWAYS respond in ${lang}.
${memorySection}
You have exactly 3 turns. Each turn has a specific purpose — follow this structure precisely:

TURN 1 — CURRENT SITUATION
Purpose: Understand how they are RIGHT NOW — body, mind, emotional state.
Question: ${isJa ? '「今、体と心はどんな感じですか？」' : '"How are you feeling right now — in your body and mind?"'}
After their reply: Acknowledge in one brief sentence, then ask Turn 2.

TURN 2 — PAST SESSION REVIEW
Purpose: ${hasHistory ? 'Connect this moment to their practice history. What has changed?' : 'Understand what brought them here and what they are hoping for.'}
Question: "${turn2}"
After their reply: Acknowledge briefly, then ask Turn 3.

TURN 3 — INTENT + TECHNIQUE ORIENTATION
Purpose: Establish what they want from today's practice. If they mention a specific technique (breath, body scan, sounds, open awareness), offer a brief, warm explanation of what it involves — NOT as instruction, just so they know what to expect. Then confirm their intent.
After their reply: One warm closing sentence. Then write exactly: [REFLECTION_COMPLETE]

Style guidelines:
- One question per message, never two
- Acknowledge briefly (one short sentence) before moving on — register what they said, don't analyze it
- Warm but not effusive. Never "wonderful!" or "that's so important" or "I hear you"
- 2-3 sentences per message maximum
- Specific details they mention (tight shoulders, a deadline, trouble sleeping) — receive them quietly
- If they bring up a concept in Turn 3, offer the explanation from your knowledge before asking their intent

CRITICAL: If at any point you detect crisis signals, suicidal ideation, or self-harm: respond ONLY with [CRISIS_DETECTED] and nothing else.`;
}

// ── Extraction prompt ─────────────────────────────────────────────────────────

export function buildExtractionPrompt(
  messages: readonly ConversationMessage[],
  locale: string
): string {
  const transcript = messages
    .map(m => `${m.role === 'agent' ? 'Counselor' : 'Person'}: ${m.content}`)
    .join('\n');

  // Check if any concept was mentioned to inform technique extraction
  const allUserText = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
  const mentionedConcept = detectConceptMention(allUserText);

  return `Extract a structured profile from this pre-session reflection conversation (MindfulAgents §3.2 paper protocol).

${transcript}

Return ONLY valid JSON (no markdown, no explanation):
{
  "mood": <1-5, 1=very low/distressed, 3=neutral, 5=good>,
  "tension": <1-5, 1=none, 5=very high>,
  "selfCritical": <boolean — true if any self-judgment, "should" language, or self-blame>,
  "intent": <"calming" | "grounding" | "checkin">,
  "lastSessionOutcome": <"relieving" | "neutral" | "pressuring" | null>,
  "emotionalTone": <"distressed" | "neutral" | "positive" | "mixed">,
  "mentionedTechnique": <"breath" | "body" | "sound" | "scan" | "open" | null>,
  "freeText": "<1-2 sentence summary of what they shared>",
  "themes": ["<abstract pattern>"],
  "anchors": ["<specific concrete detail they mentioned>"]
}

Extraction rules:
- mood/tension: conservative — lean lower if any distress is present
- intent: calming=wants to reduce activation, grounding=wants present-moment reconnection, checkin=just checking in
- lastSessionOutcome: extract from Turn 2 if they mentioned it, else null
- mentionedTechnique: ${mentionedConcept ? `likely "${mentionedConcept}" based on the conversation` : 'look for technique mentions in Turn 3'}
- themes: abstract labels like work_stress, sleep_issues, relationship_tension, physical_pain, performance_pressure, self_criticism
- anchors: SPECIFIC things — "tight shoulders", "presentation tomorrow", "woke at 3am", "argument with partner"
- freeText in ${locale === 'ja' ? 'Japanese' : 'English'}`;
}

// ── Concept lookup (used by agents directly) ─────────────────────────────────

export function getConceptExplanation(technique: string | null, locale: string): string | null {
  if (!technique) return null;
  const concept = CONCEPTS[technique];
  if (!concept) return null;
  return locale === 'ja' ? concept.ja : concept.en;
}
