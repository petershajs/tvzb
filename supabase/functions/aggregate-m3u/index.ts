import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Channel {
  name: string;
  url: string;
  group?: string;
  logo?: string;
  source: string;
}

interface M3USource {
  id: string;
  name: string;
  url: string;
  description: string | null;
  is_active: boolean;
}

async function fetchM3UContent(source: { name: string; url: string }): Promise<Channel[]> {
  try {
    console.log(`Fetching M3U from: ${source.url}`);
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch ${source.url}: ${response.status}`);
      return [];
    }
    
    const content = await response.text();
    return parseM3U(content, source.name);
  } catch (error) {
    console.error(`Error fetching ${source.url}:`, error);
    return [];
  }
}

function parseM3U(content: string, sourceName: string): Channel[] {
  const channels: Channel[] = [];
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  
  let currentChannel: Partial<Channel> | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('#EXTINF:')) {
      const nameMatch = line.match(/,([^,]+)$/);
      const groupMatch = line.match(/group-title="([^"]+)"/);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      
      currentChannel = {
        name: nameMatch ? nameMatch[1].trim() : 'Unknown',
        group: groupMatch ? groupMatch[1] : undefined,
        logo: logoMatch ? logoMatch[1] : undefined,
        source: sourceName,
      };
    } else if (line.startsWith('#')) {
      continue;
    } else if (line.startsWith('http') || line.startsWith('rtmp') || line.startsWith('rtsp')) {
      if (currentChannel) {
        currentChannel.url = line;
        channels.push(currentChannel as Channel);
        currentChannel = null;
      } else {
        channels.push({
          name: `Channel ${channels.length + 1}`,
          url: line,
          source: sourceName,
        });
      }
    }
  }
  
  console.log(`Parsed ${channels.length} channels from ${sourceName}`);
  return channels;
}

function generateM3U(channels: Channel[]): string {
  const lines = ['#EXTM3U'];
  
  for (const channel of channels) {
    let extinf = '#EXTINF:-1';
    if (channel.logo) {
      extinf += ` tvg-logo="${channel.logo}"`;
    }
    if (channel.group) {
      extinf += ` group-title="${channel.group}"`;
    }
    extinf += `,${channel.name} [${channel.source}]`;
    
    lines.push(extinf);
    lines.push(channel.url);
  }
  
  return lines.join('\n');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function refreshAndCacheChannels(supabase: any): Promise<{ channels: Channel[], sourceStats: { name: string; url: string; channelCount: number }[] }> {
  console.log('Starting M3U aggregation and caching...');
  
  // Fetch sources from database
  const { data: sourcesData, error: sourcesError } = await supabase
    .from('m3u_sources')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  
  if (sourcesError) {
    console.error('Error fetching sources:', sourcesError);
    throw new Error('Failed to fetch sources from database');
  }
  
  const sources: M3USource[] = sourcesData || [];
  console.log(`Found ${sources.length} active sources`);
  
  // Fetch all M3U sources in parallel
  const channelArrays = await Promise.all(
    sources.map(source => fetchM3UContent({ name: source.name, url: source.url }))
  );
  
  const allChannels = channelArrays.flat();
  console.log(`Total channels aggregated: ${allChannels.length}`);
  
  const sourceStats = sources.map((source, index) => ({
    name: source.name,
    url: source.url,
    channelCount: channelArrays[index].length,
  }));
  
  // Clear existing channels
  await supabase
    .from('aggregated_channels')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  // Insert new channels in batches
  const batchSize = 500;
  for (let i = 0; i < allChannels.length; i += batchSize) {
    const batch = allChannels.slice(i, i + batchSize).map(ch => ({
      name: ch.name,
      url: ch.url,
      group_title: ch.group || null,
      logo: ch.logo || null,
      source_name: ch.source,
    }));
    
    const { error: insertError } = await supabase
      .from('aggregated_channels')
      .insert(batch);
    
    if (insertError) {
      console.error(`Error inserting batch ${i / batchSize}:`, insertError);
    }
  }
  
  // Update metadata
  await supabase
    .from('aggregation_metadata')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  const { error: metaInsertError } = await supabase
    .from('aggregation_metadata')
    .insert({
      last_updated_at: new Date().toISOString(),
      total_channels: allChannels.length,
      source_stats: sourceStats,
    });
  
  if (metaInsertError) {
    console.error('Error inserting metadata:', metaInsertError);
  }
  
  console.log('Channels cached successfully');
  return { channels: allChannels, sourceStats };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'json';
    const refresh = url.searchParams.get('refresh') === 'true';
    
    let channels: Channel[] = [];
    let sourceStats: { name: string; url: string; channelCount: number }[] = [];
    let lastUpdated: string | null = null;
    
    if (refresh) {
      const result = await refreshAndCacheChannels(supabase);
      channels = result.channels;
      sourceStats = result.sourceStats;
      lastUpdated = new Date().toISOString();
    } else {
      const { data: metaData } = await supabase
        .from('aggregation_metadata')
        .select('*')
        .order('last_updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (metaData) {
        lastUpdated = metaData.last_updated_at;
        sourceStats = metaData.source_stats || [];
        
        const { data: cachedChannels } = await supabase
          .from('aggregated_channels')
          .select('*')
          .order('created_at', { ascending: true });
        
        if (cachedChannels && cachedChannels.length > 0) {
          channels = cachedChannels.map((ch: { name: string; url: string; group_title: string | null; logo: string | null; source_name: string }) => ({
            name: ch.name,
            url: ch.url,
            group: ch.group_title || undefined,
            logo: ch.logo || undefined,
            source: ch.source_name,
          }));
        } else {
          const result = await refreshAndCacheChannels(supabase);
          channels = result.channels;
          sourceStats = result.sourceStats;
          lastUpdated = new Date().toISOString();
        }
      } else {
        const result = await refreshAndCacheChannels(supabase);
        channels = result.channels;
        sourceStats = result.sourceStats;
        lastUpdated = new Date().toISOString();
      }
    }
    
    if (format === 'm3u') {
      const m3uContent = generateM3U(channels);
      return new Response(m3uContent, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'audio/x-mpegurl',
          'Content-Disposition': 'attachment; filename="aggregated.m3u"',
        },
      });
    } else {
      return new Response(JSON.stringify({
        success: true,
        totalChannels: channels.length,
        lastUpdated,
        sources: sourceStats,
        channels: channels,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error: unknown) {
    console.error('Error in aggregate-m3u function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
