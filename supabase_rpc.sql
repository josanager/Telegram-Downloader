-- Misil v4.0 — Supabase RPC functions for atomic quota management
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Atomic credit consumption (check + decrement in one transaction)
CREATE OR REPLACE FUNCTION consume_download_credit(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count int;
    v_plan  text;
    v_limit int;
BEGIN
    -- Lock row to prevent race conditions between multiple tabs
    SELECT download_count, plan
      INTO v_count, v_plan
      FROM profiles
     WHERE id = p_user_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', false, 'error', 'profile_not_found');
    END IF;

    IF v_plan IN ('pro', 'forever') THEN
        -- Paid plans: unlimited downloads
        UPDATE profiles SET download_count = download_count + 1 WHERE id = p_user_id;
        RETURN jsonb_build_object('allowed', true, 'remaining', 9999, 'count', v_count + 1);
    END IF;

    v_limit := 100;

    IF v_count >= v_limit THEN
        RETURN jsonb_build_object('allowed', false, 'error', 'quota_exceeded', 'remaining', 0);
    END IF;

    UPDATE profiles
       SET download_count = download_count + 1
     WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'allowed',   true,
        'remaining', v_limit - v_count - 1,
        'count',     v_count + 1
    );
END;
$$;

-- 2. Refund a credit (if download fails after consuming)
CREATE OR REPLACE FUNCTION refund_download_credit(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE profiles
       SET download_count = GREATEST(download_count - 1, 0)
     WHERE id = p_user_id;
END;
$$;

-- 3. Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION consume_download_credit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION refund_download_credit(uuid) TO authenticated;

-- 4. Initial Database Setup (Run only if not yet existing)
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';
-- UPDATE profiles SET plan = 'free' WHERE plan IS NULL;
