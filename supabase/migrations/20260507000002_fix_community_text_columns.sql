-- Change community_needs and vulnerable_groups from TEXT[] to TEXT.
-- The reporter form collects freeform prose, not structured tag arrays;
-- TEXT[] was an early design artifact from before the textarea UI was finalized.
ALTER TABLE damage_reports
  ALTER COLUMN community_needs TYPE TEXT USING community_needs::TEXT,
  ALTER COLUMN vulnerable_groups TYPE TEXT USING vulnerable_groups::TEXT;
