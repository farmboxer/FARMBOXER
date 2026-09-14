"use client";

import { DemoBanner } from "@/components/demo-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client";
import { useEffect, useState } from "react";

type Finding = {
  id: string;
  country: string;
  localConfigPrefs: string;
  priceBands: string;
  competitors: string;
  source: string;
  status: string;
  notes: string;
  isSample: boolean;
};

export default function MarketPage() {
  const [items, setItems] = useState<Finding[]>([]);
  const [form, setForm] = useState({
    country: "",
    localConfigPrefs: "",
    priceBands: "",
    competitors: "",
    notes: "",
  });
  const [msg, setMsg] = useState("");

  async function load() {
    const data = await api<{ items: Finding[] }>("/api/market");
    setItems(data.items);
  }

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-emerald-950">市场情报</h1>
      <DemoBanner extra="适配器接口：seed + 手工录入 + 抓取桩。批准后写入知识库「市场情报」。" />

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() =>
            api("/api/market/run", { method: "POST" })
              .then(() => load())
              .then(() => setMsg("每日任务已执行（CLI 对应 npm run job:market）"))
              .catch((e) => setMsg(e.message))
          }
        >
          立即跑每日任务
        </Button>
      </div>
      {msg ? <p className="text-xs text-emerald-800">{msg}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>手工录入</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          <Label>国家</Label>
          <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <Label>本地配置偏好</Label>
          <Textarea
            value={form.localConfigPrefs}
            onChange={(e) => setForm({ ...form, localConfigPrefs: e.target.value })}
          />
          <Label>价格带</Label>
          <Textarea value={form.priceBands} onChange={(e) => setForm({ ...form, priceBands: e.target.value })} />
          <Label>竞品</Label>
          <Textarea value={form.competitors} onChange={(e) => setForm({ ...form, competitors: e.target.value })} />
          <Button
            onClick={() =>
              api("/api/market", { method: "POST", body: JSON.stringify(form) })
                .then(() => {
                  setForm({ country: "", localConfigPrefs: "", priceBands: "", competitors: "", notes: "" });
                  return load();
                })
                .catch((e) => setMsg(e.message))
            }
          >
            保存待审
          </Button>
        </CardContent>
      </Card>

      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="space-y-2 pt-4">
            <div className="flex flex-wrap gap-2">
              <p className="font-medium">{item.country}</p>
              <Badge>{item.status}</Badge>
              <Badge tone="muted">{item.source}</Badge>
              {item.isSample ? <Badge tone="sample">样本</Badge> : null}
            </div>
            <p className="text-sm">配置：{item.localConfigPrefs}</p>
            <p className="text-sm">价格：{item.priceBands}</p>
            <p className="text-sm">竞品：{item.competitors}</p>
            {item.status !== "approved" ? (
              <Button
                size="sm"
                onClick={() =>
                  api(`/api/market/${item.id}/approve`, { method: "POST" })
                    .then(() => {
                      setMsg("已批准并写入知识库，回复引擎可检索。");
                      return load();
                    })
                    .catch((e) => setMsg(e.message))
                }
              >
                批准入库
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
