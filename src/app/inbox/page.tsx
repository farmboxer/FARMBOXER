"use client";

import { DemoBanner } from "@/components/demo-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { STAGE_LABELS } from "@/lib/constants";
import { api } from "@/lib/client";
import { useEffect, useState } from "react";

type Contact = {
  id: string;
  phone: string;
  name: string;
  country: string;
  needs: string;
  tier: string;
  stage: string;
  productNotes: string;
  conversations?: Conversation[];
};

type Conversation = {
  id: string;
  direction: string;
  body: string;
  status: string;
  draftReply: string;
  confidence: number | null;
  autoSent: boolean;
  createdAt: string;
};

export default function InboxPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pending, setPending] = useState<Array<Conversation & { contact: Contact }>>([]);
  const [active, setActive] = useState<Contact | null>(null);
  const [mock, setMock] = useState({
    phone: "254711000001",
    name: "Peter Mwangi",
    text: "Do you have 9ZT-0.6 chaff cutter? Need 220V for dairy in Kenya.",
  });
  const [editBody, setEditBody] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  async function loadList() {
    const data = await api<{ contacts: Contact[]; pending: Array<Conversation & { contact: Contact }> }>(
      "/api/inbox",
    );
    setContacts(data.contacts);
    setPending(data.pending);
  }

  async function openContact(id: string) {
    const data = await api<{ contact: Contact }>(`/api/inbox/${id}`);
    setActive(data.contact);
  }

  useEffect(() => {
    loadList().catch((e) => setMsg(e.message));
  }, []);

  async function inject() {
    const result = await api<{ draft: { text: string; confidence: number; kbHits: Array<{ title: string }> } }>(
      "/api/inbox/mock",
      { method: "POST", body: JSON.stringify(mock) },
    );
    setMsg(
      `已生成草稿（置信度 ${(result.draft.confidence * 100).toFixed(0)}%）。知识库命中：${
        result.draft.kbHits.map((h) => h.title).join("；") || "无"
      }`,
    );
    await loadList();
    const created = contacts.find((c) => c.phone.replace(/\D/g, "") === mock.phone.replace(/\D/g, ""));
    if (created) await openContact(created.id);
    else {
      const fresh = await api<{ contacts: Contact[] }>("/api/inbox");
      const hit = fresh.contacts.find((c) => c.phone.replace(/\D/g, "") === mock.phone.replace(/\D/g, ""));
      if (hit) await openContact(hit.id);
    }
  }

  async function approve(id: string) {
    await api(`/api/inbox/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ body: editBody[id] }),
    });
    setMsg("已批准并发送（DEMO 模式只写入本库，不连接 WhatsApp）。");
    await loadList();
    if (active) await openContact(active.id);
  }

  async function saveCrm() {
    if (!active) return;
    await api(`/api/contacts/${active.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: active.name,
        country: active.country,
        needs: active.needs,
        tier: active.tier,
        stage: active.stage,
        productNotes: active.productNotes,
      }),
    });
    setMsg("CRM 已更新");
    await loadList();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-emerald-950">WhatsApp 收件箱</h1>
      <DemoBanner extra="无凭证时为 MOCK。入站会自动已读、检索知识库并匹配产品，再生成待审草稿。" />

      <Card>
        <CardHeader>
          <CardTitle>注入一条 MOCK 询盘</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-3">
          <Input value={mock.phone} onChange={(e) => setMock({ ...mock, phone: e.target.value })} placeholder="手机号（含国家码）" />
          <Input value={mock.name} onChange={(e) => setMock({ ...mock, name: e.target.value })} placeholder="姓名" />
          <Textarea
            className="md:col-span-3"
            value={mock.text}
            onChange={(e) => setMock({ ...mock, text: e.target.value })}
          />
          <Button onClick={() => inject().catch((e) => setMsg(e.message))}>模拟入站并生成草稿</Button>
          {msg ? <p className="md:col-span-3 text-xs text-emerald-800">{msg}</p> : null}
        </CardContent>
      </Card>

      {pending.length ? (
        <Card>
          <CardHeader>
            <CardTitle>人工批准队列（{pending.length}）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.map((p) => (
              <div key={p.id} className="rounded-lg border border-stone-200 p-3">
                <p className="text-xs text-stone-500">
                  {p.contact.name || p.contact.phone} · {p.contact.country} · 置信度{" "}
                  {p.confidence != null ? `${(p.confidence * 100).toFixed(0)}%` : "—"}
                </p>
                <Textarea
                  className="mt-2"
                  value={editBody[p.id] ?? p.body}
                  onChange={(e) => setEditBody({ ...editBody, [p.id]: e.target.value })}
                />
                <Button className="mt-2" size="sm" onClick={() => approve(p.id)}>
                  批准发送
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>会话</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {contacts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openContact(c.id)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-left hover:bg-emerald-50"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.name || c.phone}</span>
                  <Badge tone="muted">{c.tier}</Badge>
                  <Badge>{c.country || "未知"}</Badge>
                </div>
                <p className="truncate text-xs text-stone-500">{c.needs}</p>
              </button>
            ))}
          </CardContent>
        </Card>
        <div className="space-y-3 lg:col-span-3">
          {active ? (
            <>
              <Card>
                <CardContent className="grid gap-2 pt-4 sm:grid-cols-2">
                  <div>
                    <Label>姓名</Label>
                    <Input value={active.name} onChange={(e) => setActive({ ...active, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>国家</Label>
                    <Input value={active.country} onChange={(e) => setActive({ ...active, country: e.target.value })} />
                  </div>
                  <div>
                    <Label>分层</Label>
                    <select
                      className="h-9 w-full rounded-md border px-2 text-sm"
                      value={active.tier}
                      onChange={(e) => setActive({ ...active, tier: e.target.value })}
                    >
                      {["A", "B", "C", "D"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>阶段</Label>
                    <select
                      className="h-9 w-full rounded-md border px-2 text-sm"
                      value={active.stage}
                      onChange={(e) => setActive({ ...active, stage: e.target.value })}
                    >
                      {Object.entries(STAGE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label>需求</Label>
                    <Input value={active.needs} onChange={(e) => setActive({ ...active, needs: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>意向产品</Label>
                    <Input
                      value={active.productNotes}
                      onChange={(e) => setActive({ ...active, productNotes: e.target.value })}
                    />
                  </div>
                  <Button onClick={() => saveCrm()}>保存 CRM</Button>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-3 pt-4">
                  {(active.conversations ?? []).map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        m.direction === "inbound"
                          ? "bg-white border border-stone-200"
                          : "bg-emerald-900 text-emerald-50"
                      }`}
                    >
                      <p className="text-[11px] opacity-70">
                        {m.direction === "inbound" ? "客户" : "FarmBoxer"} · {m.status}
                        {m.autoSent ? " · 自动发送" : ""}
                      </p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : (
            <p className="text-sm text-stone-500">选择左侧会话，或先注入 MOCK 询盘。</p>
          )}
        </div>
      </div>
    </div>
  );
}
