# Database Scaling & Optimization Plan

As the ScoreBoard platform grows, particularly with point-by-point scoring, the `match_events` table will expand rapidly. This plan outlines the strategy for ensuring high performance and long-term scalability.

## 1. Table Partitioning: `match_events`

The `match_events` table is the primary candidate for growth, with a single tennis match generating hundreds of rows. To maintain query performance, we will implement **Range Partitioning** by time.

### Conceptual Implementation
We will structure the table to be partitioned by `created_at`.

```sql
-- Implementation strategy for future migrations
CREATE TABLE public.match_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL,
    event_data jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at) -- Partition key must be part of PK
) PARTITION BY RANGE (created_at);

-- Example: Creating monthly partitions
CREATE TABLE match_events_2024_05 PARTITION OF match_events
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
```

## 2. Advanced Indexing Strategies

To keep the Supabase database fast, we will implement optimized indexing for common query patterns.

### Composite & Partial Indexes
Optimizing for spectator views that frequently query live matches by tournament.

```sql
CREATE INDEX idx_matches_tournament_status 
ON public.matches (tournament_id, status) 
WHERE status = 'ongoing'; -- Matches 'ongoing' status in schema
```

### JSONB Optimization (GIN Indexes)
Since we rely heavily on `jsonb` for scores and participants, we need **Generalized Inverted Indexes** to allow Postgres to efficiently query inside these objects.

```sql
CREATE INDEX idx_matches_scores ON public.matches USING gin (scores);
CREATE INDEX idx_matches_participants ON public.matches USING gin (participants);
```

## 3. Application-Layer Archiving

To keep production tables lean, we will implement an archiving strategy for historical data.

### The Strategy
- **Active Data:** Matches from the current and previous month remain in the primary `matches` and `match_events` tables.
- **Historical Data:** Matches older than 1 year or from concluded tournaments will be moved to a `historical_matches` table or cold storage.
- **Benefits:**
    - Reduces index sizes.
    - Speeds up backup and recovery.
    - Improves performance for the 99% of users who only care about active competitions.

## 4. Implementation Checklist
- [ ] Monitor `match_events` row count growth.
- [ ] Apply GIN indexes to `matches.scores` and `matches.participants`.
- [ ] Implement partial index for live match queries.
- [ ] Design the `archive_old_matches` background worker/function.
