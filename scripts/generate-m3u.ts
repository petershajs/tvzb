import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';
import * as dotenv from 'dotenv';

// 获取当前文件目录
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// 加载环境变量
dotenv.config();

// 从环境变量获取Supabase配置
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('请设置SUPABASE_URL和SUPABASE_ANON_KEY环境变量');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
    console.log(`获取 ${source.url}`);
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      console.error(`获取失败: ${response.status}`);
      return [];
    }
    
    const content = await response.text();
    return parseM3U(content, source.name);
  } catch (error) {
    console.error(`获取错误:`, error);
    return [];
  }
}

function parseM3U(content: string, sourceName: string): Channel[] {
  const channels: Channel[] = [];
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  
  let currentChannel: Partial<Channel> | null = null;
  
  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      const nameMatch = line.match(/,([^,]+)$/);
      const groupMatch = line.match(/group-title="([^"]+)"/);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/);
      
      currentChannel = {
        name: nameMatch ? nameMatch[1].trim() : '未知频道',
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
          name: `未命名频道 ${channels.length + 1}`,
          url: line,
          source: sourceName,
        });
      }
    }
  }
  
  console.log(`从 ${sourceName} 解析到 ${channels.length} 个频道`);
  return channels;
}

function generateM3U(channels: Channel[]): string {
  const lines = ['#EXTM3U'];
  
  for (const channel of channels) {
    let extinf = '#EXTINF:-1';
    if (channel.logo) extinf += ` tvg-logo="${channel.logo}"`;
    if (channel.group) extinf += ` group-title="${channel.group}"`;
    extinf += `,${channel.name} [${channel.source}]`;
    
    lines.push(extinf);
    lines.push(channel.url);
  }
  
  return lines.join('\n');
}

async function generateAndSaveM3U() {
  try {
    // 从数据库获取直播源
    const { data: sourcesData, error: sourcesError } = await supabase
      .from('m3u_sources')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    
    if (sourcesError) throw sourcesError;
    const sources: M3USource[] = sourcesData || [];
    console.log(`找到 ${sources.length} 个活跃直播源`);
    
    // 并行获取所有直播源内容
    const channelArrays = await Promise.all(
      sources.map(source => fetchM3UContent({ name: source.name, url: source.url }))
    );
    
    const allChannels = channelArrays.flat();
    console.log(`共聚合 ${allChannels.length} 个频道`);
    
    // 生成M3U内容
    const m3uContent = generateM3U(allChannels);
    
    // 确保public目录存在
    const publicDir = path.join(__dirname, '../public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // 写入文件
    const outputPath = path.join(publicDir, 'aggregated.m3u');
    fs.writeFileSync(outputPath, m3uContent, 'utf8');
    console.log(`M3U文件已保存到 ${outputPath}`);
  } catch (error) {
    console.error('生成M3U文件失败:', error);
    process.exit(1);
  }
}

generateAndSaveM3U();