-- CrisisMapper — Initial Schema
-- Phase 1 Foundation, May 1 2026
-- Apply via Supabase SQL Editor → paste full file → Run

-- ─── Extensions ───────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Tables ───────────────────────────────────────────────────────────────────

-- Crisis events (one row per declared crisis zone)
CREATE TABLE crises (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  crisis_type TEXT NOT NULL,  -- earthquake | flood | conflict | cyclone | hurricane | other
  bbox        GEOMETRY(Polygon, 4326),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON crises USING GIST (bbox);

-- Building footprints (loaded from Overture Maps per crisis zone at registration time)
CREATE TABLE buildings (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crisis_id UUID NOT NULL REFERENCES crises(id) ON DELETE CASCADE,
  geom      GEOMETRY(Polygon, 4326) NOT NULL,
  height_m  NUMERIC,
  osm_type  TEXT
);
CREATE INDEX ON buildings USING GIST (geom);
CREATE INDEX ON buildings (crisis_id);

-- Pseudonymous reporters (no PII stored — whatsapp_id_hash is SHA-256(HMAC(wa_id, secret)))
CREATE TABLE reporters (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname         TEXT,
  channel          TEXT NOT NULL CHECK (channel IN ('whatsapp', 'pwa')),
  whatsapp_id_hash TEXT UNIQUE,  -- one-way hash, not reversible
  report_count     INT DEFAULT 0,
  verified_count   INT DEFAULT 0,
  points           INT DEFAULT 0,
  badges           TEXT[] DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Core damage reports (wide, denormalized — optimized for read-heavy dashboard)
CREATE TABLE damage_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crisis_id    UUID NOT NULL REFERENCES crises(id),
  reporter_id  UUID REFERENCES reporters(id),  -- nullable (anonymous reports allowed)
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel      TEXT NOT NULL CHECK (channel IN ('whatsapp', 'pwa')),

  -- Location
  location          GEOMETRY(Point, 4326) NOT NULL,
  location_method   TEXT CHECK (location_method IN ('gps', 'manual_pin', 'whatsapp_share', 'plus_code', 'landmark_text')),
  plus_code         TEXT,
  location_landmark TEXT,  -- free text fallback when GPS + plus_code both unavailable

  -- Damage (4-tier internal — per Copernicus EMS / UNOSAT)
  infrastructure_type TEXT CHECK (infrastructure_type IN ('building','road','bridge','hospital','school','utility','other')),
  severity            TEXT NOT NULL CHECK (severity IN ('negligible','moderate','severe','destroyed','unknown')),
  description         TEXT,

  -- 3-tier export column (Q&A #14 mandatory export schema — auto-derived from severity)
  damage_classification TEXT GENERATED ALWAYS AS (
    CASE
      WHEN severity = 'negligible'              THEN 'minimal'
      WHEN severity = 'moderate'                THEN 'partial'
      WHEN severity IN ('severe', 'destroyed')  THEN 'complete'
      -- 'unknown' severity produces NULL (not a valid export tier; filter in export queries)
    END
  ) STORED,

  -- AI classification results (stored for audit + retraining)
  ai_severity               TEXT,
  ai_confidence             NUMERIC(4,3),
  ai_infrastructure_visible BOOLEAN,
  ai_raw_response           JSONB,  -- full model response for debugging / retraining

  -- Extended optional fields (progressive disclosure in UI)
  electricity_status  TEXT CHECK (electricity_status  IN ('functional','partial','non-functional','unknown')),
  health_status       TEXT CHECK (health_status       IN ('operational','partial','down','unknown')),
  community_needs     TEXT[],  -- ['water','food','shelter','medical','search']
  affected_population TEXT CHECK (affected_population IN ('<50','50-200','200-1000','1000+')),
  vulnerable_groups   TEXT[],

  -- Media
  photo_url  TEXT,
  photo_hash BYTEA,  -- SHA-256 of raw photo bytes (before EXIF strip) for cheap dedup

  -- Deduplication
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  duplicate_of UUID REFERENCES damage_reports(id),

  -- Verification & quality
  is_verified   BOOLEAN NOT NULL DEFAULT false,
  quality_score NUMERIC(4,3)  -- 0.0–1.0; formula in docs/QUALITY_SCORE.md
);

-- Indexes on damage_reports
CREATE INDEX ON damage_reports USING GIST (location);                                              -- spatial bbox queries
CREATE INDEX ON damage_reports (crisis_id, submitted_at DESC);                                     -- dashboard: latest N in crisis
CREATE INDEX ON damage_reports (crisis_id, submitted_at DESC) WHERE is_duplicate = false;          -- dedup detection window
CREATE INDEX ON damage_reports (photo_hash);                                                        -- photo dedup before AI call
CREATE INDEX ON damage_reports (reporter_id, submitted_at DESC);                                    -- reporter stats page

-- WhatsApp bot conversation state machine
CREATE TABLE whatsapp_sessions (
  wa_id_hash        TEXT PRIMARY KEY,  -- SHA-256(HMAC(wa_id, secret)) — same scheme as reporters.whatsapp_id_hash
  state             TEXT NOT NULL DEFAULT 'IDLE'
                    CHECK (state IN ('IDLE','AWAITING_PHOTO','AWAITING_CONFIRM','AWAITING_LOCATION','DONE')),
  current_report_id UUID REFERENCES damage_reports(id),
  last_message_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  context           JSONB NOT NULL DEFAULT '{}'::jsonb,  -- scratch pad for in-progress report data
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour')
);
CREATE INDEX ON whatsapp_sessions (last_message_at);
CREATE INDEX ON whatsapp_sessions (expires_at) WHERE state <> 'DONE';  -- cleanup job target

-- Badge master reference table
CREATE TABLE badges (
  badge_code  TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  icon_emoji  TEXT
);

INSERT INTO badges (badge_code, name, description, icon_emoji) VALUES
  ('first_responder', 'First Responder', 'One of first 50 reporters in a crisis zone',             '🚨'),
  ('pioneer',         'Pioneer',         'First report in a geographic grid cell (geohash 6)',      '🗺️'),
  ('verified',        'Verified',        '3+ reports flagged as high-confidence by AI (≥0.80)',     '✅'),
  ('coverage_hero',   'Coverage Hero',   'Reports submitted in 5+ distinct grid cells in one crisis','🌍'),
  ('streak',          'Streak',          'Reports on 3 consecutive days',                           '🔥');

-- ─── Public dashboard view ─────────────────────────────────────────────────────
-- No RLS on this view → fast reads for dashboard / Realtime subscriptions
-- Exposes only non-sensitive fields; exact coordinates and photos hidden from unauthenticated layer

CREATE VIEW crisis_reports_public AS
  SELECT
    id, crisis_id, location, severity, damage_classification,
    infrastructure_type, ai_confidence, channel, submitted_at,
    photo_url, is_verified, is_duplicate, quality_score
  FROM damage_reports;

-- SECURITY DEFINER function for spatial-filtered dashboard reads
-- Bypasses RLS on the base table; reads through the public view
CREATE OR REPLACE FUNCTION get_crisis_reports(
  p_crisis_id UUID,
  p_bbox      GEOMETRY DEFAULT NULL
)
RETURNS SETOF crisis_reports_public
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT * FROM crisis_reports_public
  WHERE crisis_id = p_crisis_id
    AND (p_bbox IS NULL OR location && p_bbox)
  ORDER BY submitted_at DESC
  LIMIT 5000;
$$;

-- ─── Row-Level Security ────────────────────────────────────────────────────────
-- damage_reports: reporters can INSERT (submit), reads go through the view above

ALTER TABLE damage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reporters_insert"
  ON damage_reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id OR reporter_id IS NULL);
