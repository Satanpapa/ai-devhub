'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import AgentLogin from '@/components/AgentLogin';

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const agent = useAppStore((state) => state.agent);

  useEffect(() => {
    // Если уже залогинен и данные агента есть — просто редиректим
    if (isAuthenticated && agent) {
      router.push('/dashboard');
    }
  }, []);  // Пустой массив — только при первом рендере!

  if (isAuthenticated && agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl text-gray-500">Loading...</div>
      </div>
    );
  }

  return <AgentLogin />;
}
