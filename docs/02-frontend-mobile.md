 Mobile Architecture Directives

## 1. Offline-First Scoring
* Generate UUIDs for `match_events` on the client side using `react-native-uuid` before inserting [27, 28].
* Implement Optimistic UI: Update React state immediately upon button press [27, 29].
* Queue failed inserts in local `AsyncStorage` [27, 30].
* Use `@react-native-community/netinfo` to detect reconnection and batch-insert queued events [27, 31].

## 2. Real-time WebSockets
* Use `@supabase/supabase-js` [27]. 
* Subscribe to `postgres_changes` on the `matches` table where `id=eq.${matchId}` to listen for `current_score` updates and re-render the scoreboard components instantly [27, 32].

## 3. Push Notifications & Social Feed
* Use `expo-notifications` to register device tokens and upsert to the backend [33].
* **Social Feed:** Use React Native's `FlatList`. Fetch from the `user_feed` view and implement cursor pagination using the timestamp field (not offsets) to prevent duplicate renders on infinite scroll [27, 34, 35].

## 4. Packaging
* Use Expo Application Services (EAS) for compiling `.aab` (Android) and `.ipa` (iOS) binaries, and pushing Over-The-Air (OTA) JavaScript updates [36-38].

