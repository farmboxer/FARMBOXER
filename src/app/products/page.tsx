"use client";

import { DemoBanner } from "@/components/demo-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { api } from "@/lib/client";
import { listMargin } from "@/lib/margin";
import { formatRmb } from "@/lib/utils";
import { useEffect, useState } from "react";

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  specsJson: string;
  listPrice: number;
  floorPrice: number;
  cost: number;
  configsJson: string;
  targetMarkets: string;
  solutionTags: string;
  isSample: boolean;
};

type Ranked = Product & {
  score: number;
  marginPercent: number;
  meetsMarginFloor: boolean;
  minQuotablePrice: number;
  reasons: string[];
};

const empty: Omit<Product, "id"> = {
  name: "",
  sku: "",
  category: "铡草机",
  specsJson: "{}",
  listPrice: 0,
  floorPrice: 0,
  cost: 0,
  configsJson: "[]",
  targetMarkets: "",
  solutionTags: "",
  isSample: false,
};

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [need, setNeed] = useState("肯尼亚 15 头奶牛 220V 铡草机 9ZT-0.6");
  const [country, setCountry] = useState("肯尼亚");
  const [ranked, setRanked] = useState<Ranked[]>([]);
  const [floor, setFloor] = useState(15);
  const [msg, setMsg] = useState("");

  async function load() {
    const data = await api<{ items: Product[] }>("/api/products");
    setItems(data.items);
  }

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
  }, []);

  async function save() {
    if (editing) {
      await api(`/api/products/${editing}`, { method: "PUT", body: JSON.stringify(form) });
    } else {
      await api("/api/products", { method: "POST", body: JSON.stringify(form) });
    }
    setForm(empty);
    setEditing(null);
    await load();
  }

  async function match() {
    const data = await api<{ ranked: Ranked[]; marginFloorPercent: number }>("/api/products/match", {
      method: "POST",
      body: JSON.stringify({ need, country }),
    });
    setRanked(data.ranked);
    setFloor(data.marginFloorPercent);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-emerald-950">产品与方案</h1>
      <DemoBanner extra="样本价仅用于匹配演示，不是对外成交价。" />

      <Card>
        <CardHeader>
          <CardTitle>需求匹配（毛利感知）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <Input value={need} onChange={(e) => setNeed(e.target.value)} placeholder="客户需求" />
            <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="国家" />
          </div>
          <Button onClick={() => match().catch((e) => setMsg(e.message))}>排序推荐</Button>
          {ranked.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-stone-500">
                    <th className="py-1">得分</th>
                    <th>SKU</th>
                    <th>毛利</th>
                    <th>最低可报</th>
                    <th>原因</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r) => (
                    <tr key={r.sku} className="border-t border-stone-100">
                      <td className="py-1">{r.score.toFixed(1)}</td>
                      <td>
                        {r.name}
                        <div className="text-stone-500">{r.sku}</div>
                      </td>
                      <td>
                        {r.marginPercent.toFixed(1)}%{" "}
                        {r.meetsMarginFloor ? (
                          <Badge tone="good">≥{floor}%</Badge>
                        ) : (
                          <Badge tone="warn">低于底线</Badge>
                        )}
                      </td>
                      <td>{formatRmb(r.minQuotablePrice)}</td>
                      <td>{r.reasons.join("；")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-2 pt-4">
            <p className="text-sm font-medium">{editing ? "编辑产品" : "新增产品"}</p>
            {(
              [
                ["name", "名称"],
                ["sku", "SKU"],
                ["category", "类目"],
                ["targetMarkets", "目标市场"],
                ["solutionTags", "方案标签"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label>{label}</Label>
                <Input
                  value={String(form[key])}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>目录价</Label>
                <Input
                  type="number"
                  value={form.listPrice}
                  onChange={(e) => setForm({ ...form, listPrice: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>底价</Label>
                <Input
                  type="number"
                  value={form.floorPrice}
                  onChange={(e) => setForm({ ...form, floorPrice: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>成本</Label>
                <Input
                  type="number"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                />
              </div>
            </div>
            <Label>规格 JSON</Label>
            <Textarea value={form.specsJson} onChange={(e) => setForm({ ...form, specsJson: e.target.value })} />
            <Label>配置 JSON</Label>
            <Textarea value={form.configsJson} onChange={(e) => setForm({ ...form, configsJson: e.target.value })} />
            <Button onClick={() => save().catch((e) => setMsg(e.message))}>保存</Button>
            {msg ? <p className="text-xs text-red-700">{msg}</p> : null}
          </CardContent>
        </Card>
        <div className="space-y-3 lg:col-span-3">
          {items.map((p) => {
            const m = listMargin(p);
            return (
              <Card key={p.id}>
                <CardContent className="space-y-2 pt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {p.name} <span className="text-stone-500">({p.sku})</span>
                    </p>
                    <Badge>{p.category}</Badge>
                    {p.isSample ? <Badge tone="sample">样本</Badge> : null}
                    {m >= 15 ? <Badge tone="good">毛利 {m.toFixed(1)}%</Badge> : <Badge tone="warn">毛利 {m.toFixed(1)}%</Badge>}
                  </div>
                  <p className="text-xs text-stone-600">
                    目录 {formatRmb(p.listPrice)} · 底价 {formatRmb(p.floorPrice)} · 成本 {formatRmb(p.cost)}
                  </p>
                  <p className="text-xs">市场：{p.targetMarkets || "—"} · 标签：{p.solutionTags}</p>
                  <pre className="overflow-auto rounded bg-stone-50 p-2 text-[11px]">{p.specsJson}</pre>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(p.id);
                        const { id: _id, ...rest } = p;
                        setForm(rest);
                      }}
                    >
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        api(`/api/products/${p.id}`, { method: "DELETE" })
                          .then(() => load())
                          .catch((e) => setMsg(e.message))
                      }
                    >
                      删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
