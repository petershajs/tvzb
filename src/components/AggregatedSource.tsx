import { useState, useEffect, useCallback } from "react";
import { Copy, Check, Zap, Download, RefreshCw, ExternalLink, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import SourceManager from "./SourceManager";

interface M3USource {
  id: string;
  name: string;
  url: string;
  description: string | null;
  is_active: boolean;
}

interface Channel {
  name: string;
  url: string;
  group?: string;
  logo?: string;
  source: string;
}

interface SourceStats {
  name: string;
  url: string;
  channelCount: number;
}

const AggregatedSource = () => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([]);
  const [aggregatedUrl, setAggregatedUrl] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sources, setSources] = useState<M3USource[]>([]);

  const fetchSources = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("m3u_sources")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setSources(data || []);
    } catch (error) {
      console.error("Error fetching sources:", error);
    }
  }, []);

  const fetchAggregatedData = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      if (forceRefresh) {
        const refreshUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aggregate-m3u?refresh=true`;
        const response = await fetch(refreshUrl);
        const refreshData = await response.json();
        if (refreshData.success) {
          setChannels(refreshData.channels);
          setSourceStats(refreshData.sources);
          setLastUpdated(refreshData.lastUpdated);
          toast.success(`成功刷新 ${refreshData.totalChannels} 个频道`);
        } else {
          throw new Error(refreshData.error || "刷新失败");
        }
      } else {
        const { data, error } = await supabase.functions.invoke("aggregate-m3u");
        
        if (error) throw error;
        
        if (data?.success) {
          setChannels(data.channels);
          setSourceStats(data.sources);
          setLastUpdated(data.lastUpdated);
        } else if (data?.error) {
          throw new Error(data.error);
        }
      }
    } catch (error) {
      console.error("Error fetching aggregated data:", error);
      toast.error("获取直播源失败，请稍后重试");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setAggregatedUrl('/aggregated.m3u');
    // 使用Cloudflare部署的静态M3U文件
    fetchSources();
    fetchAggregatedData(false);
  }, [fetchSources, fetchAggregatedData]);

  const handleSourcesChange = async () => {
    await fetchSources();
    // Auto refresh after adding/removing sources
    
  };

  const formatLastUpdated = (dateString: string | null) => {
    if (!dateString) return "未知";
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleCopyUrl = async () => {
    if (!aggregatedUrl) {
      toast.error("链接未生成");
      return;
    }
    await navigator.clipboard.writeText(aggregatedUrl);
    setCopied(true);
    toast.success("整合源链接已复制，可直接在播放器中使用");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!aggregatedUrl) {
      toast.error("链接未生成");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(aggregatedUrl);
      const content = await response.text();

      const blob = new Blob([content], { type: "audio/x-mpegurl" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "aggregated_sources.m3u";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("M3U文件已下载");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("下载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInPlayer = () => {
    if (!aggregatedUrl) {
      toast.error("链接未生成");
      return;
    }
    window.open(aggregatedUrl, "_blank");
  };

  return (
    <div className="relative overflow-hidden rounded-2xl glow-effect">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20" />

      <div className="relative rounded-2xl border border-primary/30 bg-card/80 p-8 backdrop-blur-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-primary to-accent p-3">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold gradient-text">整合直播源</h2>
              <p className="text-sm text-muted-foreground">
                {channels.length > 0
                  ? `已聚合 ${channels.length} 个频道`
                  : `整合 ${sources.length} 个直播源接口`}
              </p>
            </div>
          </div>
          
        </div>

        {/* Last updated info */}
        {lastUpdated && (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>上次更新: {formatLastUpdated(lastUpdated)}</span>
            <span className="text-xs">(每天自动刷新)</span>
            
          </div>
        )}

        {/* Aggregated URL display */}
        {aggregatedUrl && (
          <div className="mb-6 rounded-lg bg-secondary/30 p-4">
            <p className="mb-2 text-sm font-medium text-foreground">
              整合后的M3U链接（可直接在播放器中使用）:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-background/50 p-2 font-mono text-xs text-primary">
                {aggregatedUrl}
              </code>
            </div>
          </div>
        )}

        {/* Source stats */}
        {sourceStats.length > 0 && (
          <div className="mb-6 space-y-3">
            <p className="text-sm font-medium text-foreground">各源频道统计:</p>
            {sourceStats.map((stat, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 p-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    {stat.name}
                  </span>
                </div>
                <span className="rounded-full bg-primary/20 px-2 py-1 text-xs font-medium text-primary">
                  {stat.channelCount} 频道
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Source Manager */}
        <div className="mb-6">
          <SourceManager sources={sources} onSourcesChange={handleSourcesChange} />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className="flex-1 gap-2 bg-gradient-to-r from-primary to-accent text-white hover:opacity-90"
            onClick={handleCopyUrl}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "已复制" : "复制整合链接"}
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2 border-primary/50 hover:bg-primary/10"
            onClick={handleDownload}
            disabled={loading}
          >
            <Download className="h-4 w-4" />
            下载M3U文件
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2 border-primary/50 hover:bg-primary/10"
            onClick={handleOpenInPlayer}
          >
            <ExternalLink className="h-4 w-4" />
            在浏览器打开
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AggregatedSource;
