'use client';

import { useTranslations } from 'next-intl';
import type { SessionRecord, PersonalizationHints } from '@/lib/types';

interface SessionHistoryProps {
  sessions: SessionRecord[];
  hints: PersonalizationHints;
}

const RISK_BADGES: Record<string, string> = {
  none: 'bg-stone-100 text-stone-500',
  low: 'bg-stone-100 text-stone-600',
  moderate: 'bg-amber-50 text-amber-700',
  high: 'bg-orange-50 text-orange-700',
  crisis: 'bg-stone-200 text-stone-700',
};

export function SessionHistory({ sessions, hints }: SessionHistoryProps) {
  const t = useTranslations('history');

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-lg mx-auto space-y-8">
      {hints.sessionCount > 0 && hints.notes.length > 0 && (
        <div className="border border-stone-200 rounded-lg p-4 space-y-2">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">{t('whatWeNoticed')}</p>
          <ul className="space-y-1">
            {hints.notes.map((note, i) => (
              <li key={i} className="text-sm text-stone-600">{note}</li>
            ))}
          </ul>
        </div>
      )}

      {sessions.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-8">{t('noSessions')}</p>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => (
            <div key={session.id} className="border border-stone-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400">{formatDate(session.createdAt)}</span>
                <div className="flex gap-2 items-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${RISK_BADGES[session.supervisorDecision.riskLevel] ?? RISK_BADGES['none']}`}>
                    {session.supervisorDecision.riskLevel}
                  </span>
                  <span className="text-xs text-stone-400">
                    {session.guidance.mode} · {session.guidance.duration}s
                  </span>
                </div>
              </div>

              {session.summary && (
                <p className="text-sm text-stone-600">{session.summary}</p>
              )}

              {session.postOutcome && (
                <div className="flex gap-3 text-xs text-stone-400">
                  <span>{session.postOutcome.feltBetter ? t('feltBetter') : t('addedPressure')}</span>
                  <span>{session.postOutcome.wouldContinue ? t('wouldPracticeAgain') : t('enoughForToday')}</span>
                </div>
              )}

              {session.supervisorDecision.patterns.length > 0 && (
                <p className="text-xs text-stone-400">
                  {session.supervisorDecision.patterns.join(', ').replace(/_/g, ' ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
