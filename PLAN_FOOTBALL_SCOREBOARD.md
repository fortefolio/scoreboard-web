# Football Scoreboard Implementation Plan

This document outlines the strategy for implementing a football (soccer) specific scoreboard in the ScoreBoard web application.

## 1. Data Schema & State Management
Football scores and state will be persisted in the `matches.scores` JSONB column.

### Proposed JSON Structure
```json
{
  "current": { "home": 0, "away": 0 },
  "football": {
    "period": "1st Half",
    "elapsed_seconds": 0,
    "is_clock_running": false,
    "last_clock_update": "2024-05-20T12:00:00Z"
  }
}
```

### Event Types (`match_events` table)
- `goal`: Increments the score for the specified side.
- `period_change`: Updates the current match period (e.g., 1st Half -> Half Time).
- `clock_toggle`: Starts or pauses the match timer.
- `clock_sync`: Periodically updates the `elapsed_seconds` to keep viewers in sync.

## 2. Component Architecture
A new component will be created: `app/match/[matchId]/scoreboard/FootballScoreboard.tsx`.

### UI Features
- **Primary Goals:** Ultra-large numeric display for goals.
- **Match Clock:** Prominent central timer (MM:SS) with high-end digital aesthetics.
- **Action Controls (Umpire Only):**
  - "Add Goal" buttons for both Home and Away.
  - "Start/Pause Clock" toggle.
  - "Next Period" button to transition through match stages.
- **Stadium Aesthetic:** Use existing design tokens (glass-morphism, radial glows, `score-shadow-indigo`).

## 3. Integration Path

### Main Scoreboard Page (`app/match/[matchId]/scoreboard/page.tsx`)
- Import `FootballScoreboard`.
- Add conditional rendering block for `match.sport_type === 'Football'`.

### Shared Match Card (`components/MatchCard.tsx`)
- Update to display the football period and clock when the match is live.
- Ensure goal counts are correctly mapped from `match.scores.current`.

## 4. Implementation Checklist
1. [ ] Create `FootballScoreboard.tsx` skeleton with real-time state syncing.
2. [ ] Implement `handleGoal` logic using `match_events`.
3. [ ] Implement client-side timer with Supabase synchronization.
4. [ ] Design the umpire control layout for mobile-first use.
5. [ ] Integrate into the main scoreboard router.
6. [ ] Verify "My Matches" and "Live Arena" display football-specific data.
