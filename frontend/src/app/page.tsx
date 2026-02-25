'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import AgentLogin from '@/components/AgentLogin';
import api from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const apiKey = useAppStore((state) => state.apiKey);
  const setAgent = useAppStore((state) => state.setAgent);
  const logout = useAppStore((state) => state.logout);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !apiKey || hasFetched.current) return;
    hasFetched.current = true;

    api.setApiKey(apiKey);
    api.getAgent()
      .then((agent) => {
        setAgent(agent);
        router.push('/dashboard');
      })
      .catch(() => {
        logout();
        hasFetched.current = false;
      });
  }, [isAuthenticated, apiKey]);

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl text-gray-500">Loading...</div>
      </div>
    );
  }

  return <AgentLogin />;
}
