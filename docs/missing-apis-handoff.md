# Creator / subscription frontend handoff (`missing_apis_v1`)

This document summarizes the backend handoff for **creator subscription price (minor units)**, **subscription lifecycle (including expiry push)**, **creator notification preferences + kinds**, and **creator dashboard on session** (`GET /me`). It maps spec items to this repo.

For WebSocket wire format and `WsClient` usage, see [websocket.md](./websocket.md).

## HTTP

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /me` | Bearer optional | Session user; `{ user: null }` without token. When present, `user.creatorDashboard` is attached for creators (and admins with a creator profile). |
| `POST /me/profile` | Bearer | Profile upsert; creator fields include `subscriptionPriceMinor`, `perMinuteRate` (integers, minor units). |
| `GET /me/notification-settings` | Bearer | Returns `{ settings: { messages, subscriptions, tips, likes, system } }` (defaults all `true` if unset). |
| `PUT /me/notification-settings` | Bearer | Body `{ settings: { ...partial } }`; merged response. |

**Money scale:** `walletBalance` on the session user is **minor units** (same string field we store as `walletBalanceMinor` after normalization in `AuthContext`).

## WebSocket (high level)

- Authenticate: `user` service + `/authenticate <jwt>` (or `?token=` on URL — see `wsUrl.ts` / `WsContext`).
- **Creator:** `/get <creatorUserId>` returns `subscription_price_minor` (integer string or null) among profile fields.
- **Subscription:** `/subscribe`, `/cancel`, `/listmine`, `/get`, `/listsubscribers`, etc.
- **Push:** `|subscription|created|`, `|subscription|cancelled|`, `|subscription|expired|`, `|notification|new|`, etc.

## Phases (checklist)

### Phase 1 — Subscription price

- Creators set price via `POST /me/profile` with `subscriptionPriceMinor`.
- Fans read price from `creator` `/get` → `subscription_price_minor`.
- Wallet subscribe compares balance using that minor string (see `creatorSubscriptionMinorUnits` in `src/services/creatorWsMap.ts`, `SubscribeModal`).

**Frontend files:** `src/services/creatorsApi.ts`, `src/pages/creator/ProfileEditor.tsx`, `src/services/creatorWsTypes.ts`, `src/services/creatorWsMap.ts`, `src/components/modals/SubscribeModal.tsx`.

### Phase 2 — Subscription expiry

- Listen for `|subscription|expired|` (and plural service alias if used) with `SubscriptionDTO` (`status: "expired"`).

**Frontend files:** `src/context/SubscriptionContext.tsx`.

### Phase 3 — In-app notifications + prefs

- HTTP `GET`/`PUT /me/notification-settings`.
- Push: `|notification|new|`.
- **Gating (documented in UI):** follow/unfollow in-app notifications align with **`likes`**; subscriber / cancel / expiry align with **`subscriptions`**.

**Frontend files:** `src/pages/Settings.tsx`, `src/context/NotificationContext.tsx`, `src/services/notificationWsService.ts`.

### Phase 4 — Creator dashboard

- `GET /me` includes `creatorDashboard` when the user has a creator profile and role is `creator` or `admin`.
- `perMinuteRate` for timed sessions via `POST /me/profile`.
- Types: `CreatorDashboard`, `CreatorDashboardSessionRow`, etc. in `src/types/index.ts`.

**Frontend files:** `src/context/AuthContext.tsx` (`parseCreatorDashboardFromApi`, `creatorFromSessionUser`, `useCurrentCreator`), `src/pages/creator/CreatorDashboard.tsx`.

## DTO notes

- **SubscriptionDTO:** `price_cents` (charged minor units) is read by `subscriptionAmountMinor` in `src/services/subscriptionUi.ts` (alongside legacy `amount_*` keys).

## Related source files

| Area | Files |
|------|--------|
| API client | `src/services/creatorsApi.ts` |
| Session / dashboard | `src/context/AuthContext.tsx` |
| Subscriptions WS | `src/services/subscriptionWs.ts`, `src/context/SubscriptionContext.tsx` |
| Creator WS mapping | `src/services/creatorWsMap.ts`, `src/services/creatorWsTypes.ts` |
| Socket infra | `src/services/wsClient.ts`, `src/services/wsProtocol.ts`, `src/context/WsContext.tsx` |
