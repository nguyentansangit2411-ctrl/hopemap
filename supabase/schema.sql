-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enums
CREATE TYPE report_status AS ENUM ('pending', 'community_verified', 'field_verified', 'helped', 'closed');
CREATE TYPE verification_type AS ENUM ('community', 'field');
CREATE TYPE user_role AS ENUM ('user', 'volunteer', 'admin');

-- user_profiles table (id maps to Clerk user_id which is a string)
CREATE TABLE public.user_profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role user_role DEFAULT 'user' NOT NULL,
  verified_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- reports table
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED,
  status report_status DEFAULT 'pending' NOT NULL,
  category TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index on location for geospatial queries
CREATE INDEX reports_location_idx ON public.reports USING GIST (location);

-- verifications table
CREATE TABLE public.verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type verification_type NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON public.reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get Clerk user ID from Supabase JWT
CREATE OR REPLACE FUNCTION requesting_user_id()
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::text;
$$ LANGUAGE sql STABLE;

-- RLS Policies

-- Reports Policies
-- 1. Public can read verified reports
CREATE POLICY "Public can read verified reports"
  ON public.reports
  FOR SELECT
  USING (status IN ('community_verified', 'field_verified', 'helped', 'closed'));

-- 2. Owner can read their own reports (even pending ones)
CREATE POLICY "Users can read own reports"
  ON public.reports
  FOR SELECT
  USING (requesting_user_id() = user_id);

-- 3. Owner can create reports
CREATE POLICY "Users can create reports"
  ON public.reports
  FOR INSERT
  WITH CHECK (requesting_user_id() = user_id);

-- 4. Owner can update their own reports
CREATE POLICY "Users can update own reports"
  ON public.reports
  FOR UPDATE
  USING (requesting_user_id() = user_id)
  WITH CHECK (requesting_user_id() = user_id);

-- User Profiles Policies
CREATE POLICY "Public can read user profiles"
  ON public.user_profiles
  FOR SELECT
  USING (true);

-- Verifications Policies
CREATE POLICY "Public can read verifications"
  ON public.verifications
  FOR SELECT
  USING (true);

-- notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Notifications Policies
CREATE POLICY "Users can read own notifications"
  ON public.notifications
  FOR SELECT
  USING (requesting_user_id() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (requesting_user_id() = user_id)
  WITH CHECK (requesting_user_id() = user_id);

-- Migration: Create report_category enum and update reports table
CREATE TYPE report_category AS ENUM (
  'người vô gia cư',
  'cụ già bệnh',
  'trẻ em lang thang',
  'khác'
);

ALTER TABLE reports
  ALTER COLUMN category TYPE report_category
  USING category::report_category;
