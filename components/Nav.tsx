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
    <nav className="border-b border-stone-100">
      <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
          {t('brand')}
        </Link>
        <div className="flex gap-6 items-center">
          <Link href="/session" className="text-sm text-stone-500 hover:text-stone-700 transition-colors">
            {t('session')}
          </Link>
          <Link href="/history" className="text-sm text-stone-500 hover:text-stone-700 transition-colors">
            {t('history')}
          </Link>
          <button
            onClick={switchLocale}
            className="text-xs text-stone-400 hover:text-stone-600 border border-stone-200 rounded px-2 py-1 transition-colors"
          >
            {t('switchLocale')}
          </button>
        </div>
      </div>
    </nav>
  );
}
