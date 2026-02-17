#!/usr/bin/env node

/**
 * Health Check Script for AI-DevHub
 * Проверяет доступность всех сервисов
 */

interface ServiceCheck {
  name: string;
  url?: string;
  port?: number;
  host?: string;
  timeout?: number;
}

interface CheckResult {
  service: string;
  status: 'UP' | 'DOWN';
  responseTime: number;
  error?: string;
}

const services: ServiceCheck[] = [
  {
    name: '🟢 Frontend',
    url: 'http://localhost:3002',
    timeout: 5000
  },
  {
    name: '🔵 Backend API',
    url: 'http://localhost:3001/health',
    timeout: 5000
  },
  {
    name: '🟠 Gitea',
    url: 'http://localhost:3000',
    timeout: 5000
  },
  {
    name: '🟣 Redis',
    host: 'localhost',
    port: 6379,
    timeout: 5000
  },
  {
    name: '🐘 PostgreSQL',
    host: 'localhost',
    port: 5432,
    timeout: 5000
  }
];

async function checkUrl(service: ServiceCheck): Promise<CheckResult> {
  const startTime = Date.now();
  
  try {
    const response = await Promise.race([
      fetch(service.url!),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), service.timeout || 5000)
      )
    ]);
    
    const responseTime = Date.now() - startTime;
    
    if (response instanceof Response && response.ok) {
      return {
        service: service.name,
        status: 'UP',
        responseTime
      };
    } else if (response instanceof Response) {
      return {
        service: service.name,
        status: 'UP',
        responseTime,
        error: `HTTP ${response.status}`
      };
    }
    
    throw new Error('Unknown response');
  } catch (error: any) {
    return {
      service: service.name,
      status: 'DOWN',
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}

async function checkPort(service: ServiceCheck): Promise<CheckResult> {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    const startTime = Date.now();
    const timeout = service.timeout || 5000;
    
    const onError = (error: any) => {
      socket.destroy();
      resolve({
        service: service.name,
        status: 'DOWN',
        responseTime: Date.now() - startTime,
        error: error.code || error.message
      });
    };
    
    socket.setTimeout(timeout);
    socket.on('error', onError);
    socket.on('timeout', onError);
    
    socket.connect(service.port!, service.host!, () => {
      const responseTime = Date.now() - startTime;
      socket.destroy();
      resolve({
        service: service.name,
        status: 'UP',
        responseTime
      });
    });
  });
}

async function runHealthCheck(): Promise<void> {
  console.log('\n╔══════════════════���═════════════════════════╗');
  console.log('║  🏥 AI-DevHub Health Check                 ║');
  console.log('║  ' + new Date().toISOString().split('T')[0] + '                              ║');
  console.log('╚════════════════════════════════════════════╝\n');
  
  const results: CheckResult[] = [];
  
  // Check each service
  for (const service of services) {
    let result: CheckResult;
    
    if (service.url) {
      result = await checkUrl(service);
    } else if (service.port) {
      result = await checkPort(service);
    } else {
      continue;
    }
    
    results.push(result);
    
    // Print result
    const statusIcon = result.status === 'UP' ? '✅' : '❌';
    const errorMsg = result.error ? ` (${result.error})` : '';
    console.log(`${statusIcon} ${result.service} - ${result.status} ${result.responseTime}ms${errorMsg}`);
  }
  
  // Summary
  console.log('\n' + '─'.repeat(44));
  const upCount = results.filter(r => r.status === 'UP').length;
  const downCount = results.filter(r => r.status === 'DOWN').length;
  
  console.log(`✅ UP: ${upCount}  ❌ DOWN: ${downCount}  📊 TOTAL: ${results.length}`);
  console.log('─'.repeat(44) + '\n');
  
  // Recommendations
  if (downCount > 0) {
    console.log('⚠️  Несколько сервисов недоступны. Рекомендации:');
    console.log('   1. Проверьте, запущены ли контейнеры: docker-compose ps');
    console.log('   2. Посмотрите логи: docker-compose logs');
    console.log('   3. Перезагрузите сервисы: docker-compose restart');
    console.log('   4. Подробнее см. в TROUBLESHOOTING.md\n');
  } else {
    console.log('✅ Все сервисы работают нормально!\n');
  }
  
  process.exit(downCount > 0 ? 1 : 0);
}

runHealthCheck().catch((error) => {
  console.error('❌ Ошибка при проверке здоровья:', error);
  process.exit(1);
});