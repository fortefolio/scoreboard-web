


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."entity_type" AS ENUM (
    'team',
    'player',
    'competition'
);


ALTER TYPE "public"."entity_type" OWNER TO "postgres";


CREATE TYPE "public"."match_status" AS ENUM (
    'scheduled',
    'ongoing',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."match_status" OWNER TO "postgres";


CREATE TYPE "public"."subscription_tier" AS ENUM (
    'free',
    'pro'
);


ALTER TYPE "public"."subscription_tier" OWNER TO "postgres";


CREATE TYPE "public"."tournament_status" AS ENUM (
    'pending',
    'ongoing',
    'completed',
    'cancelled',
    'scheduled'
);


ALTER TYPE "public"."tournament_status" OWNER TO "postgres";


CREATE TYPE "public"."tournament_visibility" AS ENUM (
    'public',
    'private',
    'unlisted'
);


ALTER TYPE "public"."tournament_visibility" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_tournament_participant_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_max_teams INT;
    v_current_teams INT;
BEGIN
    -- Get the max_teams setting for the tournament
    SELECT (settings->'stage_1'->>'max_teams')::int 
    INTO v_max_teams
    FROM public.tournaments
    WHERE id = NEW.tournament_id;

    -- If max_teams is NULL, there's no limit
    IF v_max_teams IS NULL THEN
        RETURN NEW;
    END IF;

    -- Count existing participants for this tournament
    SELECT COUNT(*) 
    INTO v_current_teams
    FROM public.tournament_participants
    WHERE tournament_id = NEW.tournament_id;

    -- If limit reached, raise an error
    IF v_current_teams >= v_max_teams THEN
        RAISE EXCEPTION 'This tournament has reached the maximum number of participants (%)', v_max_teams;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_tournament_participant_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_match_completion_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Only notify when status changes to 'completed'
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
        
        -- Insert notifications for all followers of participants or the competition
        INSERT INTO public.notifications (user_id, title, body, data)
        SELECT 
            f.user_id,
            'Match Completed!',
            NEW.sport_type || ' match finished.', -- Simplified to avoid dependency on exact score structure
            jsonb_build_object(
                'match_id', NEW.id,
                'tournament_id', NEW.tournament_id,
                'type', 'match_completed',
                'link', '/matches/' || NEW.id,
                'final_sets', NEW.scores->'final_sets' -- Include the final set scores if they exist
            )
        FROM public.follows f
        WHERE 
            -- Following a participant (team/player) in the match
            (f.entity_type IN ('team', 'player') AND NEW.participants @> jsonb_build_array(jsonb_build_object('id', f.entity_id)))
            OR
            -- Following the competition (tournament)
            (f.entity_type = 'competition' AND NEW.tournament_id = f.entity_id);
            
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_match_completion_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_match_umpire_default"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Only set default umpire for standalone matches (not part of a tournament)
  IF NEW.tournament_id IS NULL AND NEW.umpire_id IS NULL THEN
    NEW.umpire_id := NEW.organizer_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_match_umpire_default"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/send-signup-email',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_signup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.users (id, subscription_tier, email, username)
  VALUES (
    new.id, 
    'free', 
    new.email, 
    COALESCE(
      new.raw_user_meta_data->>'full_name', 
      new.raw_user_meta_data->>'name', 
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'user_name',
      split_part(new.email, '@', 1)
    )
  ); -- Default new users to the free tier and sync email/username
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_umpire_invitation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Only notify if umpire_id is newly assigned or changed
    IF (TG_OP = 'INSERT' AND NEW.umpire_id IS NOT NULL) OR 
       (TG_OP = 'UPDATE' AND NEW.umpire_id IS NOT NULL AND (OLD.umpire_id IS NULL OR OLD.umpire_id <> NEW.umpire_id)) THEN
        
        INSERT INTO public.notifications (user_id, title, body, data)
        VALUES (
            NEW.umpire_id,
            'You have been invited to score a match!',
            'You are the umpire for the ' || NEW.sport_type || ' match.',
            jsonb_build_object(
                'match_id', NEW.id,
                'tournament_id', NEW.tournament_id,
                'type', 'umpire_invitation',
                'link', '/matches/' || NEW.id
            )
        );
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_umpire_invitation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_match_scoreboard"("m_id" "uuid", "initial_server_index" integer DEFAULT NULL::integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_scores JSONB;
BEGIN
  SELECT scores INTO v_scores FROM public.matches WHERE id = m_id;
  
  IF initial_server_index IS NOT NULL THEN
    v_scores := jsonb_set(v_scores, '{serving_index}', initial_server_index::TEXT::jsonb);
  END IF;

  UPDATE public.matches
  SET 
    status = 'ongoing',
    scores = v_scores,
    updated_at = NOW()
  WHERE id = m_id;
END;
$$;


ALTER FUNCTION "public"."start_match_scoreboard"("m_id" "uuid", "initial_server_index" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_match_score"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_match record;
    v_tournament record;
    v_rules JSONB;
    v_scores JSONB;
    v_side TEXT;
    v_winner_idx INT;
    v_points_p1 INT;
    v_points_p2 INT;
    v_serving_idx INT;
    -- Volleyball specific
    v_target_points INT;
    v_point_cap INT;
    v_p1_current INT;
    v_p2_current INT;
    v_set_won BOOLEAN := FALSE;
BEGIN
    -- 1. Get current state and tournament rules
    SELECT m.*, t.settings as tournament_settings 
    INTO v_match
    FROM public.matches m
    LEFT JOIN public.tournaments t ON m.tournament_id = t.id
    WHERE m.id = NEW.match_id;

    v_scores := v_match.scores;

    -- Initialize scores if empty or missing 'current'
    IF v_scores IS NULL OR v_scores = '{}'::jsonb THEN
        v_scores := '{"current": {"home": 0, "away": 0}, "serving_index": 0, "sets": [], "current_set": 1}'::jsonb;
    ELSIF NOT (v_scores ? 'current') THEN
        v_scores := jsonb_set(v_scores, '{current}', '{"home": 0, "away": 0}'::jsonb);
    END IF;
    
    -- Ensure sets array and current_set index exist
    IF NOT (v_scores ? 'sets') THEN v_scores := jsonb_set(v_scores, '{sets}', '[]'::jsonb); END IF;
    IF NOT (v_scores ? 'current_set') THEN v_scores := jsonb_set(v_scores, '{current_set}', '1'::jsonb); END IF;

    -- 2. Handle Meta-Events
    IF NEW.event_data->>'type' = 'start_scoreboard' THEN
        UPDATE public.matches SET status = 'ongoing' WHERE id = NEW.match_id;
    END IF;

    IF NEW.event_data->>'type' = 'toss_coin' THEN
        v_scores := jsonb_set(v_scores, '{serving_index}', (NEW.event_data->>'winner_index')::jsonb);
    END IF;

    -- 3. Handle Point/Score updates
    IF NEW.event_data->>'type' IN ('point_won', 'score', 'goal', 'point_scored') THEN
        v_side := NEW.event_data->>'side'; -- 'home' or 'away'
        IF v_side IS NULL THEN RETURN NEW; END IF;
        
        v_winner_idx := CASE WHEN v_side = 'home' THEN 0 ELSE 1 END;

        CASE lower(COALESCE(v_match.sport_type, 'generic'))
            WHEN 'tennis' THEN
                -- Initialize tennis structure if missing
                IF NOT (v_scores ? 'tennis') OR v_scores->'tennis' IS NULL THEN
                    v_scores := jsonb_set(v_scores, '{tennis}', '{"points": [0,0], "games": [0,0], "sets": [], "current_set": 0}'::jsonb);
                END IF;

                v_points_p1 := (v_scores->'tennis'->'points'->0)::INT;
                v_points_p2 := (v_scores->'tennis'->'points'->1)::INT;

                IF v_side = 'home' THEN v_points_p1 := v_points_p1 + 1; ELSE v_points_p2 := v_points_p2 + 1; END IF;

                IF (v_points_p1 >= 4 AND v_points_p1 - v_points_p2 >= 2) OR (v_points_p2 >= 4 AND v_points_p2 - v_points_p1 >= 2) THEN
                    v_scores := jsonb_set(v_scores, ARRAY['tennis','games', v_winner_idx::TEXT], 
                        (((v_scores->'tennis'->'games'->v_winner_idx)::INT + 1)::TEXT)::jsonb
                    );
                    v_scores := jsonb_set(v_scores, '{tennis,points}', '[0,0]'::jsonb);
                    v_serving_idx := COALESCE((v_scores->>'serving_index')::INT, 0);
                    v_scores := jsonb_set(v_scores, '{serving_index}', ((1 - v_serving_idx)::TEXT)::jsonb);
                ELSE
                    v_scores := jsonb_set(v_scores, '{tennis,points}', jsonb_build_array(v_points_p1, v_points_p2));
                END IF;

            WHEN 'volleyball', 'beach_volleyball' THEN
                -- Determine Rules
                v_rules := CASE 
                    WHEN v_match.settings IS NOT NULL AND v_match.settings <> '{}'::jsonb THEN v_match.settings
                    WHEN v_match.tournament_settings->'overrides' ? v_match.round_number::TEXT THEN v_match.tournament_settings->'overrides'->v_match.round_number::TEXT
                    ELSE v_match.tournament_settings->'default'
                END;

                v_target_points := COALESCE((v_rules->>'points_per_set')::INT, 25);
                v_point_cap := (v_rules->>'point_cap')::INT;

                -- Increment points
                v_p1_current := (v_scores->'current'->>'home')::INT;
                v_p2_current := (v_scores->'current'->>'away')::INT;

                IF v_side = 'home' THEN v_p1_current := v_p1_current + 1; ELSE v_p2_current := v_p2_current + 1; END IF;

                -- Check if set is won
                IF (v_point_cap IS NOT NULL AND (v_p1_current = v_point_cap OR v_p2_current = v_point_cap)) THEN
                    v_set_won := TRUE;
                ELSIF (v_p1_current >= v_target_points OR v_p2_current >= v_target_points) AND ABS(v_p1_current - v_p2_current) >= 2 THEN
                    v_set_won := TRUE;
                END IF;

                IF v_set_won THEN
                    -- Append to sets array
                    v_scores := jsonb_set(v_scores, '{sets}', 
                        COALESCE(v_scores->'sets', '[]'::jsonb) || jsonb_build_object('team1', v_p1_current, 'team2', v_p2_current)
                    );
                    -- Reset current score
                    v_scores := jsonb_set(v_scores, '{current}', '{"home": 0, "away": 0}'::jsonb);
                    -- Increment current_set index
                    v_scores := jsonb_set(v_scores, '{current_set}', ((COALESCE((v_scores->>'current_set')::INT, 1) + 1)::TEXT)::jsonb);
                ELSE
                    -- Just update current points
                    v_scores := jsonb_set(v_scores, ARRAY['current', v_side], (CASE WHEN v_side = 'home' THEN v_p1_current ELSE v_p2_current END::TEXT)::jsonb);
                END IF;

            WHEN 'football', 'soccer' THEN
                v_scores := jsonb_set(v_scores, ARRAY['current', v_side], 
                    ((COALESCE((v_scores->'current'->>v_side)::INT, 0) + 1)::TEXT)::jsonb);

            WHEN 'basketball' THEN
                v_scores := jsonb_set(v_scores, ARRAY['current', v_side], 
                    ((COALESCE((v_scores->'current'->>v_side)::INT, 0) + COALESCE((NEW.event_data->>'points')::INT, 1))::TEXT)::jsonb);

            ELSE
                v_scores := jsonb_set(v_scores, ARRAY['current', v_side], 
                    ((COALESCE((v_scores->'current'->>v_side)::INT, 0) + 1)::TEXT)::jsonb);
        END CASE;
    END IF;

    -- 4. Update the match
    UPDATE public.matches
    SET scores = v_scores,
        updated_at = NOW()
    WHERE id = NEW.match_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_match_score"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tennis_score"("m_id" "uuid", "winner_idx" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    curr_p INT[];
    curr_g INT[];
    opp_idx INT;
BEGIN
    -- 1. Get current state
    SELECT tennis_points, tennis_games INTO curr_p, curr_g 
    FROM matches WHERE id = m_id;
    
    opp_idx := CASE WHEN winner_idx = 0 THEN 1 ELSE 0 END;

    -- 2. Check for Game Win
    -- Standard: 4th point (index 3) and opponent has < 3 points
    -- Deuce: Winner has 3+ points and leads by 2
    IF (curr_p[winner_idx + 1] >= 3 AND curr_p[winner_idx + 1] > curr_p[opp_idx + 1]) THEN
        -- Win the Game
        UPDATE matches 
        SET tennis_points = '{0,0}', 
            tennis_games[winner_idx + 1] = tennis_games[winner_idx + 1] + 1
        WHERE id = m_id;
    ELSE
        -- Just increment the Point
        UPDATE matches 
        SET tennis_points[winner_idx + 1] = tennis_points[winner_idx + 1] + 1
        WHERE id = m_id;
    END IF;
END;
$$;


ALTER FUNCTION "public"."update_tennis_score"("m_id" "uuid", "winner_idx" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_participant_form_responses"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_config JSONB;
    v_field JSONB;
    v_field_id TEXT;
    v_required BOOLEAN;
BEGIN
    -- Get the form configuration from the associated tournament
    SELECT signup_form_config INTO v_config 
    FROM public.tournaments 
    WHERE id = NEW.tournament_id;

    -- If no config or empty array, skip validation
    IF v_config IS NULL OR jsonb_array_length(v_config) = 0 THEN
        RETURN NEW;
    END IF;

    -- Iterate through defined fields in the configuration
    FOR v_field IN SELECT * FROM jsonb_array_elements(v_config)
    LOOP
        v_field_id := v_field->>'id';
        v_required := (v_field->>'required')::BOOLEAN;

        -- Check if the field is required but missing or null in the responses
        IF v_required AND (
            NEW.form_responses IS NULL OR 
            NOT (NEW.form_responses ? v_field_id) OR 
            NEW.form_responses->>v_field_id IS NULL OR 
            trim(NEW.form_responses->>v_field_id) = ''
        ) THEN
            RAISE EXCEPTION 'Missing required field: %', (v_field->>'label');
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_participant_form_responses"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."bracket_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "match_id" "uuid",
    "round_number" integer NOT NULL,
    "next_match_id" "uuid",
    "next_match_slot" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bracket_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "entity_type" "public"."entity_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "sport_type" "text" NOT NULL,
    "participants" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "status" "public"."match_status" DEFAULT 'scheduled'::"public"."match_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "round_number" integer,
    "match_order" integer,
    "tournament_id" "uuid",
    "umpire_id" "uuid",
    "group_label" "text",
    "bracket_type" "text" DEFAULT 'main'::"text",
    "court" "text",
    "scheduled_at" timestamp with time zone,
    "round_date" "date",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "scores" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


COMMENT ON COLUMN "public"."matches"."settings" IS 'Stores match-specific rules: max_sets, points_per_set, and point_cap';



COMMENT ON COLUMN "public"."matches"."scores" IS 'Unified sport-specific scoring: { "current": {}, "tennis": { "points": [], ... }, "serving_index": 0 }';



CREATE OR REPLACE VIEW "public"."group_standings" WITH ("security_invoker"='true') AS
 WITH "team_stats" AS (
         SELECT "matches"."tournament_id",
            "matches"."group_label",
            (("matches"."participants" -> 0) ->> 'name'::"text") AS "team_name",
                CASE
                    WHEN (((("matches"."scores" -> 'final_sets'::"text") -> 0))::integer > ((("matches"."scores" -> 'final_sets'::"text") -> 1))::integer) THEN 1
                    ELSE 0
                END AS "is_win",
            ((("matches"."scores" -> 'final_sets'::"text") -> 0))::integer AS "sets_won",
            ((("matches"."scores" -> 'final_sets'::"text") -> 1))::integer AS "sets_lost",
            COALESCE(( SELECT "sum"((("s"."value" ->> 'team1'::"text"))::integer) AS "sum"
                   FROM "jsonb_array_elements"(("matches"."scores" -> 'final_history'::"text")) "s"("value")), (((("matches"."scores" -> 'current'::"text") ->> 'home'::"text"))::integer)::bigint, (0)::bigint) AS "points_for",
            COALESCE(( SELECT "sum"((("s"."value" ->> 'team2'::"text"))::integer) AS "sum"
                   FROM "jsonb_array_elements"(("matches"."scores" -> 'final_history'::"text")) "s"("value")), (((("matches"."scores" -> 'current'::"text") ->> 'away'::"text"))::integer)::bigint, (0)::bigint) AS "points_against"
           FROM "public"."matches"
          WHERE (("matches"."status" = 'completed'::"public"."match_status") AND ("matches"."group_label" IS NOT NULL))
        UNION ALL
         SELECT "matches"."tournament_id",
            "matches"."group_label",
            (("matches"."participants" -> 1) ->> 'name'::"text") AS "team_name",
                CASE
                    WHEN (((("matches"."scores" -> 'final_sets'::"text") -> 1))::integer > ((("matches"."scores" -> 'final_sets'::"text") -> 0))::integer) THEN 1
                    ELSE 0
                END AS "is_win",
            ((("matches"."scores" -> 'final_sets'::"text") -> 1))::integer AS "sets_won",
            ((("matches"."scores" -> 'final_sets'::"text") -> 0))::integer AS "sets_lost",
            COALESCE(( SELECT "sum"((("s"."value" ->> 'team2'::"text"))::integer) AS "sum"
                   FROM "jsonb_array_elements"(("matches"."scores" -> 'final_history'::"text")) "s"("value")), (((("matches"."scores" -> 'current'::"text") ->> 'away'::"text"))::integer)::bigint, (0)::bigint) AS "points_for",
            COALESCE(( SELECT "sum"((("s"."value" ->> 'team1'::"text"))::integer) AS "sum"
                   FROM "jsonb_array_elements"(("matches"."scores" -> 'final_history'::"text")) "s"("value")), (((("matches"."scores" -> 'current'::"text") ->> 'home'::"text"))::integer)::bigint, (0)::bigint) AS "points_against"
           FROM "public"."matches"
          WHERE (("matches"."status" = 'completed'::"public"."match_status") AND ("matches"."group_label" IS NOT NULL))
        )
 SELECT "tournament_id",
    "group_label",
    "team_name",
    "count"(*) AS "played",
    "sum"("is_win") AS "wins",
    ("count"(*) - "sum"("is_win")) AS "losses",
    "sum"("sets_won") AS "total_sets_won",
    "sum"("sets_lost") AS "total_sets_lost",
    ("sum"("points_for") - "sum"("points_against")) AS "point_diff"
   FROM "team_stats"
  GROUP BY "tournament_id", "group_label", "team_name"
  ORDER BY ("sum"("is_win")) DESC, ("sum"("sets_won") - "sum"("sets_lost")) DESC, ("sum"("points_for") - "sum"("points_against")) DESC;


ALTER VIEW "public"."group_standings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."match_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "match_id" "uuid" NOT NULL,
    "event_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."match_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "seed" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text",
    "contact_email" "text",
    "form_responses" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."tournament_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournaments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sport_type" "text" NOT NULL,
    "status" "public"."tournament_status" DEFAULT 'pending'::"public"."tournament_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "visibility" "public"."tournament_visibility" DEFAULT 'public'::"public"."tournament_visibility" NOT NULL,
    "signup_form_config" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "check_dates_order" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."tournaments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tournaments"."settings" IS 'Stores max_sets, points_per_set, and optional point_cap';



CREATE OR REPLACE VIEW "public"."user_feed" WITH ("security_invoker"='true') AS
 SELECT "f"."user_id",
    "m"."id" AS "activity_id",
    'match'::"text" AS "activity_type",
    "m"."sport_type",
    ("m"."status")::"text" AS "status",
    "m"."scores" AS "activity_data",
    "m"."updated_at" AS "activity_timestamp"
   FROM ("public"."follows" "f"
     JOIN "public"."matches" "m" ON (((("f"."entity_type" = ANY (ARRAY['team'::"public"."entity_type", 'player'::"public"."entity_type"])) AND ("m"."participants" @> "jsonb_build_array"("jsonb_build_object"('id', "f"."entity_id")))) OR (("f"."entity_type" = 'competition'::"public"."entity_type") AND ("m"."tournament_id" = "f"."entity_id")))))
  WHERE ("m"."status" = 'completed'::"public"."match_status")
UNION ALL
 SELECT "f"."user_id",
    "t"."id" AS "activity_id",
    'tournament'::"text" AS "activity_type",
    "t"."sport_type",
    ("t"."status")::"text" AS "status",
    "jsonb_build_object"('name', "t"."name") AS "activity_data",
    "t"."created_at" AS "activity_timestamp"
   FROM ("public"."follows" "f"
     JOIN "public"."tournaments" "t" ON ((("f"."entity_type" = 'competition'::"public"."entity_type") AND ("t"."id" = "f"."entity_id"))))
  WHERE ("t"."status" = 'pending'::"public"."tournament_status");


ALTER VIEW "public"."user_feed" OWNER TO "postgres";


COMMENT ON VIEW "public"."user_feed" IS 'Stitches together completed matches and new tournaments for a user''s social feed based on follows.';



CREATE TABLE IF NOT EXISTS "public"."user_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "fcm_token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "subscription_tier" "public"."subscription_tier" DEFAULT 'free'::"public"."subscription_tier" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "username" "text",
    "email" "text"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bracket_matches"
    ADD CONSTRAINT "bracket_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_user_id_entity_id_entity_type_key" UNIQUE ("user_id", "entity_id", "entity_type");



ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_participants"
    ADD CONSTRAINT "tournament_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_tokens"
    ADD CONSTRAINT "user_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_tokens"
    ADD CONSTRAINT "user_tokens_user_id_fcm_token_key" UNIQUE ("user_id", "fcm_token");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_username_key" UNIQUE ("username");



CREATE INDEX "idx_bracket_matches_match_id" ON "public"."bracket_matches" USING "btree" ("match_id");



CREATE INDEX "idx_bracket_matches_next_match_id" ON "public"."bracket_matches" USING "btree" ("next_match_id");



CREATE INDEX "idx_bracket_matches_tournament_id" ON "public"."bracket_matches" USING "btree" ("tournament_id");



CREATE INDEX "idx_match_events_match_id" ON "public"."match_events" USING "btree" ("match_id");



CREATE INDEX "idx_matches_organizer_id" ON "public"."matches" USING "btree" ("organizer_id");



CREATE INDEX "idx_matches_round_date" ON "public"."matches" USING "btree" ("round_date");



CREATE INDEX "idx_matches_scheduled_at" ON "public"."matches" USING "btree" ("scheduled_at");



CREATE INDEX "idx_matches_tournament_bracket_type" ON "public"."matches" USING "btree" ("tournament_id", "bracket_type");



CREATE INDEX "idx_matches_tournament_group" ON "public"."matches" USING "btree" ("tournament_id", "group_label") WHERE ("group_label" IS NOT NULL);



CREATE INDEX "idx_matches_tournament_round_order" ON "public"."matches" USING "btree" ("tournament_id", "round_number", "match_order");



CREATE INDEX "idx_matches_umpire_id" ON "public"."matches" USING "btree" ("umpire_id");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_tournament_participants_tournament_id" ON "public"."tournament_participants" USING "btree" ("tournament_id");



CREATE INDEX "idx_tournaments_organizer_id" ON "public"."tournaments" USING "btree" ("organizer_id");



CREATE INDEX "idx_tournaments_visibility" ON "public"."tournaments" USING "btree" ("visibility");



CREATE OR REPLACE TRIGGER "on_match_inserted_set_umpire" BEFORE INSERT ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."handle_match_umpire_default"();



CREATE OR REPLACE TRIGGER "tr_check_max_teams" BEFORE INSERT ON "public"."tournament_participants" FOR EACH ROW EXECUTE FUNCTION "public"."check_tournament_participant_limit"();



CREATE OR REPLACE TRIGGER "tr_notify_match_completion" AFTER UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."handle_match_completion_notification"();



CREATE OR REPLACE TRIGGER "tr_notify_umpire_invitation" AFTER INSERT OR UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."handle_umpire_invitation"();



CREATE OR REPLACE TRIGGER "tr_send_signup_email" AFTER INSERT ON "public"."tournament_participants" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_signup"();



CREATE OR REPLACE TRIGGER "tr_update_match_score" AFTER INSERT ON "public"."match_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_match_score"();



CREATE OR REPLACE TRIGGER "tr_validate_participant_signup_form" BEFORE INSERT OR UPDATE ON "public"."tournament_participants" FOR EACH ROW EXECUTE FUNCTION "public"."validate_participant_form_responses"();



ALTER TABLE ONLY "public"."bracket_matches"
    ADD CONSTRAINT "bracket_matches_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bracket_matches"
    ADD CONSTRAINT "bracket_matches_next_match_id_fkey" FOREIGN KEY ("next_match_id") REFERENCES "public"."bracket_matches"("id");



ALTER TABLE ONLY "public"."bracket_matches"
    ADD CONSTRAINT "bracket_matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."match_events"
    ADD CONSTRAINT "match_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_umpire_id_fkey" FOREIGN KEY ("umpire_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_participants"
    ADD CONSTRAINT "tournament_participants_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_tokens"
    ADD CONSTRAINT "user_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow public read of participants" ON "public"."tournament_participants" FOR SELECT USING (true);



CREATE POLICY "Allow public read of users" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Allow public signups" ON "public"."tournament_participants" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tournaments"
  WHERE (("tournaments"."id" = "tournament_participants"."tournament_id") AND ("tournaments"."status" = 'pending'::"public"."tournament_status")))));



CREATE POLICY "Bracket matches visibility policy" ON "public"."bracket_matches" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "bracket_matches"."tournament_id") AND (("t"."visibility" = 'public'::"public"."tournament_visibility") OR ("t"."visibility" = 'unlisted'::"public"."tournament_visibility") OR ("t"."organizer_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Match events visibility policy" ON "public"."match_events" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ("public"."matches" "m"
     JOIN "public"."tournaments" "t" ON (("t"."id" = "m"."tournament_id")))
  WHERE (("m"."id" = "match_events"."match_id") AND (("t"."visibility" = 'public'::"public"."tournament_visibility") OR ("t"."visibility" = 'unlisted'::"public"."tournament_visibility") OR ("t"."organizer_id" = ( SELECT "auth"."uid"() AS "uid")))))) OR (EXISTS ( SELECT 1
   FROM "public"."matches" "m"
  WHERE (("m"."id" = "match_events"."match_id") AND ("m"."tournament_id" IS NULL))))));



CREATE POLICY "Matches visibility policy" ON "public"."matches" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "matches"."tournament_id") AND (("t"."visibility" = 'public'::"public"."tournament_visibility") OR ("t"."visibility" = 'unlisted'::"public"."tournament_visibility") OR ("t"."organizer_id" = ( SELECT "auth"."uid"() AS "uid")))))) OR ("tournament_id" IS NULL)));



CREATE POLICY "Only match organizers can insert events" ON "public"."match_events" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."matches"
  WHERE (("matches"."id" = "match_events"."match_id") AND (("matches"."organizer_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("matches"."umpire_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Organizers and Umpires can update matches" ON "public"."matches" FOR UPDATE USING ((("organizer_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("umpire_id" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((("organizer_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("umpire_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Organizers can delete bracket matches" ON "public"."bracket_matches" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "bracket_matches"."tournament_id") AND ("t"."organizer_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Organizers can delete their own tournaments" ON "public"."tournaments" FOR DELETE USING (("organizer_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Organizers can insert bracket matches" ON "public"."bracket_matches" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "bracket_matches"."tournament_id") AND ("t"."organizer_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Organizers can insert matches" ON "public"."matches" FOR INSERT WITH CHECK (("organizer_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Organizers can update bracket matches" ON "public"."bracket_matches" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."tournaments" "t"
  WHERE (("t"."id" = "bracket_matches"."tournament_id") AND ("t"."organizer_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Organizers can update their tournaments" ON "public"."tournaments" FOR UPDATE USING (("organizer_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Pro users can create their own tournaments" ON "public"."tournaments" FOR INSERT WITH CHECK ((("organizer_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("users"."subscription_tier" = 'pro'::"public"."subscription_tier"))))));



CREATE POLICY "Tournaments visibility policy" ON "public"."tournaments" FOR SELECT USING ((("visibility" = 'public'::"public"."tournament_visibility") OR ("visibility" = 'unlisted'::"public"."tournament_visibility") OR ("organizer_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Users can manage their own follows" ON "public"."follows" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can manage their own notifications" ON "public"."notifications" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can manage their own tokens" ON "public"."user_tokens" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."bracket_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."match_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournaments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_tournament_participant_limit"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_tournament_participant_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_tournament_participant_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_tournament_participant_limit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_match_completion_notification"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_match_completion_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_match_completion_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_match_completion_notification"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_match_umpire_default"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_match_umpire_default"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_match_umpire_default"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_match_umpire_default"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_signup"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_signup"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_signup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_signup"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_umpire_invitation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_umpire_invitation"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_umpire_invitation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_umpire_invitation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_match_scoreboard"("m_id" "uuid", "initial_server_index" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_match_scoreboard"("m_id" "uuid", "initial_server_index" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."start_match_scoreboard"("m_id" "uuid", "initial_server_index" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."start_match_scoreboard"("m_id" "uuid", "initial_server_index" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_match_score"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_match_score"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_match_score"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_match_score"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_tennis_score"("m_id" "uuid", "winner_idx" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_tennis_score"("m_id" "uuid", "winner_idx" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_tennis_score"("m_id" "uuid", "winner_idx" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tennis_score"("m_id" "uuid", "winner_idx" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_participant_form_responses"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_participant_form_responses"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_participant_form_responses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_participant_form_responses"() TO "service_role";



GRANT ALL ON TABLE "public"."bracket_matches" TO "anon";
GRANT ALL ON TABLE "public"."bracket_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."bracket_matches" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."group_standings" TO "anon";
GRANT ALL ON TABLE "public"."group_standings" TO "authenticated";
GRANT ALL ON TABLE "public"."group_standings" TO "service_role";



GRANT ALL ON TABLE "public"."match_events" TO "anon";
GRANT ALL ON TABLE "public"."match_events" TO "authenticated";
GRANT ALL ON TABLE "public"."match_events" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_participants" TO "anon";
GRANT ALL ON TABLE "public"."tournament_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_participants" TO "service_role";



GRANT ALL ON TABLE "public"."tournaments" TO "anon";
GRANT ALL ON TABLE "public"."tournaments" TO "authenticated";
GRANT ALL ON TABLE "public"."tournaments" TO "service_role";



GRANT ALL ON TABLE "public"."user_feed" TO "anon";
GRANT ALL ON TABLE "public"."user_feed" TO "authenticated";
GRANT ALL ON TABLE "public"."user_feed" TO "service_role";



GRANT ALL ON TABLE "public"."user_tokens" TO "anon";
GRANT ALL ON TABLE "public"."user_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."user_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







