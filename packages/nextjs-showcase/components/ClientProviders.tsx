'use client';

import dynamic from 'next/dynamic';

// Disable SSR for RainbowKit providers
const Providers = dynamic(
  () => import('./Providers').then((mod) => mod.Providers),
  { ssr: false }
);

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}

