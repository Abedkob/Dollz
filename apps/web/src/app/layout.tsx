import type { Metadata, Viewport } from 'next';
import {
  Caveat,
  Hanken_Grotesk,
  JetBrains_Mono,
  Playfair_Display,
} from 'next/font/google';
import './globals.css';
import { OG_IMAGE, SITE_DESCRIPTION, SITE_TITLE, siteUrl } from '../lib/seo';

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-hanken',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
});

// Storefront hero display face — variable axis, normal + swash italic.
const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  style: ['normal', 'italic'],
  variable: '--font-playfair',
});

// Handwritten accent ("always by your side").
const caveat = Caveat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_TITLE, template: '%s · Dollz' },
  description: SITE_DESCRIPTION,
  applicationName: 'Dollz',
  authors: [{ name: 'Dollz' }],
  creator: 'Dollz',
  publisher: 'Dollz',
  keywords: [
    'handmade dolls',
    'personalized dolls',
    'custom dolls',
    'made to order dolls',
    'cloth dolls',
    'rag dolls',
    'embroidered name doll',
    'keepsake doll',
    'Dollz',
    'Beirut',
  ],
  formatDetection: { email: false, address: false, telephone: false },
  // No blanket canonical here — each page declares its own so utility pages
  // never accidentally canonicalize to the homepage.
  openGraph: {
    type: 'website',
    siteName: 'Dollz',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: 'en_US',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4e9dd' },
    { media: '(prefers-color-scheme: dark)', color: '#a85f74' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${jetbrainsMono.variable} ${playfair.variable} ${caveat.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Progressive-enhancement flag: scroll-reveal animations only apply
            once this runs (before the page paints), so no-JS visitors and
            reduced-motion users never get stuck on hidden content. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        {children}
      </body>
    </html>
  );
}
