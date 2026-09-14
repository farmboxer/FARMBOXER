"use client";

import { DemoBanner } from "@/components/demo-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { KB_CATEGORIES } from "@/lib/constants";
import { api } from "@/lib/client";
import { useEffect, useState } from "react";

type Article = {
  id: string;
  title: string;
  content: string;
  tags: string;
  category: string;
  language: string;
  source: string;
  isSample: boolean;
};

const empty = {
  title: "",
  content: "",
  tags: "",
  category: "产品参数",
  language: "zh-CN",
  isSample: false,
};

export default function KnowledgePage() {
  const [items, setItems] = useState<Article[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [searchHits, setSearchHits] = useState<Array<{ title: string; score: number; category: string }>>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const data = await api<{ items: Article[] }>(
      `/api/knowledge?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`,
    );
    setItems(data.items);
  }

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
  }, [q, category]);

  async function save() {
    const payload = { ...form };
    if (editing) {
      await api(`/api/knowledge/${editing}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/knowledge", { method: "POST", body: JSON.stringify(payload) });
    }
    setForm(empty);
    setEditing(null);
    setMsg("已保存。新条目会被回复引擎检索。");
    await load();
  }

  async function remove(id: string) {
    if (!confirm("确认删除？")) return;
    await api(`/api/knowledge/${id}`, { method: "DELETE" });
    await load();
  }

  async function testSearch() {
    const data = await api<{ hits: Array<{ title: string; score: number; category: string }> }>(
      `/api/knowledge/search?q=${encodeURIComponent(q || form.title || "9ZT-0.6")}`,
    );
    setSearchHits(data.hits);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-emerald-950">知识库</h1>
      <DemoBanner extra="样本条目标题带【样本】。新增正式条目后，可在收件箱 MOCK 一条询盘验证草稿是否引用。" />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 pt-4">
            <p className="text-sm font-medium">{editing ? "编辑条目" : "新增条目"}</p>
            <div className="space-y-1">
              <Label>标题</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>分类</Label>
              <select
                className="h-9 w-full rounded-md border border-stone-300 bg-white px-2 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {KB_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>标签</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>正文</Label>
              <Textarea
                rows={8}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.isSample}
                onChange={(e) => setForm({ ...form, isSample: e.target.checked })}
              />
              标记为样本/演示
            </label>
            <div className="flex gap-2">
              <Button onClick={() => save().catch((e) => setMsg(e.message))}>保存</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setForm(empty);
                  setEditing(null);
                }}
              >
                清空
              </Button>
            </div>
            {msg ? <p className="text-xs text-emerald-800">{msg}</p> : null}
          </CardContent>
        </Card>

        <div className="space-y-3 lg:col-span-3">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="筛选标题/正文"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">全部分类</option>
              {KB_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <Button variant="outline" onClick={() => testSearch().catch((e) => setMsg(e.message))}>
              测试检索
            </Button>
          </div>
          {searchHits.length ? (
            <Card>
              <CardContent className="pt-4 text-xs">
                <p className="mb-2 font-medium">检索引擎命中</p>
                {searchHits.map((h) => (
                  <p key={h.title}>
                    {h.category} · {h.title}（分 {h.score}）
                  </p>
                ))}
              </CardContent>
            </Card>
          ) : null}
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-2 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.title}</p>
                  <Badge>{item.category}</Badge>
                  {item.isSample ? <Badge tone="sample">样本</Badge> : null}
                  <Badge tone="muted">{item.language}</Badge>
                </div>
                <p className="text-sm whitespace-pre-wrap text-stone-700">{item.content}</p>
                <p className="text-xs text-stone-500">标签：{item.tags || "—"} · 来源 {item.source}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(item.id);
                      setForm({
                        title: item.title,
                        content: item.content,
                        tags: item.tags,
                        category: item.category,
                        language: item.language,
                        isSample: item.isSample,
                      });
                    }}
                  >
                    编辑
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => remove(item.id)}>
                    删除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
