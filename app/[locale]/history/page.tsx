import { getRecentSessions, getPersonalizationHints } from '@/lib/db/queries';
import { SessionHistory } from '@/components/SessionHistory';
import { getTranslations } from 'next-intl/server';
import type { SessionRecord, PersonalizationHints } from '@/lib/types';

export default async function HistoryPage() {
  const t = await getTranslations('history');

  let sessions: SessionRecord[] = [];
  let hints: PersonalizationHints = {
    recentPatterns: [],
    preferredMode: null,
    avoidMode: null,
    avgTension: 3,
    sessionCount: 0,
    lastRiskLevel: null,
    notes: [],
  };

  try {
    [sessions, hints] = await Promise.all([
      getRecentSessions(20),
      getPersonalizationHints(),
    ]);
  } catch (e) {
    console.error('History load error:', e);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-light text-stone-800">{t('title')}</h2>
        {hints.sessionCount > 0 && (
          <p className="text-sm text-stone-400">
            {t('sessionsCount', { count: hints.sessionCount })}
          </p>
        )}
      </div>
      <SessionHistory sessions={sessions} hints={hints} />
    </div>
  );
}
