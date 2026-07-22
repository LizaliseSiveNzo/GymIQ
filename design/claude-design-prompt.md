# Claude Design — Project Prompt for GymIQ

Paste the block below into Claude Design (claude.ai → Design, or the "New design project" flow) to generate the GymIQ UI. It encodes the brand, tokens, and every screen. Generate screens one section at a time for best results, then ask for a shared component library.

---

## PROMPT — paste from here ↓

Create a new design project called **GymIQ** — a sports academy management platform (SaaS). One subscription per school; starts with soccer, expands to rugby, cricket, chess. The buyer is a **school director / academy owner**, so the design must feel **professional, trustworthy, and premium** — software a school pays for, not a toy.

**Art direction: light & institutional.**
- Clean white surfaces on a cool light-gray background (#F5F8FC). Generous whitespace. Soft, low shadows.
- Primary text / nav / headings in deep institutional **navy (#0A1730 / #16305C)**.
- **Green is an accent only** — used for primary buttons, active nav, success, and positive stats. Primary green **#0BA05F**.
- Reserve a brighter **energy green #00E676** exclusively for player-facing / gamified moments (rank badges, progress bars, rank-up).
- Semantic: warning #E8A400, danger #E5484D, info #2E77D0.
- Rank tier colors: Rookie slate #64748B, Rising Star blue #2E77D0, Elite green #0BA05F, Master amber #E8A400, Grand Master magenta #C2379A.

**Typography:** *Plus Jakarta Sans* (600–800) for display/headings; *Inter* (400–600) for body/UI. Tight, confident heading letter-spacing.

**Shape & feel:** cards radius 14px, buttons/inputs radius 10px, pills fully rounded. 4/8px spacing scale. 44px minimum touch targets, visible green focus rings, WCAG AA contrast. Subtle 150–200ms ease-out transitions; hover-lift on desktop cards only.

**Layout system:**
- Desktop: dark navy **left sidebar** (240px, collapsible) with grouped nav + active item marked by a green left-border and tinted background; a 64px **top bar** with page title, global search, notifications bell, avatar menu; content max-width 1200px.
- Mobile-first: 56px top app bar + bottom tab bar (3–5 role tabs); primary action as a green FAB where relevant. Everything responsive.

**Roles & their navigation:**
- Admin: Dashboard · Teams · Players · Trials · Reports · Settings
- Coach: Dashboard · Squad · Log (FAB) · Schedule · Messages
- Parent: My Child · Schedule · Messages · Notifications
- Player: My Profile · Leaderboard · Schedule

**Screens to design (generate in this order):**
1. **Marketing landing page** (to attract schools): hero ("Run your academy like a pro club") with product mockup + "Book a pilot" CTA; problem→solution strip (WhatsApp chaos, bench-decision arguments, 800-on-paper trials); 8-module showcase cards; role columns; rank-ladder gamification highlight; simple per-school pricing; footer.
2. **Login & Register** — centered card, branded left panel on desktop; register has a **role segmented control**; parent shows a "Child code" field; coach is invite-only.
3. **Admin dashboard** — KPI row (Total players, Teams, Avg attendance %, Upcoming fixtures, Trial pipeline), attendance trend chart, upcoming fixtures, recent trial registrations, star-player-per-age-group spotlight.
4. **Admin: Teams**, **Players directory** (searchable/filterable table + card toggle), **Trials** (QR panel + registrations table with accepted/declined/pending chips), **Reports** (filters → export), **Settings** (org, add-sport, invite coaches, billing).
5. **Coach (mobile-first):** dashboard "Today" card + quick Log; squad list (attendance % + avg rating); **log training** (fast tap attendance checklist + note); **log match** (per-player minutes/goals/assists/rating/note); **player detail** with tabs Stats · Notes & Diet · Bench · AI Summary.
6. **Parent:** spacious single-column "My Child" overview — rank badge, next game, latest coach comment, bench status + reason, diet checklist, attendance/minutes summary; schedule; messages/notifications.
7. **Player:** gamified profile — large rank badge + energy-green progress bar, stat cards, rank ladder to next tier, last-3 coach notes, "AI Summary — Last 30 Days" card with Regenerate; leaderboard per division with the player highlighted.
8. **Public trial registration** (no login): single mobile screen — child name, age, position, parent name, phone, email → Register → confirmation. Academy-branded.

**Components to standardize into a shared library:** Button (primary/secondary/ghost/danger), Input/Select/Textarea, Segmented control, Card, KPI/Stat card, Data table with status chips, Badge/Chip, Avatar, Tabs, Modal/slide-over, Toast, Progress bar, Empty state, plus domain components: **RankBadge**, **RankLadder**, **PlayerCard**, **AttendanceRow** (present/absent toggle), **FixtureItem**, **NotificationItem**, **OutcomeChip**.

Deliver a cohesive, production-ready design with a shared style library and both desktop and mobile frames. Keep admin/coach screens information-dense and efficient; keep parent/player screens spacious and engaging.

## ↑ PROMPT — paste to here

---

### Tips
- If Claude Design supports importing tokens, hand it `gymiq-design-system.css` for exact colors, type, and spacing.
- Generate the **landing page + login first** — that's what sells the look — then the dashboards.
- Ask for a **component library / style guide frame** at the end so everything stays consistent.
- To pull a generated design back into the codebase, use the "import design from URL" flow, then map components onto `web/src/components/`.
