-- Remove the worldwide Demo Sandbox catch-all. Demo coverage now comes from ~14
-- regional SIMEX scenario crises; locations outside every zone get the reporter
-- flow's "no active crisis in your area" notice instead of a synthetic catch-all.
DELETE FROM crises WHERE id = '018f3c2a-0099-7000-8000-000000000099';
