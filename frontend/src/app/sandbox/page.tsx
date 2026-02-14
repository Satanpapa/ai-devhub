'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAppStore, useExecutionStore } from '@/lib/store';
import api from '@/lib/api';
import { Terminal, Play, Loader2, Clock, MemoryStick, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const LANGUAGES = [
  { id: 'python', name: 'Python', ext: 'py' },
  { id: 'javascript', name: 'JavaScript', ext: 'js' },
  { id: 'typescript', name: 'TypeScript', ext: 'ts' },
  { id: 'go', name: 'Go', ext: 'go' },
  { id: 'rust', name: 'Rust', ext: 'rs' },
];

const CODE_TEMPLATES: Record<string, string> = {
  python: `# Python Example
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

for i in range(10):
    print(f"fib({i}) = {fibonacci(i)}")
`,
  javascript: `// JavaScript Example
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i < 10; i++) {
  console.log(\`fib(\${i}) = \${fibonacci(i)}\`);
}
`,
  typescript: `// TypeScript Example
function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i < 10; i++) {
  console.log(\`fib(\${i}) = \${fibonacci(i)}\`);
}
`,
  go: `package main

import "fmt"

func fibonacci(n int) int {
    if n <= 1 {
        return n
    }
    return fibonacci(n-1) + fibonacci(n-2)
}

func main() {
    for i := 0; i < 10; i++ {
        fmt.Printf("fib(%d) = %d\\n", i, fibonacci(i))
    }
}
`,
  rust: `fn fibonacci(n: u32) -> u32 {
    if n <= 1 {
        return n;
    }
    fibonacci(n - 1) + fibonacci(n - 2)
}

fn main() {
    for i in 0..10 {
        println!("fib({}) = {}", i, fibonacci(i));
    }
}
`,
};

export default function Sandbox() {
  const router = useRouter();
  const { apiKey, isAuthenticated } = useAppStore();
  const { executions, setExecutions, addExecution, updateExecution } = useExecutionStore();
  
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(CODE_TEMPLATES.python);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated || !apiKey) {
      router.push('/');
      return;
    }
    api.setApiKey(apiKey);
    
    api.listExecutions(20).then(res => {
      setExecutions(res.executions || []);
    }).catch(console.error);
  }, [isAuthenticated, apiKey, router, setExecutions]);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    setCode(CODE_TEMPLATES[lang] || '');
  };

  const handleExecute = async () => {
    if (!code.trim()) return;
    
    setExecuting(true);
    setResult(null);
    
    try {
      const res = await api.executeCodeSync({
        language,
        code,
        timeout_ms: 30000,
      });
      
      setResult(res);
      addExecution({
        id: res.execution_id,
        status: res.status,
        language: res.language,
        code,
        stdout: res.stdout,
        stderr: res.stderr,
        exit_code: res.exit_code,
        duration_ms: res.duration_ms,
        memory_used_mb: res.memory_used_mb,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
    } catch (error: any) {
      setResult({
        status: 'failed',
        stderr: error.response?.data?.message || error.message || 'Execution failed',
        exit_code: -1,
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Terminal className="w-8 h-8 text-primary-500" />
          Code Sandbox
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Execute code in isolated containers (30s timeout, 512MB memory)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Code Editor */}
        <div className="lg:col-span-2 space-y-4">
          {/* Language Selector */}
          <div className="flex gap-2 flex-wrap">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                onClick={() => handleLanguageChange(lang.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  language === lang.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>

          {/* Editor */}
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">
              <span className="text-sm font-medium">
                main.{LANGUAGES.find(l => l.id === language)?.ext}
              </span>
              <button
                onClick={handleExecute}
                disabled={executing || !code.trim()}
                className="btn btn-primary flex items-center gap-2 py-1.5 px-3"
              >
                {executing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Run
              </button>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-[400px] p-4 font-mono text-sm bg-gray-900 text-gray-100 resize-none focus:outline-none"
              spellCheck={false}
            />
          </div>

          {/* Results */}
          {result && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                {result.status === 'completed' && result.exit_code === 0 ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                <span className="font-medium">
                  {result.status === 'completed' && result.exit_code === 0 ? 'Success' : 'Error'}
                </span>
                {result.duration_ms && (
                  <span className="text-sm text-gray-500 ml-auto flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {result.duration_ms}ms
                  </span>
                )}
                {result.memory_used_mb && (
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <MemoryStick className="w-4 h-4" />
                    {result.memory_used_mb}MB
                  </span>
                )}
              </div>
              
              {result.stdout && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 mb-1">stdout:</p>
                  <pre className="p-3 bg-gray-900 text-green-400 rounded-lg text-sm overflow-x-auto">
                    {result.stdout}
                  </pre>
                </div>
              )}
              
              {result.stderr && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">stderr:</p>
                  <pre className="p-3 bg-gray-900 text-red-400 rounded-lg text-sm overflow-x-auto">
                    {result.stderr}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Execution History */}
        <div className="card h-fit">
          <h2 className="text-lg font-semibold mb-4">Execution History</h2>
          
          {executions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No executions yet</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {executions.map((exec) => (
                <div
                  key={exec.id}
                  className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => {
                    setLanguage(exec.language);
                    setCode(exec.code);
                    setResult({
                      status: exec.status,
                      stdout: exec.stdout,
                      stderr: exec.stderr,
                      exit_code: exec.exit_code,
                      duration_ms: exec.duration_ms,
                      memory_used_mb: exec.memory_used_mb,
                    });
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{exec.language}</span>
                    <StatusBadge status={exec.status} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {format(new Date(exec.created_at), 'MMM d, HH:mm:ss')}
                  </p>
                  {exec.duration_ms && (
                    <p className="text-xs text-gray-400 mt-1">
                      {exec.duration_ms}ms
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    completed: { bg: 'bg-green-100', text: 'text-green-700' },
    running: { bg: 'bg-blue-100', text: 'text-blue-700' },
    queued: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    failed: { bg: 'bg-red-100', text: 'text-red-700' },
    timeout: { bg: 'bg-orange-100', text: 'text-orange-700' },
  };
  const { bg, text } = config[status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
      {status}
    </span>
  );
}
