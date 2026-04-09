# LE Tier List — Last Epoch Community Build Rankings

Plataforma de tier list comunitaria para Last Epoch donde los usuarios envían enlaces a guías de builds, votan, y acumulan karma como en Reddit.

![Dark gaming aesthetic](https://img.shields.io/badge/theme-dark%20gaming-1a1d24?style=flat-square) ![Express](https://img.shields.io/badge/backend-Express%205-lightgrey?style=flat-square) ![React](https://img.shields.io/badge/frontend-React%2018-61dafb?style=flat-square) ![SQLite](https://img.shields.io/badge/database-SQLite-003B57?style=flat-square)

## Características

- **Tier List comunitaria** — Los builds se clasifican en S/A/B/C/D según votos
- **Enlaces a guías originales** — YouTube, Maxroll, Last Epoch Tools, Mobalytics, Reddit
- **Auto-detección de fuente** — Pega una URL y se detecta automáticamente la plataforma
- **Sistema de karma tipo Reddit** — Los submitters ganan/pierden karma según votos
- **Títulos de reputación** — Newcomer, Regular, Trusted, Expert, Legendary
- **Gestión de temporadas** — Panel de administración para crear/editar/eliminar seasons
- **Filtros** — Por temporada, modo de juego (Softcore/Hardcore), clase y maestría
- **Perfiles de usuario** — Karma, título, historial de submissions
- **Dark theme gaming** — Estética oscura inspirada en Last Epoch

## Arquitectura

```
le-tierlist/
├── client/                 # Frontend React + Vite
│   ├── src/
│   │   ├── components/     # Header con auth, BuildCard
│   │   ├── hooks/          # useAuth (estado global sin localStorage)
│   │   ├── lib/            # Constants, queryClient
│   │   └── pages/          # Home, SubmitBuild, BuildDetail, UserProfile, AdminSeasons
│   └── index.html
├── server/                 # Backend Express
│   ├── index.ts            # Entry point, middleware, puerto dinámico
│   ├── routes.ts           # API routes + seed data
│   ├── storage.ts          # CRUD con Drizzle ORM + karma tracking
│   ├── db.ts               # Conexión SQLite
│   ├── static.ts           # Servir archivos estáticos en producción
│   └── vite.ts             # Dev server con HMR
├── shared/
│   └── schema.ts           # Modelos: users, seasons, builds, votes
├── script/
│   └── build.ts            # Build script (Vite + esbuild)
└── package.json
```

### Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18, Vite, Tailwind CSS v3, shadcn/ui, TanStack Query v5 |
| Backend | Express 5, Drizzle ORM |
| Base de datos | SQLite (better-sqlite3) — archivo local, sin servidor externo |
| Routing | wouter con hash-based routing (`/#/ruta`) |
| Tipado | TypeScript compartido entre client y server |

### Modelo de datos

```
users ──── 1:N ──── builds ──── 1:N ──── votes
                      │                     │
                      └── N:1 ── seasons    └── N:1 ── users
```

**Users**: username, passwordHash, isAdmin, karma, buildSubmissions  
**Seasons**: slug, name, patch, isActive, sortOrder  
**Builds**: name, className, mastery, seasonId, gameMode, playstyle, description, mainSkills (JSON), guideUrl, sourceType, submitterId, upvotes, downvotes  
**Votes**: buildId, userId, voteType (up/down) — unique por build+user

## API Endpoints

### Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/register` | Crear cuenta. Body: `{ username, password }` |
| `POST` | `/api/auth/login` | Iniciar sesión. Body: `{ username, password }` |

### Usuarios

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/users/:id` | Perfil de usuario + sus builds |
| `GET` | `/api/users/top/leaderboard` | Top 20 usuarios por karma |

### Temporadas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/seasons` | Listar todas las temporadas |
| `POST` | `/api/seasons` | Crear temporada (admin). Body: `{ adminUserId, slug, name, patch, isActive, sortOrder }` |
| `PATCH` | `/api/seasons/:id` | Editar temporada (admin). Body: `{ adminUserId, ...campos }` |
| `DELETE` | `/api/seasons/:id` | Eliminar temporada (admin). Body: `{ adminUserId }` |

### Builds

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/builds` | Listar builds. Query params: `seasonId`, `gameMode`, `className`, `mastery` |
| `GET` | `/api/builds/:id` | Detalle de un build |
| `POST` | `/api/builds` | Enviar build. Body: `{ name, className, mastery, seasonId, gameMode, playstyle, description, mainSkills, guideUrl, submitterId }` |

### Votos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/builds/:id/vote` | Votar. Body: `{ userId, voteType }` — voteType: "up" o "down". Repetir misma dirección = quitar voto |
| `GET` | `/api/votes/user/:userId` | Votos de un usuario |

### Tier List

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/tier-list` | Tier list calculada. Query params: `seasonId`, `gameMode`. Devuelve `{ S: [...], A: [...], B: [...], C: [...], D: [...] }` |

### Utilidades

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/detect-source` | Detectar fuente de URL. Body: `{ url }`. Devuelve: `{ source: "youtube" | "maxroll" | ... }` |

## Gestión de temporadas

### Desde la UI (recomendado)

1. Inicia sesión como admin (user: `admin`, pass: `admin123`)
2. Haz clic en tu nombre de usuario → **Manage Seasons**
3. Desde ahí puedes:
   - **Añadir temporada** — clic en "Add Season", rellena slug (ej: `s5`), nombre, versión de patch, orden
   - **Editar temporada** — clic en el icono de lápiz para cambiar nombre, estado activo, etc.
   - **Eliminar temporada** — clic en el icono de papelera
   - **Desactivar temporada** — edita y desactiva el switch "Active" para ocultar de los filtros

### Desde la API

```bash
# Crear temporada
curl -X POST http://localhost:5000/api/seasons \
  -H "Content-Type: application/json" \
  -d '{"adminUserId": 1, "slug": "s5", "name": "Season 5 — New Dawn", "patch": "1.5", "isActive": true, "sortOrder": 6}'

# Editar temporada
curl -X PATCH http://localhost:5000/api/seasons/1 \
  -H "Content-Type: application/json" \
  -d '{"adminUserId": 1, "name": "Season 4 — Nombre Actualizado"}'

# Desactivar temporada
curl -X PATCH http://localhost:5000/api/seasons/1 \
  -H "Content-Type: application/json" \
  -d '{"adminUserId": 1, "isActive": false}'

# Eliminar temporada
curl -X DELETE http://localhost:5000/api/seasons/1 \
  -H "Content-Type: application/json" \
  -d '{"adminUserId": 1}'
```

## Cálculo de tiers

Los builds se clasifican automáticamente según su posición relativa por score (`upvotes - downvotes`):

| Tier | Percentil | Descripción |
|------|-----------|-------------|
| S | Top 10% | Meta-defining |
| A | 10-25% | Excellent |
| B | 25-50% | Good |
| C | 50-75% | Average |
| D | 75-100% | Below Average |

## Sistema de karma

- Cuando alguien vota **positivo** a tu build: **+1 karma**
- Cuando alguien vota **negativo** a tu build: **-1 karma**
- Si alguien cambia o retira su voto, el karma se ajusta
- Títulos de reputación:

| Karma | Título |
|-------|--------|
| 1000+ | Legendary |
| 500+ | Expert |
| 200+ | Trusted |
| 50+ | Regular |
| 0+ | Newcomer |
| < 0 | Controversial |

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (Express + Vite HMR)
npm run dev

# Abrir en el navegador
open http://localhost:5000
```

La base de datos SQLite se crea automáticamente al iniciar y se rellena con datos de ejemplo (8 usuarios, 5 temporadas, ~20 builds).

## Build y producción

```bash
# Build
npm run build

# Iniciar en producción
npm start
# o directamente:
NODE_ENV=production node dist/index.cjs
```

## Deploy en Render (gratis)

1. Haz push del repo a GitHub
2. Ve a [render.com](https://render.com) y conecta tu cuenta de GitHub
3. Clic en **New** → **Web Service**
4. Selecciona este repositorio
5. Configura:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
6. Clic en **Create Web Service**

El servicio se despliega automáticamente con cada push a `main`. La versión gratuita se suspende tras 15 minutos sin tráfico (tarda ~30s en despertar).

## Datos de ejemplo

Al arrancar la app crea automáticamente:

- **Admin**: user `admin` / pass `admin123`
- **8 usuarios** con distintos niveles de karma (Boardman21, Perrythepig, LizardIRL, McFluffin, Trem, Epoch_Builds, Tunklab, CookBook)
- **5 temporadas**: Release 1.0 → Season 4
- **~20 builds** con votos, fuentes variadas (YouTube, Maxroll, LE Tools)
- Contraseña de todos los usuarios de ejemplo: `pass123`

## Licencia

MIT
