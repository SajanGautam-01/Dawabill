-- Enable the pg_cron extension (Supabase supports this out of the box)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a secure PostgreSQL function that does the heavy lifting
CREATE OR REPLACE FUNCTION dawabill_daily_automation()
RETURNS void AS $$
BEGIN
  -- TASK 1: Clean Up Trash
  -- Delete records from the 7-day recovery bin that are older than 7 days.
  DELETE FROM deleted_items 
  WHERE deleted_at < NOW() - INTERVAL '7 days';

  -- TASK 2: Subscription Expiry Checker
  -- Automatically flip active subscriptions to expired if their date has passed today.
  UPDATE subscriptions 
  SET status = 'expired' 
  WHERE status = 'active' AND expiry_date < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the actual daily cron job to run at 12:00 AM (Midnight) UTC every single day
SELECT cron.schedule(
  'dawabill_daily_maintenance', -- Unique job name
  '0 0 * * *',                  -- Standard CRON expression for exactly midnight
  'SELECT dawabill_daily_automation();' -- The query executed
);

-- ==============================================
-- HELPER COMMANDS (Do not run unless requested)
-- ==============================================

-- If you want to check if the job was successfully scheduled:
-- SELECT * FROM cron.job;

-- If you ever need to stop this cron job:
-- SELECT cron.unschedule('dawabill_daily_maintenance');
