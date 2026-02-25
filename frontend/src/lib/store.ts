import { create } from 'zustand';

interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: string;
  permissions: Record<string, any>;
  quota: Record<string, any>;
  created_at: string;
  last_active_at: string | null;
}

interface AppState {
  apiKey: string | null;
  agent: Agent | null;
  isAuthenticated: boolean;
  sidebarOpen: boolean;
  currentView: string;
  setApiKey: (key: string | null) => void;
  setAgent: (agent: Agent | null) => void;
  logout: () => void;
  toggleSidebar: () => void;
  setCurrentView: (view: string) => void;
  loadFromStorage: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  apiKey: null,
  agent: null,
  isAuthenticated: false,
  sidebarOpen: true,
  currentView: 'dashboard',

  loadFromStorage: () => {
    if (typeof window === 'undefined') return;
    const key = localStorage.getItem('apiKey');
    const agentStr = localStorage.getItem('agent');
    if (key && agentStr) {
      try {
        const agent = JSON.parse(agentStr);
        set({ apiKey: key, agent, isAuthenticated: true });
      } catch {
        localStorage.removeItem('apiKey');
        localStorage.removeItem('agent');
      }
    }
  },

  setApiKey: (key) => {
    if (typeof window !== 'undefined') {
      if (key) localStorage.setItem('apiKey', key);
      else localStorage.removeItem('apiKey');
    }
    set({ apiKey: key, isAuthenticated: !!key });
  },

  setAgent: (agent) => {
    if (typeof window !== 'undefined') {
      if (agent) localStorage.setItem('agent', JSON.stringify(agent));
      else localStorage.removeItem('agent');
    }
    set({ agent });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('apiKey');
      localStorage.removeItem('agent');
    }
    set({ apiKey: null, agent: null, isAuthenticated: false });
  },

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setCurrentView: (view) => set({ currentView: view }),
}));

// Repository store
interface Repository {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  clone_url: string | null;
  default_branch: string;
  size_mb: number;
  commits_count: number;
  created_at: string;
  updated_at: string;
}

interface RepoState {
  repositories: Repository[];
  selectedRepo: Repository | null;
  loading: boolean;
  setRepositories: (repos: Repository[]) => void;
  setSelectedRepo: (repo: Repository | null) => void;
  addRepository: (repo: Repository) => void;
  removeRepository: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useRepoStore = create<RepoState>((set) => ({
  repositories: [],
  selectedRepo: null,
  loading: false,
  setRepositories: (repos) => set({ repositories: repos }),
  setSelectedRepo: (repo) => set({ selectedRepo: repo }),
  addRepository: (repo) => set((state) => ({ repositories: [repo, ...state.repositories] })),
  removeRepository: (id) => set((state) => ({ repositories: state.repositories.filter((r) => r.id !== id) })),
  setLoading: (loading) => set({ loading }),
}));

// Execution store
interface Execution {
  id: string;
  status: string;
  language: string;
  code: string;
  stdout: string | null;
  stderr: string | null;
  exit_code: number | null;
  duration_ms: number | null;
  memory_used_mb: number | null;
  created_at: string;
  completed_at: string | null;
}

interface ExecutionState {
  executions: Execution[];
  currentExecution: Execution | null;
  loading: boolean;
  setExecutions: (execs: Execution[]) => void;
  setCurrentExecution: (exec: Execution | null) => void;
  addExecution: (exec: Execution) => void;
  updateExecution: (id: string, data: Partial<Execution>) => void;
  setLoading: (loading: boolean) => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  executions: [],
  currentExecution: null,
  loading: false,
  setExecutions: (execs) => set({ executions: execs }),
  setCurrentExecution: (exec) => set({ currentExecution: exec }),
  addExecution: (exec) => set((state) => ({ executions: [exec, ...state.executions] })),
  updateExecution: (id, data) => set((state) => ({
    executions: state.executions.map((e) => e.id === id ? { ...e, ...data } : e),
    currentExecution: state.currentExecution?.id === id ? { ...state.currentExecution, ...data } : state.currentExecution,
  })),
  setLoading: (loading) => set({ loading }),
}));
