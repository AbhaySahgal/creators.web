## creators.web – Frontend

### Overview

creators.web is a full-featured **creator monetization** frontend built with **React + TypeScript + Vite**.

It simulates a complete product surface for:

- **Fans**: browse creators, subscribe, tip, chat, call, watch live.
- **Creators**: publish content, manage earnings and subscribers, run live streams, handle KYC.
- **Admins**: approve creators (KYC), manage users, moderate content, view platform analytics.

Back-end integration (auth, payments, calls, chat, etc.) is intentionally stubbed with in-memory contexts and mock data. This repo is the **UI + client state** foundation for wiring to real services.

---

### Tech Stack

- **Framework**: React 18 (function components, hooks)
- **Language**: TypeScript
- **Bundler/Dev Server**: Vite
- **Routing**: React Router v7
- **Styling**: Tailwind-style utility classes directly in JSX (no Tailwind config in this repo)
- **Icons**: `react-icons/fi` via `src/components/icons.tsx` alias map
- **State Management**: React Context (per-domain providers)
- **Linting**: ESLint 9 with **custom sayHey coding standards**:
  - Extends TypeScript + stylistic configs from `eslint-ps-standard.mjs`
  - Tabs for indentation
  - 120-char max line length
  - No `async` promise executors, strict `no-misused-promises`, etc.

---

### Planned External Integrations

Back-end and real-time features are **not yet wired**; they’ll be handled like this:

- **Voice/Video Calls**
  - Use **Agora** (Web SDK) for audio/video calls and live streams.
  - Current implementation: calls & live-streams are simulated in `CallContext` and `LiveStreamContext`.
  - Target: replace simulation internals with Agora client instances while keeping the same UI contracts.

- **Real-time Chat & Events**
  - Use **WebSockets** (or Socket.IO) for:
    - 1:1 chat messages
    - Paid/unlocked message events
    - Session countdown & expiry events
    - Live stream chat & gift events
    - Notifications (toasts + notification panel)
  - Current implementation: all “real-time” flows are local state + timeouts.

- **Payments & Wallet**
  - Use **Razorpay** for:
    - Wallet top-ups
    - Subscriptions
    - Tips
    - PPV content unlocks
    - Session bookings
  - Current implementation: `WalletContext` just updates balance/transactions; no actual payment gateway calls.

When implementing back-end / SDKs, **do not change the UI contracts or context APIs unless necessary**; extend existing contexts instead.

---

### Project Structure (High Level)

- `src/main.tsx` – React entrypoint
- `src/App.tsx` – Routing + top-level providers
- `src/components/`
  - `layout/` – `Navbar`, `BottomNav`, `Layout`, `NotificationPanel`
  - `ui/` – `Button`, `Avatar`, `Toast`, `PostCard`, `CreatorCard`
  - `modals/` – `TipModal`, `PPVUnlockModal`, `SubscribeModal`, `SessionPickerModal`
  - `call/` – `IncomingCallOverlay`
  - `icons.tsx` – all icon aliases (from `react-icons/fi`)
- `src/context/`
  - `AuthContext` – user auth, role, KYC status
  - `ContentContext` – posts, likes, comments, subscriptions
  - `ChatContext` – conversations, messages, unread counts
  - `WalletContext` – wallet balance, transactions, subscriptions
  - `NotificationContext` – toasts + notification list
  - `CallContext` – voice/video call state (to be backed by Agora)
  - `SessionContext` – timed chat/call sessions
  - `LiveStreamContext` – live stream state (to be backed by Agora)
- `src/pages/`
  - `Landing`, `Settings`
  - `auth/` – `Login`, `Register`, `AgeVerification`, `OTPVerification`
  - `fan/` – `Feed`, `Explore`, `CreatorProfile`
  - `creator/` – `CreatorDashboard`, `ContentManager`, `Earnings`, `Subscribers`, `ProfileEditor`, `KYCFlow`
  - `chat/` – `MessagesList`, `ChatRoom`
  - `session/` – `TimedChatRoom`
  - `call/` – `ActiveCallScreen`, `CallHistory`
  - `live/` – `GoLivePage`, `LiveStreamRoom`
  - `wallet/` – `Wallet`
  - `admin/` – `AdminDashboard`, `CreatorApproval`, `UserManagement`, `ContentModeration`, `Analytics` (`reports`)

---

### Features by Role

#### Anonymous

- See marketing **Landing** page with hero, stats, featured creators, feature grid, and footer.
- Register (`/register`) as **fan** or **creator** with a 2-step flow.
- Login (`/login`) including **demo accounts** quick login.
- Age verification (`/verify-age`) before accessing protected content.
- Email OTP verification (`/otp`), 6-digit code with clipboard paste support.

#### Fan

- **Feed** (`/feed`)
  - Posts from all creators or subscribed-only filter.
  - “Following” strip of subscribed creators with online status.
  - `PostCard` with:
    - Text + image
    - Likes, comments, lock or PPV overlays
    - Comment mini-thread and add-comment input.

- **Explore** (`/explore`)
  - Search creators by name, handle, and bio.
  - Category chips and sort modes.
  - “Live now” section for open streams.
  - “Trending” creators block.
  - Creator grid using `CreatorCard`.

- **Creator Profile** (`/creator/:id`)
  - Banner, avatar, KYC badge, stats (posts, subs, likes).
  - If **not subscribed**:
    - Subscribe CTA + price, locked-content banner.
  - If **subscribed**:
    - Audio/video call buttons → `ActiveCallScreen` (to be backed by Agora).
    - Message button → opens/creates conversation.
    - Tip button → `TipModal`.
    - Book Session → `SessionPickerModal` (chat / audio / video).
  - Post filters: All / Free / Locked.

- **Messages**
  - List (`/messages`): search conversations, “start new chat” with eligible creators.
  - Chat room (`/messages/:id`):
    - Bubble chat UI with auto-replies.
    - Paid message unlock with wallet deduction.
    - Call buttons and tip CTA.

- **Timed Sessions**
  - `SessionPickerModal`: choose type (chat/audio/video), duration, see price and affordability based on wallet.
  - `TimedChatRoom`: session-limited chat with countdown, warnings, and auto-end.

- **Calls**
  - `ActiveCallScreen` (`/call`): unified audio/video call UI (to become Agora client surface).
  - `CallHistory` (`/call-history`): grouped by Today/Yesterday/Earlier with callback actions.

- **Wallet** (`/wallet`)
  - Balance, total deposited/spent, transactions list.
  - Add funds flow (presets + custom) – currently simulated.
  - Subscriptions tab with auto-renew toggle and cancel action.

- **Live Streams**
  - Join live stream rooms (`/live/:streamId`):
    - Viewer count, elapsed time, chat, gifts, like button.
    - Gifts trigger wallet deductions and floating animations.

- **Settings** (`/settings`)
  - Profile and security UI (hooks into `AuthContext`).

#### Creator

All fan features that apply, plus:

- **Creator Dashboard** (`/creator-dashboard`)
  - KYC gate: if not approved, guided messages with CTA to KYC flow.
  - Cards for monthly earnings, subscribers, session earnings, total earnings.
  - Per-minute rate display + (UI-only) edit mode.
  - Earnings charts and recent sessions.
  - Recent posts and quick actions (Go Live, Earnings, Subscribers, Edit Profile).

- **Content Manager** (`/creator-dashboard/content`)
  - Create posts: text or image, lock for subscribers, PPV price.
  - View, pin, lock/unlock, delete posts.
  - Stats per post (likes, comments, pinned/locked/PPV chips).

- **Earnings** (`/creator-dashboard/earnings`)
  - Breakdowns: total, this month, tips, subscribers.
  - 6-month earnings bar chart.
  - Revenue sources breakdown.
  - Withdraw earnings modal (simulated bank info and transfer).

- **Subscribers** (`/creator-dashboard/subscribers`)
  - High-level metrics: total subs, active subs, MRR.
  - Search subscribers and message them directly.

- **Profile Editor** (`/creator-dashboard/profile`)
  - Edit display name, bio, category, subscription price.
  - Shows take-home (80%) based on platform fee.

- **KYC Flow** (`/creator-dashboard/kyc`)
  - Stepwise ID upload simulation.
  - Status-aware views for pending, approved, rejected.

- **Go Live / Live Stream**
  - Start live stream (`/go-live`): title, live UI, chat, gifts, simulated viewers.
  - Fan side handled in `LiveStreamRoom`.

#### Admin

- **Admin Dashboard** (`/admin`)
  - Metrics: users, active creators, platform revenue, pending KYC, open reports, total content.
  - Navigation cards to detail pages.
  - Top creators + recent reports + revenue trend.

- **Creator Approval** (`/admin/creators`)
  - Pending/all tabs.
  - Approve or reject KYC applications with reasons.
  - Preview of uploaded ID/selfie images.

- **Content Moderation** (`/admin/moderation`)
  - Pending/resolved/all filters.
  - Reported content cards with status, reason, and actions.
  - Report detail modal including reported post preview.

- **User Management** (`/admin/users`)
  - Filter by role, search by name/email.
  - Suspension and ban flows with status chips and toasts.

- **Reports / Analytics** (`/admin/reports`)
  - Platform summary metrics and revenue charts.
  - Top-earning creators list.

---

### ESLint & Coding Standards

We use a shared ESLint config based on **custom sayHey coding standards** (`eslint-ps-standard.mjs`):

- **Tabs** for indentation (no spaces).
- **Max line length 120**.
- **Promise discipline**:
  - `@typescript-eslint/no-misused-promises` – avoid raw `async` handlers in JSX; wrap logic inside non-async callbacks that call `void someAsyncFn()`.
  - `no-restricted-syntax` / `no-promise-executor-return` – do not use `async` promise executors.
- **TypeScript** rules are strict; avoid `any` where possible.

When adding new code:

- Follow existing patterns (contexts, components, hooks).
- Keep JSX readable and under 120 characters per line.
- Prefer extending existing contexts to integrate Agora, WebSockets, and Razorpay.

---

### Setup & Scripts

```bash
npm install

npm run dev        # start Vite dev server (http://localhost:5173)
npm run lint       # run ESLint with project standard
npm run typecheck  # run TypeScript type checking
npm run build      # production build
npm run preview    # preview production build
```

