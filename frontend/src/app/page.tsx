'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import AgentLogin from '@/components/AgentLogin';

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const agent = useAppStore((state) => state.agent);
  const [hydrated, setHydrated] = useState(false);

  // Ждём пока zustand загрузит данные из localStorage
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (isAuthenticated && agent) {
      router.push('/dashboard');
    }
  }, [hydrated, isAuthenticated, agent, router]);

  // Пока не загрузились данные из localStorage — ничего не показываем
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Если залогинен — показываем спиннер пока идёт редирект
  if (isAuthenticated && agent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Не залогинен — показываем форму
  return <AgentLogin />;
}
