import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { isLLMConfigured } from '@/lib/llm/client';
import { isTTSConfigured } from '@/lib/tts/client';

export default async function Home() {
  const t = await getTranslations('home');
  const llmOk = isLLMConfigured();
  const ttsOk = isTTSConfigured();

  const watchItems = t.raw('watchItems') as string[];

  return (
    <div style={{ maxWidth: '34rem', margin: '0 auto' }}>

      {/* Breathing ring + title */}
      <div className="text-center animate-fade-up" style={{ paddingTop: '2rem', paddingBottom: '3.5rem' }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
          {/* Outer ring */}
          <div
            className="animate-breathe-ring"
            style={{
              position: 'absolute',
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              border: '1px solid var(--sage)',
            }}
          />
          {/* Inner ring */}
          <div
            className="animate-breathe-ring-inner"
            style={{
              position: 'absolute',
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'var(--sage-l)',
            }}
          />
          {/* Center dot */}
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--sage)',
              opacity: 0.6,
              position: 'relative',
            }}
          />
        </div>

        <h1
          className="font-display animate-fade-up delay-200"
          style={{ fontSize: '2.4rem', fontWeight: 300, color: 'var(--ink)', lineHeight: 1.2, marginBottom: '1rem' }}
        >
          {t('title')}
        </h1>

        <p
          className="animate-fade-up delay-300"
          style={{ color: 'var(--ink-mid)', lineHeight: 1.9, fontSize: '0.9rem', maxWidth: '26rem', margin: '0 auto 2.5rem' }}
        >
          {t('subtitle')}
        </p>

        <div className="animate-fade-up delay-500">
          <Link
            href="/session"
            style={{
              display: 'inline-block',
              padding: '0.65rem 2.2rem',
              background: 'var(--sage)',
              color: '#fff',
              borderRadius: '100px',
              fontSize: '0.82rem',
              letterSpacing: '0.1em',
              textDecoration: 'none',
              textTransform: 'uppercase',
              transition: 'background 0.2s, transform 0.2s',
            }}
            onMouseOver={(e: React.MouseEvent<HTMLAnchorElement>) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--sage-d)';
            }}
            onMouseOut={(e: React.MouseEvent<HTMLAnchorElement>) => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'var(--sage)';
            }}
          >
            {t('startSession')}
          </Link>
        </div>
      </div>

      {/* Divider */}
      <div className="animate-fade-up delay-700" style={{ borderTop: '1px solid #e8e1d8', paddingTop: '2.5rem' }}>
        <p style={{ fontSize: '0.7rem', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1.2rem' }}>
          {t('watchesFor')}
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {watchItems.map((item, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '0.75rem',
                padding: '0.35rem 0',
                fontSize: '0.85rem',
                color: 'var(--ink-mid)',
                borderBottom: i < watchItems.length - 1 ? '1px solid #f0ebe0' : 'none',
              }}
            >
              <span style={{ color: 'var(--sage)', fontSize: '0.5rem', flexShrink: 0 }}>●</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Status — very subtle */}
      {(!llmOk || !ttsOk) && (
        <div style={{ marginTop: '2.5rem', padding: '1rem 1.25rem', background: 'var(--warm-l)', borderRadius: '8px' }}>
          {!llmOk && (
            <p style={{ fontSize: '0.72rem', color: 'var(--ink-soft)', margin: '0 0 0.25rem' }}>
              {t('llmInactive')}
            </p>
          )}
          {!ttsOk && (
            <p style={{ fontSize: '0.72rem', color: 'var(--ink-soft)', margin: 0 }}>
              {t('ttsInactive')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
