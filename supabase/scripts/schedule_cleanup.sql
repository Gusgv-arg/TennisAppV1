-- Enable extensions if not already enabled (Administrator only)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Name of the job
-- (cron.schedule updates the job if it already exists with the same name)

-- Schedule the job to run every day at midnight (00:00 UTC)
-- REPLACE 'YOUR_SERVICE_ROLE_KEY' with your actual Supabase Service Role Key (from Project Settings > API)
SELECT cron.schedule(
    'delete-expired-accounts-job',
    '0 0 * * *',
    $$
    SELECT
        net.http_post(
            url:='https://mlxsbbhkntbkqaihvepd.supabase.co/functions/v1/delete-expired-accounts',
            headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
            body:='{}'::jsonb
        ) as request_id;
    $$
);

-- Check if the job was scheduled
SELECT * FROM cron.job;
