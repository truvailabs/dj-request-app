-- DELETE events over Realtime only include primary-key columns in the old
-- row by default, which Supabase's Realtime authorization can drop rather
-- than deliver. REPLICA IDENTITY FULL includes the whole old row, which
-- fixes DELETE events not reaching subscribers (confirmed: a deleted tier
-- was correctly gone from the DB but never triggered a live refetch until
-- the page was reloaded).
alter table tiers replica identity full;
