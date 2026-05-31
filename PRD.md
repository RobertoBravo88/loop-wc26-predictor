# Loop World Cup Predictor — Product Requirements Document
**Version:** 2.0  
**Date:** 28 May 2026  
**Status:** Approved for development  
**Author:** Claude (PM + Developer)  
**Client:** Robert Blaauboer, Loop Earplugs

---

## 1. Product Overview

An internal competition web app for Loop Earplugs employees to predict FIFA 2026 World Cup match results, earn points, and compete on a live leaderboard throughout the tournament (June–July 2026).

The app is fully Loop-branded, restricted to Loop employees, and powered by live data from the api-football.com API.

---

## 2. Tournament Context

- **Tournament:** FIFA World Cup 2026 (USA / Canada / Mexico)
- **Teams:** 48
- **Matches:** 104 (Group stage: 72 · Round of 32: 16 · QF: 8 · SF: 4 · 3rd place: 1 · Final: 1)
- **Format:** Group stage → Round of 32 → Quarterfinals → Semifinals → 3rd place playoff → Final

---

## 3. Users & Access

| Role | Description |
|------|-------------|
| **Player** | Any Loop employee. Signs up with email + password. Restricted to `@loopearplugs.com` domain. |
| **Admin** | Robert + small designated team. Access to admin panel. |

- **Authentication:** Email + password only
- **Email restriction:** `@loopearplugs.com` required at signup. Other domains are rejected with a clear message.
- **Language:** English only
- **Notifications:** None — players check the app directly

---

## 4. Points System

### 4.1 Match Predictions

| Result | Points |
|--------|--------|
| Exact correct score | 100 pts |
| Correct outcome only (W/D/L) | 50 pts |
| Wrong outcome | 0 pts |

**Knockout rounds:** Judged on **full-time (90-min) score only**. Extra time and penalties do not affect the prediction score.

### 4.2 Hot Streak Bonus 🔥

- A streak counts **only exact correct scores** — a correct outcome (wrong score) breaks the streak
- From **3 exact scores in a row** onwards, each additional exact score awards **+50 bonus points**
- Streak resets to 0 the moment a prediction is not an exact score

| Streak | Bonus points awarded |
|--------|---------------------|
| 1 exact score | 0 bonus |
| 2 exact scores in a row | 0 bonus |
| 3 exact scores in a row | +50 pts (on the 3rd) |
| 4 exact scores in a row | +50 pts (on the 4th) |
| 5 exact scores in a row | +50 pts (on the 5th) |
| …and so on | +50 pts per match |

- 🔥 badge appears on the leaderboard next to your name when you're on a streak of 3+
- The current streak length is shown on the badge (e.g. 🔥5)

### 4.3 Pre-Tournament Finalist Picks

| Pick | Points |
|------|--------|
| Correct tournament winner (1st) | 300 pts |
| Correct runner-up (2nd) | 200 pts |
| Correct 3rd place | 100 pts |

### 4.4 Goal Scorer Picks (pre-tournament, public)

- Before the tournament starts, each player selects **one player per team** from all 48 squads
- Every time that player scores during the tournament → **+10 pts**
- Picks lock when the tournament starts; cannot be changed

### 4.5 Secret Bonus — Favourite Team & Player

> **Design intent:** This is a hidden game mechanic. At signup, users are asked to select their favourite team and favourite player (from that team's squad). This is presented as personalisation only — the user is not told it gives bonus points. When the tournament starts, the app reveals the mechanic and shows accumulated secret bonus points. This cannot be changed after signup.

| Event | Points |
|-------|--------|
| Favourite team scores a goal | +10 pts (secret until reveal) |
| Favourite player scores a goal | +10 pts (secret until reveal) |

**Favourite player rule:** Must be a player from the same squad as their favourite team.

**Reveal moment:** When the tournament kicks off, the app displays a reveal notification/banner: *"Your secret bonus points are now live! You've been earning 10 points every time [Team] scores — and 10 more when [Player] finds the net."*

**Favourite team flag:** The team's flag is displayed next to the player's name on the leaderboard throughout the tournament.

---

## 5. Core Features

### 5.1 Authentication & Onboarding

**Sign-up flow:**
1. Enter name, email (`@loopearplugs.com` required), password
2. Pick favourite team (dropdown with all 48 WC teams + flags)
3. Pick favourite player (from that team's squad, pulled from API)
4. Email verification → account active

**Login:** Standard email + password with "Forgot password" flow.

### 5.2 Pre-Tournament Picks Page

Available from launch until the tournament's first match kicks off. Contains:
- **Finalist picks:** Select 1st, 2nd, and 3rd place finishers from 48 teams
- **Goal scorer picks:** For each of the 48 teams, select one player from their squad

All picks lock at the first match kick-off.

### 5.3 Match Predictions

- All 104 matches listed, grouped by stage/round
- Players enter predicted home score and away score for each match
- **Prediction lock:** Automatically locks at each match's kick-off time
- After lock, the predicted score is frozen and visible but not editable
- After the match ends, points are awarded automatically
- Knockout fixtures only appear once both teams are confirmed

### 5.4 Predicted Group Standings

On each group page, alongside the live/real standings:
- A **"Your predicted standings"** table is calculated by simulating all of the player's predicted scores for that group
- This updates as predictions are made/changed
- Compares directly against the real standings once matches are played

### 5.5 Leaderboard

- Live ranked leaderboard of all players
- Shows: rank · flag (favourite team) · name · total points · matches predicted
- 🔥 **Hot streak badge:** Awarded when a player gets 3+ correct outcomes in a row
- Filterable by: All · Group Stage · Knockout Rounds
- Your own row is highlighted

### 5.6 Personal Profile Page

Each player's profile shows:
- Total points and current rank
- Points breakdown by category (exact scores / correct outcomes / scorer bonus / finalist bonus / secret bonus — revealed after tournament start)
- Full prediction history with outcomes (correct / wrong / pending)
- Pre-tournament picks: finalists, goal scorers
- Favourite team flag and player

### 5.7 Group Pages

One page per group (A–L, 12 groups):
- Live standings pulled from API
- Your predicted standings (based on your picks)
- Match results and upcoming fixtures
- Goal scorers per match

### 5.8 Tournament Bracket (Knockout)

- Visual bracket showing Round of 32 through Final
- Fills in with real results as the tournament progresses
- Shows your predicted path vs. the actual path side by side

### 5.9 Pre-Match Prediction Reveal

- Once a match kicks off and locks, show all players what % of participants predicted each outcome
- Example: *"54% picked France · 30% Draw · 16% Morocco"*
- Visible on the match card after it locks
- Great engagement driver — people check the app right before kick-off

### 5.10 Match Reactions

- After a match ends, players can add an emoji reaction or short text comment (≤140 chars)
- Reactions are visible on the match result card
- Simple social layer — no moderation complexity (it's an internal tool)

### 5.11 News & Blog

Admins can publish short posts about:
- Tournament recaps
- Leaderboard updates and highlights
- Fun stats and milestones

Posts appear in a news feed on the home page and a dedicated `/news` page.
Posts have: title · body (rich text) · author · date · optional image.

### 5.12 Stats Page

Fun tournament-wide statistics:
- Most optimistic predictor (highest average predicted goals)
- Most pessimistic predictor
- Highest single-match score earned
- Most bonus points from goal scorers
- Player who predicted the most upsets
- Overall prediction accuracy % per player

### 5.13 Admin Panel

Admins can:
- View and manage all user accounts
- Manually trigger a score refresh from the API
- Override points if API data is incorrect
- Publish and manage news posts
- Set competition status: `upcoming` / `live` / `completed`
- View a live dashboard of platform activity

---

## 6. Technical Architecture

### Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Next.js 14 (React, App Router) | Modern, SSR, easy Vercel deployment |
| Backend | Next.js API routes | Same codebase, no separate server |
| Database | PostgreSQL via Supabase | Managed, real-time capable, auth built in |
| Auth | Supabase Auth | Email+password, domain restriction supported |
| Live data | api-football.com | Scores, squads, fixtures, goal events |
| Score sync | Cron job every 5 min during live matches | Via Vercel Cron (Pro) or cron-job.org (free) |
| Hosting | Vercel Pro (~$20/month) | Cron support, 60s function timeout, commercial use |
| Styling | Tailwind CSS | Fast, utility-first, easy to brand |

### Vercel Pro — Why it's needed
- Cron jobs require Vercel Pro (needed for live score polling)
- Commercial/company use is not permitted on Hobby tier
- 60-second function timeout (vs. 10s on free) — important for API calls
- Cost: ~$20/month

### api-football.com — Plan required
- Free tier: 100 req/day — **not sufficient** for live polling
- Recommended: Basic or Standard plan (~$15–30/month)
- Smart polling strategy: only poll during active matches, cache everything else

### Data Model (simplified)

| Table | Key fields |
|-------|-----------|
| `users` | id, name, email, role, favourite_team_id, favourite_player_id |
| `matches` | id, api_id, group, stage, home_team, away_team, kickoff_at, home_score, away_score, status |
| `predictions` | id, user_id, match_id, predicted_home, predicted_away, locked_at, points_awarded |
| `finalist_picks` | id, user_id, first_team_id, second_team_id, third_team_id |
| `scorer_picks` | id, user_id, team_id, player_id |
| `point_events` | id, user_id, type, points, match_id, description, created_at |
| `news_posts` | id, author_id, title, body, published_at, image_url |
| `match_reactions` | id, user_id, match_id, emoji, comment, created_at |
| `teams` | id, api_id, name, flag_url, group |
| `players` | id, api_id, team_id, name, position, photo_url |

### API Integration Strategy

| Data | Frequency | Storage |
|------|-----------|---------|
| Teams & groups | Once, pre-tournament | DB |
| Squads (players) | Once, pre-tournament | DB |
| Fixtures | Daily | DB |
| Live scores | Every 5 min (in-play matches only) | DB |
| Goal events | Post-match | DB |
| Standings | After each match | DB |

---

## 7. Screens & Pages

| Route | Page |
|-------|------|
| `/` | Home: leaderboard preview, next matches, news feed |
| `/predictions` | All matches grouped by stage — enter/view predictions |
| `/tournament-picks` | Pre-tournament: finalist picks + goal scorer selections |
| `/leaderboard` | Full ranked leaderboard |
| `/groups/[id]` | Group page: live standings, predicted standings, fixtures |
| `/bracket` | Visual knockout bracket: predicted vs. real |
| `/profile/[id]` | Player profile: full points breakdown and picks |
| `/stats` | Fun tournament-wide stats |
| `/news` | News/blog feed |
| `/news/[slug]` | Individual news article |
| `/admin` | Admin panel (role-gated) |
| `/auth/login` | Login |
| `/auth/signup` | Signup + favourite team/player picker |
| `/auth/reset` | Password reset |

---

## 8. Development Phases

### Phase 1 — Core (target: before first match)
- Auth (signup with team/player pick, login, reset)
- Database schema and Supabase setup
- API integration: teams, squads, fixtures
- Match predictions interface (all 104 matches)
- Pre-tournament picks (finalists + goal scorers)
- Basic leaderboard
- Group pages with live + predicted standings
- Points engine (auto-award after each match)
- Secret bonus reveal mechanic

### Phase 2 — Enhancement (week 2)
- Personal profile page with full breakdown
- Tournament bracket visual
- Pre-match prediction reveal (% distribution)
- Match reactions
- Stats page
- News/blog (admin publishes, players read)
- Hot streak badge 🔥
- Admin panel

### Phase 3 — Polish (ongoing)
- Performance optimisation
- Mobile refinements
- Edge cases (postponed matches, own goals, etc.)
- Loop branding (once assets received)

---

## 9. Open Items

| # | Item | Status |
|---|------|--------|
| 1 | Loop brand assets (logo SVG, hex colours) | ⏳ Robert to share |
| 2 | api-football.com account + API key | ⏳ Robert to create |
| 3 | Vercel Pro account setup | ⏳ Confirm before deploy |
| 4 | Supabase project creation | 🔧 Claude sets up |
| 5 | Custom domain (predictor.loopearplugs.com) | 💬 Optional — revisit |

---

## 10. Out of Scope (v1)

- Mobile app (web only, fully responsive)
- Social logins (Google, Microsoft)
- Email notifications of any kind
- Multiple languages
- Public access
- Prize/payment integrations
- Women's World Cup or other tournaments

---

## 11. Confirmed Settings

| Setting | Value |
|---------|-------|
| Tournament | FIFA World Cup 2026 |
| Access | `@loopearplugs.com` only |
| Auth | Email + password |
| Exact score points | 100 pts |
| Correct outcome points | 50 pts |
| 1st place pick | 300 pts |
| 2nd place pick | 200 pts |
| 3rd place pick | 100 pts |
| Goal scorer bonus | 10 pts/goal |
| Secret favourite team bonus | 10 pts/goal (revealed at tournament start) |
| Secret favourite player bonus | 10 pts/goal (revealed at tournament start) |
| Favourite player scope | From favourite team's squad only |
| Knockout scoring | Full-time (90 min) only |
| Hosting | Vercel Pro |
| Database | Supabase (PostgreSQL) |
| Live data | api-football.com |

---

*PRD v2.0 — All major decisions locked. Ready for development.*
