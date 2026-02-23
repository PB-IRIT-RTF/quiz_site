# Вселенная ИРИТ‑РТФ — квиз (локальный запуск без Docker)

Этот репозиторий содержит:
- **frontend**: React + Vite + Tailwind (SPA)
- **backend**: FastAPI + SQLAlchemy async + SQLite (файл)

## Что установить (Windows)
1) **Node.js LTS** (18/20/22)
2) **Python 3.12+**
3) (желательно) **Git**

## Запуск (режим разработки, 2 процесса)

### 1) Backend
Важно: backend использует SQLite и **стартует даже без .env**, но если вы хотите явные настройки — создайте `backend/.env` на основе `backend/.env.example`.
Откройте PowerShell/Terminal:
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# первый запуск (создаст SQLite файл и демо-данные)
$env:DEMO_SEED="true"
# если PowerShell ругается на policy при Activate.ps1:
# Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

# На Windows `--reload` иногда ломает запуск (multiprocessing/spawn). Начните с запуска БЕЗ reload:
uvicorn app.main:app --host 127.0.0.1 --port 8000

# Если хотите autoreload:
# uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
# или используйте скрипты backend/run_dev_reload.ps1(.cmd) / run_backend_reload.ps1(.cmd)
```

Проверка:
- http://127.0.0.1:8000/api/health

Тестовый админ создаётся демо-сидингом:
- login: `admin`
- password: `admin` (можно переопределить `DEMO_ADMIN_PASSWORD`)

Примечание (Windows/Python 3.13):
- для хэширования паролей используется PBKDF2-SHA256 (стандартная библиотека),
  чтобы избежать проблем совместимости `passlib/bcrypt`.

### 2) Frontend
Во второй консоли из корня репозитория:
```powershell
npm install
$env:VITE_API_MODE="http"
$env:VITE_API_BASE="http://127.0.0.1:8000"
# На Windows лучше использовать 127.0.0.1, а не localhost (localhost может резолвиться в ::1, а uvicorn слушает только IPv4).
npm run dev
```

Открыть:
- http://127.0.0.1:5173

## Запуск “как локальный хостинг” (1 процесс: backend раздаёт dist)
Это самый надёжный вариант на Windows: **нет CORS**, фронт ходит на `/api` на том же хосте.

1) Собрать фронт (из корня репозитория):
```powershell
npm install
npm run build
```
После этого появится папка `dist/` **в корне репозитория**.

2) Запустить backend:
- самый простой способ: `./run_backend.ps1` (или `run_backend.cmd`)
- или вручную из `backend/`:
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

3) Открыть сайт:
- http://127.0.0.1:8000/

Проверка API:
- http://127.0.0.1:8000/api/health
- http://127.0.0.1:8000/api/quizzes/active

Если вместо сайта видите 404 на `/` — проверьте что `dist/` реально существует (после `npm run build`).

## База данных (SQLite)
По умолчанию backend использует файл:
- `backend/data/quiz.db`

Сбросить базу:
- остановить backend
- удалить `backend/data/quiz.db`
- запустить backend снова

## Production (Docker + Nginx)
1) Set real secrets in `backend/.env`:
```env
ENVIRONMENT=prod
COOKIE_SECRET=<long-random-secret>
COOKIE_SECURE=true
DEMO_SEED=false
FRONTEND_ORIGINS=https://your-domain.com
```

2) Build frontend in production mode:
```powershell
npm ci
npm run build
```

3) Provide TLS certs for nginx:
- `infra/nginx/certs/fullchain.pem`
- `infra/nginx/certs/privkey.pem`

4) Start stack:
```powershell
docker compose up -d --build
```

## Env Profiles (dev/prod)
- `backend/.env.dev` and `backend/.env.prod` are templates.
- Active profile is `backend/.env`.

Switch profile (PowerShell):
```powershell
cd backend
./use_env_dev.ps1   # or ./use_env_prod.ps1
```

Switch profile (CMD):
```cmd
cd backend
use_env_dev.cmd
:: or use_env_prod.cmd
```
