'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';

export function Nav() {
  const t = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const otherLocale = locale === 'en' ? 'ja' : 'en';

  const switchLocale = () => {
    router.replace(pathname, { locale: otherLocale });
  };

  return (
    <nav style={{ borderBottom: '1px solid #e8e1d8' }}>
      <div className="max-w-xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="font-display"
          style={{ fontSize: '1.15rem', fontWeight: 400, color: 'var(--ink)', letterSpacing: '0.06em', textDecoration: 'none', opacity: 0.85 }}
        >
          {t('brand')}
        </Link>

        <div className="flex gap-8 items-center">
          <Link
            href="/session"
            style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', letterSpacing: '0.08em', textDecoration: 'none', textTransform: 'uppercase' }}
          >
            {t('session')}
          </Link>
          <Link
            href="/history"
            style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', letterSpacing: '0.08em', textDecoration: 'none', textTransform: 'uppercase' }}
          >
            {t('history')}
          </Link>
          <button
            onClick={switchLocale}
            style={{ fontSize: '0.7rem', color: 'var(--ink-soft)', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em', padding: '2px 0', opacity: 0.7 }}
          >
            {t('switchLocale')}
          </button>
        </div>
      </div>
    </nav>
  );
}
