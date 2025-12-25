-- Create table to store aggregated channels
CREATE TABLE public.aggregated_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  group_title TEXT,
  logo TEXT,
  source_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to store last update time
CREATE TABLE public.aggregation_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_channels INTEGER NOT NULL DEFAULT 0,
  source_stats JSONB
);

-- Allow public read access (no auth required for IPTV data)
ALTER TABLE public.aggregated_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aggregation_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read channels" 
ON public.aggregated_channels 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can read metadata" 
ON public.aggregation_metadata 
FOR SELECT 
USING (true);

-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;