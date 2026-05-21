-- 1. Add umpire_invite_status column to matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS umpire_invite_status TEXT DEFAULT 'pending' CHECK (umpire_invite_status IN ('pending', 'accepted', 'refused'));

-- 2. Update the notification trigger to provide rich context
CREATE OR REPLACE FUNCTION "public"."handle_umpire_invitation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_tournament_name TEXT;
    v_team1_name TEXT;
    v_team2_name TEXT;
BEGIN
    -- Only proceed if umpire_id is newly assigned or changed
    IF (TG_OP = 'INSERT' AND NEW.umpire_id IS NOT NULL) OR 
       (TG_OP = 'UPDATE' AND NEW.umpire_id IS NOT NULL AND (OLD.umpire_id IS NULL OR OLD.umpire_id <> NEW.umpire_id)) THEN
        
        -- Get tournament name if it exists
        IF NEW.tournament_id IS NOT NULL THEN
            SELECT name INTO v_tournament_name FROM public.tournaments WHERE id = NEW.tournament_id;
        END IF;

        -- Get team names
        v_team1_name := COALESCE(NEW.participants->0->>'name', 'TBD');
        v_team2_name := COALESCE(NEW.participants->1->>'name', 'TBD');

        INSERT INTO public.notifications (user_id, title, body, data)
        VALUES (
            NEW.umpire_id,
            'Match Umpire Invitation',
            v_team1_name || ' vs ' || v_team2_name || 
            CASE WHEN v_tournament_name IS NOT NULL THEN ' (' || v_tournament_name || ')' ELSE '' END,
            jsonb_build_object(
                'match_id', NEW.id,
                'tournament_id', NEW.tournament_id,
                'type', 'umpire_invitation',
                'link', '/match/' || NEW.id,
                'match_details', jsonb_build_object(
                    'teams', v_team1_name || ' vs ' || v_team2_name,
                    'tournament', v_tournament_name,
                    'scheduled_at', NEW.scheduled_at
                )
            )
        );

        -- Initialize/Reset status to pending when a new invitation is sent
        NEW.umpire_invite_status := 'pending';
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Define RPC functions for accepting/refusing invitations
CREATE OR REPLACE FUNCTION accept_umpire_invitation(p_match_id UUID, p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify the user is the assigned umpire
    IF NOT EXISTS (
        SELECT 1 FROM public.matches 
        WHERE id = p_match_id AND umpire_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Update match status
    UPDATE public.matches 
    SET umpire_invite_status = 'accepted'
    WHERE id = p_match_id;

    -- Mark notification as read
    UPDATE public.notifications
    SET read_at = NOW()
    WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION refuse_umpire_invitation(p_match_id UUID, p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify the user is the assigned umpire
    IF NOT EXISTS (
        SELECT 1 FROM public.matches 
        WHERE id = p_match_id AND umpire_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Update match: remove umpire and set status
    UPDATE public.matches 
    SET umpire_id = NULL,
        umpire_invite_status = 'refused'
    WHERE id = p_match_id;

    -- Mark notification as read
    UPDATE public.notifications
    SET read_at = NOW()
    WHERE id = p_notification_id AND user_id = auth.uid();
END;
$$;
