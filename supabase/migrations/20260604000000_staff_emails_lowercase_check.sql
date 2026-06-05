-- Enforce the load-bearing invariant that staff_emails stores lowercase addresses.
-- All app write paths already lowercase (staff.post.ts, the seed); this CHECK guarantees
-- it at the DB so a manual bootstrap INSERT with mixed case can't silently break the
-- case-insensitive allowlist comparisons in requireStaff/is_staff().
ALTER TABLE staff_emails
  ADD CONSTRAINT staff_emails_email_lowercase CHECK (email = lower(email));
