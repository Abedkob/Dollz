import type { Metadata } from 'next';
import { JsonLd } from '../components/json-ld';
import { StorefrontHome } from '../components/storefront-home';
import { fetchStoreSettings, organizationLd, websiteLd } from '../lib/seo';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function Home() {
  const settings = await fetchStoreSettings();
  return (
    <>
      <JsonLd data={[organizationLd(settings), websiteLd()]} />
      <StorefrontHome />
    </>
  );
}
