# Real-time Notifications Implementation Plan

This plan details the frontend implementation required to leverage the newly enabled Supabase Realtime support for the `notifications` table.

## 1. Core Objectives
- Ensure every user receives instant notifications (toasts + UI updates) when invited to a match or when match updates occur.
- maintain synchronization between the **Notification Bell** (navigation) and the **Notifications Page**.
- Prevent redundant subscriptions or "callback after subscribe" errors.

## 2. Component Updates

### `components/NotificationBell.tsx` (Current Status: Partial)
- **Refinement:** Update the subscription to handle all event types (`INSERT`, `UPDATE`, `DELETE`) to ensure the unread badge and the dropdown list are always accurate.
- **Feedback:** Enhance the `INSERT` handler to show a high-priority toast using `sonner`.

### `app/notifications/page.tsx` (Current Status: Partial)
- **Refinement:** Ensure the list updates live without requiring a page refresh.
- **Consistency:** Use the same snake_case mapping for match details to prevent UI breakage.

## 3. Implementation Strategy (The "Hook" Approach)
To avoid duplicating the realtime logic in multiple places, we will create a dedicated `useNotifications` hook.

### `lib/hooks/useNotifications.ts`
- Centralizes fetching and realtime subscription.
- Manages the `unreadCount` and `notifications` list state.
- Automatically handles channel cleanup on unmount.

## 4. Execution Steps
1. [ ] Create `lib/hooks/useNotifications.ts` and migrate logic from `NotificationBell`.
2. [ ] Refactor `NotificationBell.tsx` to use the new hook.
3. [ ] Refactor `app/notifications/page.tsx` to use the new hook.
4. [ ] (Optional) Add a subtle notification sound effect on `INSERT`.
5. [ ] Verify that marking a notification as read in the Bell instantly updates the Notifications Page (and vice versa).

## 5. Backend Dependency
Ensure the following migration is applied to the Supabase environment:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```
*(This has already been prepared by the backend agent)*
