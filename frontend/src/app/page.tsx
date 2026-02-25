'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import AgentLogin from '@/components/AgentLogin';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, agent, loadFromStorage } = useAppStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Загружаем данные из localStorage один раз при старте
    loadFromStorage();
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    if (isAuthenticated && agent) {
      router.replace('/dashboard');
    }
  }, [ready, isAuthenticated, agent]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready || (isAuthenticated && agent)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return <AgentLogin />;
}
