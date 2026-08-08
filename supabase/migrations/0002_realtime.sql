-- Enable Realtime (Postgres Changes) on requests. Without this, RLS is
-- correct but the DJ dashboard / public list never receive live updates —
-- clients only see fresh data on next full page load.
alter publication supabase_realtime add table requests;
