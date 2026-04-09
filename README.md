# BuildTier

Community-driven build tier lists for ARPGs and looter-shooters. Players submit, vote, and bookmark builds — the community decides what's S-tier.

## Tech Stack

- **Backend**: Express 5 + TypeScript + SQLite (better-sqlite3 + Drizzle ORM)
- **Frontend**: React 18 + Vite + Tailwind CSS v3 + shadcn/ui
- **Routing**: Wouter (hash routing)
- **Data fetching**: TanStack Query v5

## Features

### Games & Builds
- Multiple games supported (Last Epoch, Diablo IV, Path of Exile 2, and more)
- Community tier list automatically calculated from votes (S/A/B/C/D/N tiers)
- Filter by game mode, season, and class
- Trending and Viral build discovery
- Build thumbnails extracted from YouTube videos and og:image meta tags
- Quick game switcher dropdown on every game page

### Submission Flow
- Paste a build guide URL (YouTube, Maxroll, Icy Veins, Reddit, etc.)
- AI-assisted extraction pre-fills class, mastery, skills, difficulty, and budget level
- Context-aware: submitting from a game page auto-selects that game
- Anonymous or logged-in submission supported

### Voting
- Anonymous voting via cookie-based voter hash (1 vote per build per user)
- Registered users can also vote
- Upvote/downvote affects tier placement

## User Permissions

### Anonymous users CAN:
- View all builds, tier lists, and games
- Vote on builds (anonymous vote, 1 per build via cookie)
- Submit builds (as "Anonymous")
- View build details

### Registered users CAN (additionally):
- **Bookmark builds** — save builds and view them in Settings → Bookmarks
- **Report builds** — flag inappropriate or incorrect builds for admin review
- Change password
- Customize profile with bio and avatar emoji
- Earn karma from upvotes on their submitted builds
- Their builds show their username instead of "Anonymous"

## Admin Panel (`/#/admin`)

Accessible to admin users only (login required).

| Section | Description |
|---------|-------------|
| Dashboard | Stats overview (games, builds, users) |
| Categories | Manage game categories |
| Games | Add/edit games with colors, icons, category |
| Game Modes | Manage modes per game (Softcore, Hardcore, etc.) |
| Classes | Manage classes and masteries per game |
| Seasons | Manage active seasons per game |
| Builds | View, moderate, and delete builds |
| **Reports** | Review user-reported builds — dismiss or delete |
| Social Queue | Review and manage auto-generated social media posts |
| Users | View all registered users |

### Reports
- Reports page shows: reporter hash, reason, build name, game name, date
- Report count badge appears on sidebar nav item when reports are pending
- Admin can **Dismiss** (remove report, keep build) or **Delete Build** (remove both)

## Development

```bash
cd le-tierlist
npm install
npm run dev
```

Server starts on port 5000. The dev server auto-reloads on file changes.

### Database
SQLite database at `data.db`. Schema migrations are applied automatically on startup via try/catch ALTER TABLE statements. To reset: `rm -f data.db data.db-shm data.db-wal`.

### Default admin account
- Username: `haripako`
- Password: `admin123`

## Build & Deploy

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

## API Highlights

| Endpoint | Description |
|----------|-------------|
| `GET /api/games` | All games with metadata |
| `GET /api/games/:slug` | Single game with classes, seasons, modes |
| `GET /api/games/:slug/tier-list` | Tier-ranked builds for a game |
| `POST /api/builds` | Submit a new build |
| `POST /api/builds/:id/vote` | User vote (requires userId) |
| `POST /api/builds/:id/anon-vote` | Anonymous vote (cookie) |
| `POST /api/builds/:id/bookmark` | Bookmark a build (requires userId, login required) |
| `POST /api/builds/:id/report` | Report a build (cookie-based) |
| `POST /api/extract-build` | Extract build info from a URL |
| `GET /api/admin/reports` | All reports (admin only) |
| `DELETE /api/admin/reports/:id` | Dismiss a report (admin only) |
| `DELETE /api/admin/builds/:id` | Delete a build (admin only) |
