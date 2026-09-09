import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CookieBanner } from '@/components/CookieBanner';
import { env, reportIntegrationStatus } from '@/lib/env';

reportIntegrationStatus();

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: 'UKAF Commercials — Used HGVs, tractor units & trailers for sale',
    template: '%s | UKAF Commercials',
  },
  description:
    'Quality used HGVs, tractor units, tippers, curtainsiders and rigid trucks for sale across the UK and for export. Finance, part exchange and delivery available.',
  keywords: [
    'used HGV for sale',
    'tractor units',
    'trucks for sale UK',
    'commercial vehicles',
    'used lorries',
    'DAF Scania Volvo MAN Mercedes',
    'HGV export',
  ],
  authors: [{ name: env.company.name }],
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: env.siteUrl,
    siteName: 'UKAF Commercials',
    title: 'UKAF Commercials — Used HGVs & commercial vehicles for sale',
    description:
      'Hand-picked used HGVs, tractor units and trailers, fully prepared and ready to work. Nationwide delivery and worldwide export.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'UKAF Commercials',
    description: 'Quality used HGVs and commercial vehicles for sale.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  alternates: { canonical: '/' },
  formatDetection: { telephone: true, address: false, email: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#142257',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="flex min-h-screen flex-col">
        <Link href="#main" className="skip-link">
          Skip to main content
        </Link>

        <Header />

        <main id="main" className="flex-1">
          {children}
        </main>

        <Footer />
        <CookieBanner />
      </body>
    </html>
  );
}
