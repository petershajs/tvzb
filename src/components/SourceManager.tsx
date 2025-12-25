import { useState } from "react";
import { Plus, Trash2, Link2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface M3USource {
  id: string;
  name: string;
  url: string;
  description: string | null;
  is_active: boolean;
}

interface SourceManagerProps {
  sources: M3USource[];
  onSourcesChange: () => void;
}

const SourceManager = ({ sources, onSourcesChange }: SourceManagerProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: "delete";
    data?: { id: string; name: string };
  } | null>(null);
  const [newSource, setNewSource] = useState({ name: "", url: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);





  const handleAddClick = () => {
    setIsAddDialogOpen(true);
  };

  const handleDeleteClick = (id: string, name: string) => {
    if (confirm(`确定要删除 "${name}"?`)) {
      executeDelete(id, name);
    }
  };

  const handleAddSource = async () => {
    if (!newSource.name.trim() || !newSource.url.trim()) {
      toast.error("请填写名称和URL");
      return;
    }

    try {
      new URL(newSource.url);
    } catch {
      toast.error("请输入有效的URL");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("m3u_sources").insert({
        name: newSource.name.trim(),
        url: newSource.url.trim(),
        description: newSource.description.trim() || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("该URL已存在");
        } else {
          throw error;
        }
      } else {
        toast.success("直播源添加成功");
        setNewSource({ name: "", url: "", description: "" });
        setIsAddDialogOpen(false);
        onSourcesChange();
      }
    } catch (error) {
      console.error("Error adding source:", error);
      toast.error("添加失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const executeDelete = async (id: string, name: string) => {
    try {
      const { error } = await supabase.from("m3u_sources").delete().eq("id", id);

      if (error) throw error;

      toast.success(`"${name}" 已删除`);
      onSourcesChange();
    } catch (error) {
      console.error("Error deleting source:", error);
      toast.error("删除失败，请稍后重试");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">直播源管理:</p>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleAddClick}>
          <Plus className="h-4 w-4" />
          添加直播源
        </Button>
      </div>

      {/* Password Dialog */}


      {/* Add Source Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加新直播源</DialogTitle>
            <DialogDescription>
              输入M3U直播源的名称和URL地址
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">名称 *</label>
              <Input
                placeholder="例如: 我的直播源"
                value={newSource.name}
                onChange={(e) =>
                  setNewSource({ ...newSource, name: e.target.value })
                }
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">M3U链接 *</label>
              <Input
                placeholder="https://example.com/playlist.m3u"
                value={newSource.url}
                onChange={(e) =>
                  setNewSource({ ...newSource, url: e.target.value })
                }
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">描述（可选）</label>
              <Input
                placeholder="简短描述这个直播源"
                value={newSource.description}
                onChange={(e) =>
                  setNewSource({ ...newSource, description: e.target.value })
                }
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleAddSource} disabled={loading}>
              {loading ? "添加中..." : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {sources.map((source) => (
          <div
            key={source.id}
            className="flex items-center gap-3 rounded-lg bg-secondary/30 p-3 group"
          >
            <Link2 className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {source.name}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {source.url}
              </p>
              {source.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {source.description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => handleDeleteClick(source.id, source.name)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {sources.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>暂无直播源，点击上方按钮添加</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SourceManager;
