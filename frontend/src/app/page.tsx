'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import AgentLogin from '@/components/AgentLogin';
import api from '@/lib/api';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, apiKey, setAgent } = useAppStore();

  useEffect(() => {
    if (isAuthenticated && apiKey) {
      // Verify API key and fetch agent info
      api.setApiKey(apiKey);
      api.getAgent()
        .then((agent) => {
          setAgent(agent);
          router.push('/dashboard');
        })
        .catch(() => {
          // Invalid key, stay on login page
          useAppStore.getState().logout();
        });
    }
  }, [isAuthenticated, apiKey, router, setAgent]);

  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-xl text-gray-500">Loading...</div>
      </div>
    );
  }

  return <AgentLogin />;
}
