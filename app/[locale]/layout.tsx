import type { Metadata } from "next";
import { Cormorant_Garamond, Noto_Sans_JP } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { Nav } from '@/components/Nav';

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  display: "swap",
});

const notoSans = Noto_Sans_JP({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["300", "400"],
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'nav' });
  return {
    title: t('brand'),
    description: locale === 'ja'
      ? 'あなたのマインドフルネスをそっとそばで見守るパートナー'
      : 'A gentle companion for mindful practice',
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${cormorant.variable} ${notoSans.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <Nav />
          <main className="max-w-xl mx-auto px-6 py-16">
            {children}
          </main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
