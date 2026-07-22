# GymIQ — UI Design Specification

**Direction:** Light & institutional. Clean, trustworthy, professional — built to make a school director feel this is a serious tool worth paying for. Green is an accent (action, success, rank), never the whole room. A brighter "energy green" appears only in player-facing / gamified moments.

**Primary audience of first impression:** School directors & academy owners (the buyer). Secondary: coaches (daily driver), parents & players (engagement).

**Platforms:** Responsive web first (React/Vite), mobile app later (React Native). Every layout below is defined mobile-first, then desktop.

---

## 1. Design principles

1. **Credibility over flash.** Generous whitespace, restrained color, real data density where it counts (reports, squad lists). It should look like software a school pays for, not a toy.
2. **One clear action per screen.** Each page has a single primary CTA in brand green; everything else is secondary/tertiary.
3. **Mobile-first for coaches.** Coaches log on a phone after training — logging flows must work with one thumb.
4. **Role-appropriate density.** Admin/coach = information-dense dashboards. Parent/player = spacious, visual, emotional.
5. **Accessible by default.** WCAG AA contrast, 44px minimum touch targets, visible focus rings, no color-only meaning.

---

## 2. Brand & visual language (summary — full tokens in `gymiq-design-system.css`)

- **Ink / primary:** deep institutional navy — headings, nav, primary text.
- **Brand green:** the action & success color (buttons, active states, positive stats).
- **Energy green:** brighter, reserved for player rank/gamification highlights only.
- **Neutrals:** cool light-gray app background, white surfaces, soft borders and shadows.
- **Semantic:** success (green), warning (amber), danger (red), info (blue).
- **Type:** *Plus Jakarta Sans* for display/headings (modern, confident), *Inter* for body/UI (legible, neutral).
- **Shape:** cards 14px radius, buttons 10px, inputs 10px. Soft, low shadows — no heavy drop-shadows.

---

## 3. App shell & navigation

### Desktop (≥1024px)
- **Left sidebar (240px, collapsible to 72px):** logo at top, primary nav grouped by section, org switcher / user menu pinned to bottom. Active item = green left-border + tinted background.
- **Top bar (64px):** page title + breadcrumb on the left; global search, notifications bell, and avatar menu on the right.
- **Content area:** max-width 1200px, 24–32px padding, responsive card grid.

### Mobile (<768px)
- **Top app bar (56px):** hamburger / back, page title, notifications bell.
- **Bottom tab bar (64px):** 3–5 role-specific tabs with icons + labels. Primary action floats as a green FAB where relevant (e.g., coach "Log").
- Sidebar collapses into a slide-over drawer.

### Nav per role
| Role | Primary nav items |
|------|-------------------|
| **Admin** | Dashboard · Teams · Players · Trials · Reports · Settings |
| **Coach** | Dashboard · Squad · Log (FAB) · Schedule · Messages |
| **Parent** | My Child · Schedule · Messages · Notifications |
| **Player** | My Profile · Leaderboard · Schedule |

---

## 4. Screen inventory & layouts

### 4.0 Public / marketing (attract the school)
**Landing page** — the pitch to a director. Sections top-to-bottom:
1. **Hero:** headline ("Run your academy like a pro club"), sub-line, primary CTA "Book a pilot", secondary "See how it works", product screenshot/mockup on the right.
2. **Trust strip:** "Built for academies. One subscription per school." + logos/placeholders.
3. **Problem → solution:** the pains (WhatsApp chaos, bench-decision arguments, 800-on-paper trials) mapped to modules.
4. **Module showcase:** 8 core modules as cards with icons (profiles, stats, schedule, ranks, trials, messaging, leaderboard, multi-sport).
5. **Roles:** four columns — what Admin / Coach / Parent / Player each get.
6. **Gamification highlight:** the rank ladder (Rookie → Grand Master) as an emotional hook.
7. **Pricing:** one plan, per-school, "starts free" framing + "Book a pilot" CTA.
8. **Footer:** contact, RevidArch, legal.

### 4.1 Auth
- **Login:** centered card on a subtle branded background (left panel with brand imagery on desktop). Email + password, "Forgot password", primary green "Sign in".
- **Register:** same frame + **role selector** (segmented control: Admin / Coach / Parent / Player). Parent registration reveals a "Child code" field. Coach registration is invite-only (token in URL).
- **States:** clear inline validation, denied-access message, loading button.

### 4.2 Admin
- **Dashboard:** KPI row (Total players · Teams · Avg attendance % · Upcoming fixtures · Trial pipeline). Below: attendance trend chart, upcoming fixtures list, recent trial registrations, "Star player per age group" spotlight.
- **Teams:** table/grid of teams (division, sport, #players, coach). Create-team button (primary). Row → team detail.
- **Players:** searchable, filterable directory (division, team, rank). Cards or table toggle. Row → player profile (full access incl. medical).
- **Trials:** list of trial events + "Create trial". Detail view = QR code panel + registrations table with outcome status chips.
- **Reports:** filters (date range, team, metric) → preview → Export (CSV/PDF).
- **Settings:** org profile, **sports** (add sport type — multi-sport expansion), **invite coaches** (email), subscription/billing.

### 4.3 Coach (mobile-first)
- **Dashboard:** "Today" card (next session/match + quick "Log" CTA), my teams, squad alerts (low attendance).
- **Squad list:** players with attendance % and avg rating; sortable. Tap → player detail.
- **Log training:** date, then a fast attendance checklist (tap to toggle present/absent), session note. Big green "Save".
- **Log match:** opponent, date, result → per-player row: minutes, goals, assists, rating (star/segmented), note. Swipe between players.
- **Player detail:** header (photo, name, position, rank), tabs — Stats · Notes & Diet · Bench · AI Summary. "Mark benched + reason" action (parent-visible).

### 4.4 Parent (spacious, reassuring)
- **My Child overview:** child header with rank badge; cards for Next game, Latest coach comment, Bench status + reason, Diet plan checklist, Attendance & minutes summary. Calm, single-column, scrollable.
- **Schedule:** upcoming fixtures & training for the child's team.
- **Messages / Notifications:** coach updates, automated alerts (why benched, what to work on, diet reminders, trial outcomes).

### 4.5 Player (engaging, gamified)
- **My Profile:** big **rank badge with progress bar** (energy green), stat cards (attendance, minutes, avg rating), rank ladder showing next tier, last-3 coach notes, next event, **AI Summary — Last 30 Days** card with Regenerate. Medical flag hidden from player.
- **Leaderboard:** top performers per division, star-player spotlight, the player's own position highlighted.

### 4.6 Trial day (public, no login)
- **QR registration form:** single mobile screen — child name, age, position, parent name, phone, email → big "Register" → confirmation screen. Academy-branded header.

---

## 5. Core components (design-system library)

**Foundational:** Button (primary/secondary/ghost/danger), Input, Select, Checkbox/Toggle, Radio/Segmented control, Textarea, Search field.

**Layout:** App shell (sidebar + topbar), Bottom tab bar, Card, Section header, Tabs, Modal / slide-over, Toast.

**Data:** KPI / Stat card, Data table (sortable, with status chips), Avatar, Badge / Chip, Progress bar, Empty state, Chart wrapper.

**Domain-specific:**
- **RankBadge** — tier name + colored ring + progress bar; sizes sm/lg. Tier colors: Rookie (slate), Rising Star (blue), Elite (green), Master (amber), Grand Master (magenta).
- **RankLadder** — horizontal stepper of the five tiers, current highlighted.
- **PlayerCard** — photo, name, position, rank chip, quick stats.
- **AttendanceRow** — name + present/absent toggle (coach logging).
- **FixtureItem** — date, opponent, venue, home/away.
- **NotificationItem** — icon, message, time, read/unread dot.
- **OutcomeChip** — accepted / declined / pending (trial registrations).

---

## 6. Interaction & motion
- Transitions 150–200ms ease-out; page content fades/slides in subtly.
- Buttons: slight press-down + shadow change. Cards: hover lift on desktop only.
- Rank progress bar animates on load. Rank-up = brief celebratory accent (player-facing only).
- Never animate purely decoratively on data-dense admin screens.

---

## 7. Deliverables in this folder
- `GymIQ_Design_Spec.md` — this document.
- `gymiq-design-system.css` — installable design tokens + base component styles.
- `style-guide.html` — open in a browser to see the palette, type, components, and sample screens.
- `claude-design-prompt.md` — paste-ready prompt to generate the full UI project in Claude Design.
