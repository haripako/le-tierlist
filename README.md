# 🏆 BuildTier — Community Build Rankings for Every ARPG

**BuildTier** is a Reddit-style platform where gamers vote, share, and rank the best character builds across action RPGs. Community-driven tier lists for every game, every season, every meta.

> **Live:** [le-tierlist.onrender.com](https://le-tierlist.onrender.com)

---

## Supported Games

| Category | Games |
|----------|-------|
| **ARPG** | Last Epoch · Diablo IV · Path of Exile 2 · Path of Exile · Diablo II Resurrected · Diablo III · Grim Dawn · Torchlight Infinite |
| **Looter-Shooter** | Destiny 2 · Borderlands 3 · Borderlands 4 |
| **Other** | Fallout 4 · Crimson Desert |

Each game has its own configurable modes (Softcore/Hardcore, PvE/PvP, SSF, Mayhem, etc.), classes, seasons, and tier list.

## Features

- **Community Voting** — Reddit-style upvote/downvote on every build. Anonymous voting (cookie-based identity) or registered user voting
- **Auto-extraction** — Paste a build guide URL (YouTube, Maxroll, Mobalytics, etc.) and BuildTier extracts name, class, mastery, skills, and description automatically
- **Per-game Tier Lists** — S/A/B/C/D tiers calculated from community votes, filterable by season, mode, and class
- **Configurable Game Modes** — Each game defines its own modes (Softcore/Hardcore, PvE/PvP/PvPvE, SSF/Trade, etc.)
- **Optional Seasons** — Games can opt in/out of seasonal rotation
- **Karma System** — Submitters earn karma from community votes on their builds (Newcomer → Regular → Trusted → Expert → Legendary)
- **Anonymous → Registered Migration** — Browse and submit as anonymous; register later and all your activity (builds + votes) transfers to your account
- **Social Content Generator** — Auto-generates shareable social media posts for every new build (Twitter/X, Instagram, TikTok, YouTube Shorts) with optimized hashtags and engagement copy
- **Admin Dashboard** — Full control panel: manage games, modes, classes, seasons, builds, users, and social content queue

## Architecture

```
├── client/                  # React 18 + Vite + Tailwind CSS v3 + shadcn/ui
│   ├── src/
│   │   ├── pages/           # Home, Game, Build Detail, Submit, User Profile, Admin
│   │   ├── components/      # BuildCard, Header, AdminLayout, SocialCard
│   │   ├── hooks/           # use-auth, use-votes, use-voter, use-toast
│   │   └── lib/             # queryClient, constants
├── server/                  # Express 5 + better-sqlite3 + Drizzle ORM
│   ├── routes.ts            # API endpoints (games, builds, votes, auth, admin, social)
│   ├── storage.ts           # Data access layer
│   ├── extract.ts           # URL auto-extraction (Maxroll, YouTube, LE Tools, etc.)
│   └── social.ts            # Social content generator
├── shared/
│   └── schema.ts            # Drizzle schema + Zod validators + TypeScript types
└── render.yaml              # One-click Render deploy
```

## API Endpoints

### Games
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games` | List all active games |
| GET | `/api/games/:slug` | Game detail + classes + seasons + modes |
| POST | `/api/games` | Create game (admin) |
| PATCH | `/api/games/:id` | Update game (admin) |
| DELETE | `/api/games/:id` | Delete game (admin) |

### Game Modes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games/:slug/modes` | Modes for a game |
| POST | `/api/games/:slug/modes` | Create mode (admin) |
| PATCH | `/api/game-modes/:id` | Update mode (admin) |
| DELETE | `/api/game-modes/:id` | Delete mode (admin) |

### Classes & Seasons
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games/:slug/classes` | Classes for a game |
| POST | `/api/games/:slug/classes` | Create class (admin) |
| GET | `/api/games/:slug/seasons` | Seasons for a game |
| POST | `/api/seasons` | Create season (admin) |

### Builds & Voting
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games/:slug/tier-list` | Tier list (filter by seasonId, gameModeId) |
| GET | `/api/games/:slug/builds` | All builds for a game |
| POST | `/api/builds` | Submit build (anon or logged-in) |
| POST | `/api/builds/:id/vote` | Registered user vote |
| POST | `/api/builds/:id/anon-vote` | Anonymous vote (cookie-based) |
| POST | `/api/extract-build` | Extract build info from URL |

### Social Content
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/social-queue` | Pending social posts |
| POST | `/api/admin/social-queue/:id/approve` | Approve and mark as posted |
| DELETE | `/api/admin/social-queue/:id` | Dismiss a social post |

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register (migrates anon activity) |
| POST | `/api/auth/login` | Login (migrates anon activity) |

## Season Management

1. Log in as admin (`admin` / `admin123`)
2. Go to Admin Dashboard → Seasons
3. Select a game from the dropdown
4. Create new season with name, slug, and patch version
5. Toggle `isActive` to control which seasons appear in filters

## Deploy (Free)

### One-click Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/haripako/le-tierlist)

### Manual

1. Go to [render.com](https://render.com) and connect your GitHub
2. **New** → **Web Service** → select this repo
3. **Build Command**: `npm install --include=dev && npm run build`
4. **Start Command**: `npm start`
5. **Instance Type**: Free

Free tier sleeps after 15 min idle (~30s cold start). Auto-deploys on every push to `master`.

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS v3, shadcn/ui, wouter, TanStack Query v5
- **Backend**: Express 5, better-sqlite3, Drizzle ORM
- **Auth**: Session-based with cookie voter identity for anonymous users
- **Deploy**: Render.com (free tier)

## License

MIT
