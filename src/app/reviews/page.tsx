"use client";

import { DemoBanner } from "@/components/demo-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/client";
import { useEffect, useState } from "react";

type Report = {
  id: string;
  title: string;
  markdown: string;
  createdAt: string;
  isSample: boolean;
};

export default function ReviewsPage() {
  const [items, setItems] = useState<Report[]>([]);
  const [open, setOpen] = useState<Report | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const data = await api<{ items: Report[] }>("/api/reviews");
    setItems(data.items);
  }

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-emerald-950">三日复盘</h1>
      <DemoBanner extra="报告会直率批评样本依赖与 10 亿路径的激进程度，并给出守住毛利的动作。" />
      <Button
        onClick={() =>
          api<{ report: Report }>("/api/reviews/run", { method: "POST" })
            .then((r) => {
              setOpen(r.report);
              setMsg("已生成。CLI：npm run job:review");
              return load();
            })
            .catch((e) => setMsg(e.message))
        }
      >
        立即生成复盘
      </Button>
      {msg ? <p className="text-xs text-emerald-800">{msg}</p> : null}

      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4">
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-stone-500">{new Date(item.createdAt).toLocaleString("zh-CN")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.isSample ? <Badge tone="sample">含样本数据</Badge> : null}
              <Button size="sm" variant="outline" onClick={() => setOpen(item)}>
                查看
              </Button>
              <a className="text-sm underline" href={`/api/reviews/${item.id}?format=md`}>
                Markdown
              </a>
              <a className="text-sm underline" href={`/api/reviews/${item.id}?format=html`}>
                HTML
              </a>
            </div>
          </CardContent>
        </Card>
      ))}

      {open ? (
        <Card>
          <CardContent className="pt-4">
            <pre className="overflow-auto whitespace-pre-wrap text-xs leading-relaxed">{open.markdown}</pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
