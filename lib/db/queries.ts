import { initDb } from './connection';
import { sessions, userMemory as userMemoryTable } from './schema';
import { desc, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type {
  SessionRecord,
  PersonalizationHints,
  CheckinData,
  SupervisorDecision,
  GuidanceScript,
  PostOutcome,
  GuidanceMode,
  RiskLevel,
  HarmfulPattern,
  UserMemory,
} from '@/lib/types';

// ── Helpers ─────────────────────────────────────────────────────────────────

function rowToSession(row: typeof sessions.$inferSelect): SessionRecord {
  return {
    id: row.id,
    createdAt: row.createdAt,
    checkin: {
      mood: row.checkinMood as CheckinData['mood'],
      tension: row.checkinTension as CheckinData['tension'],
      selfCritical: Boolean(row.checkinSelfCritical),
      intent: row.checkinIntent as CheckinData['intent'],
      lastSessionOutcome: row.checkinLastOutcome as CheckinData['lastSessionOutcome'],
      freeText: row.checkinFreeText ?? undefined,
    },
    supervisorDecision: {
      riskLevel: row.riskLevel as SupervisorDecision['riskLevel'],
      patterns: JSON.parse(row.patterns) as HarmfulPattern[],
      action: row.action as SupervisorDecision['action'],
      recommendedMode: row.recommendedMode as GuidanceMode,
      message: row.supervisorMessage,
      guidanceDuration: row.guidanceDuration as SupervisorDecision['guidanceDuration'],
    },
    guidance: {
      mode: row.guidanceMode as GuidanceMode,
      duration: row.guidanceDuration as GuidanceScript['duration'],
      text: row.guidanceText,
      isPreset: Boolean(row.guidanceIsPreset),
    },
    postOutcome: row.postFeltBetter !== null && row.postFeltBetter !== undefined
      ? {
          feltBetter: Boolean(row.postFeltBetter),
          wouldContinue: Boolean(row.postWouldContinue),
          notes: row.postNotes ?? undefined,
        }
      : undefined,
    summary: row.summary ?? undefined,
    reflectionProfile: row.reflectionProfile ?? undefined,
    reflectionSummary: row.reflectionSummary ?? undefined,
  };
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function saveSession(data: {
  checkin: CheckinData;
  supervisorDecision: SupervisorDecision;
  guidance: GuidanceScript;
  reflectionProfile?: string;
  reflectionSummary?: string;
}): Promise<string> {
  const db = await initDb();
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  await db.insert(sessions).values({
    id,
    createdAt,
    checkinMood: data.checkin.mood,
    checkinTension: data.checkin.tension,
    checkinSelfCritical: data.checkin.selfCritical,
    checkinIntent: data.checkin.intent,
    checkinLastOutcome: data.checkin.lastSessionOutcome ?? null,
    checkinFreeText: data.checkin.freeText ?? null,
    riskLevel: data.supervisorDecision.riskLevel,
    patterns: JSON.stringify(data.supervisorDecision.patterns),
    action: data.supervisorDecision.action,
    recommendedMode: data.supervisorDecision.recommendedMode,
    supervisorMessage: data.supervisorDecision.message,
    guidanceDuration: data.supervisorDecision.guidanceDuration,
    guidanceMode: data.guidance.mode,
    guidanceText: data.guidance.text,
    guidanceIsPreset: data.guidance.isPreset,
    reflectionProfile: data.reflectionProfile ?? null,
    reflectionSummary: data.reflectionSummary ?? null,
  });

  return id;
}

export async function updatePostOutcome(
  id: string,
  post: PostOutcome,
  summary?: string
): Promise<void> {
  const db = await initDb();
  await db
    .update(sessions)
    .set({
      postFeltBetter: post.feltBetter,
      postWouldContinue: post.wouldContinue,
      postNotes: post.notes ?? null,
      summary: summary ?? null,
    })
    .where(eq(sessions.id, id));
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getRecentSessions(limit = 10): Promise<SessionRecord[]> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(sessions)
    .orderBy(desc(sessions.createdAt))
    .limit(limit);
  return rows.map(rowToSession);
}

export async function getSessionById(id: string): Promise<SessionRecord | null> {
  const db = await initDb();
  const rows = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return rows.length > 0 ? rowToSession(rows[0]) : null;
}

// ── User Memory ──────────────────────────────────────────────────────────────

export async function getUserMemory(userId = 'default'): Promise<UserMemory | null> {
  const db = await initDb();
  const rows = await db.select().from(userMemoryTable).where(eq(userMemoryTable.userId, userId)).limit(1);
  if (rows.length === 0) return null;
  try {
    return JSON.parse(rows[0].memory) as UserMemory;
  } catch {
    return null;
  }
}

export async function saveUserMemory(memory: UserMemory, userId = 'default'): Promise<void> {
  const db = await initDb();
  await db
    .insert(userMemoryTable)
    .values({ userId, memory: JSON.stringify(memory), updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({
      target: userMemoryTable.userId,
      set: { memory: JSON.stringify(memory), updatedAt: new Date().toISOString() },
    });
}

// ── Personalization Hints ─────────────────────────────────────────────────────

export async function getPersonalizationHints(): Promise<PersonalizationHints> {
  const recent = await getRecentSessions(10);

  if (recent.length === 0) {
    return {
      recentPatterns: [],
      preferredMode: null,
      avoidMode: null,
      avgTension: 3,
      sessionCount: 0,
      lastRiskLevel: null,
      notes: [],
    };
  }

  // Aggregate patterns from recent sessions
  const allPatterns = recent.flatMap(s => s.supervisorDecision.patterns);
  const patternCounts = allPatterns.reduce(
    (acc, p) => ({ ...acc, [p]: (acc[p] ?? 0) + 1 }),
    {} as Record<string, number>
  );
  const recentPatterns = Object.entries(patternCounts)
    .filter(([, count]) => count >= 2)
    .map(([p]) => p as HarmfulPattern);

  // Find preferred/avoid modes from outcomes
  const withPost = recent.filter(s => s.postOutcome !== undefined);
  const goodSessions = withPost.filter(s => s.postOutcome?.feltBetter);
  const badSessions = withPost.filter(s => !s.postOutcome?.feltBetter);

  const modeCounts = (list: SessionRecord[]) =>
    list.reduce(
      (acc, s) => ({ ...acc, [s.guidance.mode]: (acc[s.guidance.mode] ?? 0) + 1 }),
      {} as Record<string, number>
    );

  const goodModes = modeCounts(goodSessions);
  const badModes = modeCounts(badSessions);

  const preferredMode = Object.entries(goodModes).sort(([, a], [, b]) => b - a)[0]?.[0] as
    | GuidanceMode
    | undefined;
  const avoidMode = Object.entries(badModes).sort(([, a], [, b]) => b - a)[0]?.[0] as
    | GuidanceMode
    | undefined;

  // Average tension
  const avgTension = recent.reduce((sum, s) => sum + s.checkin.tension, 0) / recent.length;

  // Last risk level
  const lastRiskLevel = recent[0]?.supervisorDecision.riskLevel ?? null;

  // Build notes
  const notes: string[] = [];
  if (preferredMode) notes.push(`${preferredMode} anchor worked recently`);
  if (avoidMode && avoidMode !== preferredMode) notes.push(`avoid ${avoidMode} — correlated with difficulty`);
  if (recentPatterns.includes('perfectionism')) notes.push('perfectionism pattern noticed recently');
  if (recentPatterns.includes('breath_tension')) notes.push('breath focus has increased tension recently');
  if (avgTension >= 4) notes.push('recent sessions have been high-tension — keep short');

  return {
    recentPatterns,
    preferredMode: preferredMode ?? null,
    avoidMode: avoidMode ?? null,
    avgTension,
    sessionCount: recent.length,
    lastRiskLevel: lastRiskLevel as RiskLevel | null,
    notes,
  };
}
