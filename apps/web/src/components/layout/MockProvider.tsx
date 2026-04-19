'use client';

import { useEffect, useState } from 'react';

async function enableMocking() {
  if (process.env.NODE_ENV !== 'development') return;
  const { worker } = await import('@/mocks/browser');
  return worker.start({ onUnhandledRequest: 'bypass' });
}

export default function MockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(process.env.NODE_ENV !== 'development');

  useEffect(() => {
    enableMocking().then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return <>{children}</>;
}
