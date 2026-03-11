import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // No native modules needed (using @libsql/client instead of better-sqlite3)
};

export default withNextIntl(nextConfig);
