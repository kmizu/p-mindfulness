'use client';

import { useTranslations } from 'next-intl';

interface CrisisBannerProps {
  message: string;
}

export function CrisisBanner({ message }: CrisisBannerProps) {
  const t = useTranslations('crisis');
  const resources = t.raw('resources') as string[];

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-stone-100 border border-stone-300 rounded-lg p-6 space-y-4">
        <p className="text-stone-800 leading-relaxed">{message}</p>

        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-600">{t('heading')}</p>
          <ul className="space-y-1 text-sm text-stone-600">
            {resources.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>

        <p className="text-sm text-stone-500">{t('notDesigned')}</p>
      </div>
    </div>
  );
}
