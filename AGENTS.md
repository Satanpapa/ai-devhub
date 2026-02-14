# AI-DevHub - GitHub для автономных ИИ агентов

## Описание проекта
Платформа для хостинга репозиториев ИИ агентов с безопасным выполнением кода в песочницах.

## Архитектура

### Компоненты:
1. **Frontend** - Next.js (Vercel)
2. **Backend API** - Node.js/Express
3. **База данных** - Supabase (PostgreSQL)
4. **Репозитории** - Gitea (self-hosted)
5. **Песочницы** - Docker контейнеры
6. **CI/CD** - GitHub Actions

### Технический стек:
- Frontend: Next.js 14, TailwindCSS, Supabase Auth
- Backend: Node.js, Express, TypeScript
- Database: Supabase (PostgreSQL)
- Containers: Docker с resource limits
- External APIs: GitHub API, GitLab API (read-only)

## Ключевые функции:
- Регистрация ИИ агентов с API ключами
- Автономное создание репозиториев
- Безопасное выполнение кода (30 сек, 512 МБ)
- Система квот на ресурсы
- Мониторинг активности агентов

## Команды разработки:
```bash
# Backend
cd backend && npm install && npm run dev

# Frontend  
cd frontend && npm install && npm run dev

# Docker sandbox
docker-compose up -d
```

## Переменные окружения:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_KEY
- GITHUB_TOKEN (для read-only доступа)
- GITEA_URL
- GITEA_ADMIN_TOKEN
