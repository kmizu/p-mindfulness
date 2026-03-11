'use client';

import { useTranslations } from 'next-intl';
import type { SupervisorDecision, CheckinData } from '@/lib/types';
import { CrisisBanner } from './CrisisBanner';

interface SupervisorReviewProps {
  decision: SupervisorDecision;
  checkin: CheckinData;
  onStart: () => Promise<void>;
  onDecline: () => void;
  loading?: boolean;
}

const RISK_ACCENT: Record<string, string> = {
  none:     '#c8d9ca',
  low:      '#c8d9ca',
  moderate: '#ddd0a8',
  high:     '#e0b8a0',
  crisis:   '#d4c0c0',
};

export function SupervisorReview({ decision, checkin: _checkin, onStart, onDecline, loading }: SupervisorReviewProps) {
  const t = useTranslations('review');

  if (decision.riskLevel === 'crisis') {
    return <CrisisBanner message={decision.message} />;
  }

  const accent = RISK_ACCENT[decision.riskLevel] ?? '#c8d9ca';
  const modeLabel = t(`modes.${decision.recommendedMode}` as Parameters<typeof t>[0], { default: decision.recommendedMode });
  const durationLabel = t(`durations.${decision.guidanceDuration}` as Parameters<typeof t>[0], { default: String(decision.guidanceDuration) });

  return (
    <div style={{ maxWidth: '34rem', margin: '0 auto' }}>
      {/* Message card */}
      <div style={{
        padding: '1.5rem 1.6rem',
        background: '#fff',
        borderRadius: '1rem',
        borderLeft: `3px solid ${accent}`,
        boxShadow: '0 1px 12px rgba(107,130,113,0.07)',
        marginBottom: '1.75rem',
      }}>
        <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--ink)', lineHeight: 1.85, fontWeight: 300 }}>
          {decision.message}
        </p>

        {decision.action !== 'proceed' && (
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
            <span>{t('mode')}: <strong style={{ color: 'var(--ink-mid)', fontWeight: 400 }}>{modeLabel}</strong></span>
            <span>{t('duration')}: <strong style={{ color: 'var(--ink-mid)', fontWeight: 400 }}>{durationLabel}</strong></span>
          </div>
        )}

        {decision.patterns.length > 0 && (
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.72rem', color: 'var(--ink-soft)', letterSpacing: '0.04em' }}>
            {t('noticed')}: {decision.patterns.join('  ·  ').replace(/_/g, ' ')}
          </p>
        )}
      </div>

      {/* Actions */}
      {decision.action !== 'stop' && decision.action !== 'crisis' ? (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={onStart}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.8rem',
              background: 'var(--sage)',
              color: '#fff',
              border: 'none',
              borderRadius: '100px',
              fontSize: '0.82rem',
              letterSpacing: '0.06em',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background 0.2s',
            }}
          >
            {loading ? t('starting') : t('begin')}
          </button>
          <button
            onClick={onDecline}
            style={{
              padding: '0.8rem 1.2rem',
              background: 'none',
              border: 'none',
              fontSize: '0.8rem',
              color: 'var(--ink-soft)',
              cursor: 'pointer',
            }}
          >
            {t('notToday')}
          </button>
        </div>
      ) : (
        <button
          onClick={onDecline}
          style={{
            width: '100%',
            padding: '0.8rem',
            background: 'var(--warm-l)',
            border: '1px solid #e0d8ce',
            borderRadius: '100px',
            fontSize: '0.82rem',
            color: 'var(--ink-mid)',
            cursor: 'pointer',
          }}
        >
          {t('okayStop')}
        </button>
      )}
    </div>
  );
}
