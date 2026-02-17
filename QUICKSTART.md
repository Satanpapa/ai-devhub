# ⚡ Быстрый старт AI-DevHub

> 📖 Полная документация доступна в [README.md](README.md)  
> 🔧 При проблемах см. [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

## 🎯 Требования

- **Node.js** >= 18.0.0  
- **Docker** >= 20.10 + **Docker Compose** >= 2.0  
- **Аккаунт Supabase** (бесплатный на https://supabase.com)  
- **GitHub Token** (опционально, для интеграции)

**Проверить версии:**
```bash
node --version      # >= 18.0.0
npm --version       # >= 9.0.0
docker --version    # >= 20.10
docker-compose --version  # >= 2.0
```

---

## 🚀 Запуск за 5 минут

### Шаг 1: Клонировать репозиторий

```bash
git clone https://github.com/Satanpapa/ai-devhub.git
cd ai-devhub
```

### Шаг 2: Создать переменные окружения

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env.local

# Root
cp .env.example .env
```

### Шаг 3: Заполнить переменные Supabase

1. Откройте https://supabase.com и создайте проект (бесплатно)
2. Перейдите **Settings > API**
3. Скопируйте и заполните в файлах:

```bash
# backend/.env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Шаг 4: Инициализировать БД

1. Откройте **Supabase Dashboard > SQL Editor**
2. Выполните содержимое файла `supabase/schema.sql`

### Шаг 5: Запустить приложение

**Вариант A: Docker Compose (рекомендуется)**

```bash
# Запустить все сервисы
docker-compose up -d

# Проверить статус
docker-compose ps

# Посмотреть логи
docker-compose logs -f
```

**Вариант B: Локально (разработка)**

```bash
# Терминал 1 - Валидация переменных
npm run validate-env

# Терминал 2 - Backend (из корня)
cd backend
npm install
npm run dev
# Откроется на http://localhost:3001

# Терминал 3 - Frontend (из корня)
cd frontend
npm install
npm run dev
# Откроется на http://localhost:3002

# Терминал 4 - Redis (если нужен)
docker run -d -p 6379:6379 redis:latest
```

### Шаг 6: Проверить работу

```bash
# Проверить все сервисы
npm run healthcheck

# Или вручную
curl http://localhost:3001/health
curl http://localhost:3002
```

**Доступные URLs:**
- 🟢 Frontend: http://localhost:3002
- 🔵 Backend API: http://localhost:3001
- 🟠 Gitea: http://localhost:3000

---

## 📋 Полезные команды

```bash
# Валидировать переменные окружения
npm run validate-env

# Проверить статус сервисов
npm run healthcheck

# Посмотреть логи Docker
docker-compose logs -f backend
docker-compose logs -f frontend

# Остановить контейнеры
docker-compose down

# Полная переустановка
docker-compose down -v
rm -rf node_modules backend/node_modules frontend/node_modules
npm install
npm run validate-env
docker-compose up -d
```

---

## 🐛 При возникновении ошибок

### ❌ "Port already in use" — Порт занят

```bash
# Для Linux/Mac
lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Для Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Или просто измените порты в .env
PORT=3011
```

### ❌ "Redis connection refused" — Redis недоступен

```bash
docker run -d -p 6379:6379 redis:latest
# или
docker-compose up -d redis
```

### ❌ "Supabase authentication error" — Ошибка аутентификации

1. Проверьте ключи в backend/.env и frontend/.env.local
2. Убедитесь, что проект активен на https://supabase.com
3. Добавьте http://localhost:3002 в Settings > Authentication > URL Configuration

**Больше решений в [TROUBLESHOOTING.md](TROUBLESHOOTING.md)**

---

## 📚 Дальнейшее изучение

1. **API Документация** — см. [README.md#api-документация](README.md#-api-документация)
2. **Архитектура** — см. [README.md#архитектура](README.md#-архитектура)
3. **Деплой** — см. [README.md#деплой](README.md#-деплой)
4. **AGENTS.md** — информация о работе с агентами

---

## 💡 Советы

✅ **Используйте Docker Compose** для локальной разработки  
✅ **Сохраняйте .env файлы в .gitignore** (не коммитьте учетные данные!)  
✅ **Запускайте validate-env перед каждым запуском**  
✅ **Посмотрите TROUBLESHOOTING.md перед тем, как создавать Issue**  

---

**Готово! 🎉 Теперь вы можете начать разработку.**

Если есть вопросы → [GitHub Issues](https://github.com/Satanpapa/ai-devhub/issues)