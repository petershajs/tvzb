import { Tv, Signal } from "lucide-react";
import AggregatedSource from "@/components/AggregatedSource";

const Index = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="mb-6 inline-flex items-center justify-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">
            <Signal className="h-4 w-4" />
            <span>直播源聚合器</span>
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            <span className="gradient-text">IPTV 直播源</span>
            <br />
            <span className="text-foreground">一站式整合</span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            将多个直播源整合到一个界面，轻松管理和使用您的IPTV资源
          </p>
        </header>

        {/* Aggregated Source Section */}
        <section className="mb-12">
          <AggregatedSource />
        </section>

        {/* Footer */}
        <footer className="mt-16 text-center text-sm text-muted-foreground">
          <p>每天自动刷新整合链接，确保获取最新直播源</p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
