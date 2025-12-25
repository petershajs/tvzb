-- Create table to store custom M3U sources
CREATE TABLE public.m3u_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS and allow public access
ALTER TABLE public.m3u_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sources" 
ON public.m3u_sources 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert sources" 
ON public.m3u_sources 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can delete sources" 
ON public.m3u_sources 
FOR DELETE 
USING (true);

CREATE POLICY "Anyone can update sources" 
ON public.m3u_sources 
FOR UPDATE 
USING (true);

-- Insert the default 3 sources
INSERT INTO public.m3u_sources (name, url, description) VALUES
('MyIPTV (IPv4)', 'https://raw.githubusercontent.com/suxuang/myIPTV/main/ipv4.m3u', 'GitHub上的高质量IPv4直播源，定期更新维护'),
('Gather TV', 'https://tv.iill.top/m3u/Gather', '聚合多个平台的综合直播源'),
('188766 ITV', 'https://188766.xyz/itv', '稳定可靠的电视直播源');