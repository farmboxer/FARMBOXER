"use client";

import { STAGE_LABELS } from "@/lib/constants";
import { api } from "@/lib/client";
import {
  contactInitials,
  formatBubbleTime,
  formatChatListTime,
  groupMessagesByDate,
  messageStatusLabel,
} from "@/lib/chat-ux";
import { marginPercent } from "@/lib/margin";
import { cn, formatRmb } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  FlaskConical,
  MoreVertical,
  PanelRight,
  Search,
  SendHorizontal,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatContact, ChatHints, ChatMessage, InboxRow } from "./types";

type Filter = "all" | "pending" | "tierA";

const AVATAR = ["#00a884", "#02a698", "#027eb5", "#7d59b6", "#c4562d", "#1c8b4c"];

function avatarColor(key: string) {
  let n = 0;
  for (const ch of key) n = (n + ch.charCodeAt(0)) % AVATAR.length;
  return AVATAR[n];
}

export function WaWorkspace() {
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [thread, setThread] = useState<ChatContact | null>(null);
  const [hints, setHints] = useState<ChatHints>({ kbHits: [], products: [] });
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [composer, setComposer] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftDirty, setDraftDirty] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);
  const [mockOpen, setMockOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const [crm, setCrm] = useState({
    name: "",
    country: "",
    needs: "",
    tier: "D",
    stage: "new",
    productNotes: "",
  });
  const [mock, setMock] = useState({
    phone: "254711000001",
    name: "Peter Mwangi",
    text: "Do you have 9ZT-0.6 chaff cutter? Need 220V for dairy in Kenya.",
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const draftId = thread?.conversations.find((m) => m.status === "pending_approval")?.id ?? null;

  const loadList = useCallback(async () => {
    const data = await api<{ contacts: InboxRow[]; pendingCount: number }>("/api/inbox");
    setRows(data.contacts);
    setPendingCount(data.pendingCount);
    return data.contacts;
  }, []);

  const openThread = useCallback(async (id: string, opts?: { mobile?: boolean }) => {
    setActiveId(id);
    if (opts?.mobile) setMobileChat(true);
    const data = await api<{ contact: ChatContact; hints: ChatHints }>(`/api/inbox/${id}`);
    setThread(data.contact);
    setHints(data.hints);
    setCrm({
      name: data.contact.name,
      country: data.contact.country,
      needs: data.contact.needs,
      tier: data.contact.tier,
      stage: data.contact.stage,
      productNotes: data.contact.productNotes,
    });
    const pending = data.contact.conversations.find((m) => m.status === "pending_approval");
    setDraftText(pending?.draftReply || pending?.body || "");
    setDraftDirty(false);
    return data.contact;
  }, []);

  useEffect(() => {
    loadList().catch((e) => setToast(e.message));
  }, [loadList]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadList().catch(() => undefined);
      if (activeId) {
        api<{ contact: ChatContact; hints: ChatHints }>(`/api/inbox/${activeId}`)
          .then((data) => {
            setThread(data.contact);
            setHints(data.hints);
            const pending = data.contact.conversations.find((m) => m.status === "pending_approval");
            if (pending && !draftDirty) {
              setDraftText(pending.draftReply || pending.body);
            }
          })
          .catch(() => undefined);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [activeId, draftDirty, loadList]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.conversations.length, draftId]);

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (filter === "pending" && !row.pendingDraft) return false;
      if (filter === "tierA" && row.tier !== "A") return false;
      if (!query.trim()) return true;
      const hay = `${row.name} ${row.phone} ${row.country} ${row.lastPreview}`.toLowerCase();
      return hay.includes(query.trim().toLowerCase());
    });
  }, [rows, filter, query]);

  const groups = useMemo(() => {
    const msgs = (thread?.conversations ?? []).filter((m) => m.status !== "pending_approval");
    return groupMessagesByDate(msgs);
  }, [thread?.conversations]);
  const pendingDrafts = thread?.conversations.filter((m) => m.status === "pending_approval") ?? [];

  async function sendManual() {
    if (!activeId || !composer.trim()) return;
    setBusy("send");
    try {
      await api(`/api/inbox/${activeId}/send`, {
        method: "POST",
        body: JSON.stringify({ body: composer }),
      });
      setComposer("");
      await Promise.all([openThread(activeId), loadList()]);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "发送失败");
    } finally {
      setBusy("");
    }
  }

  async function approveDraft() {
    if (!draftId) return;
    setBusy("approve");
    try {
      await api(`/api/inbox/${draftId}/approve`, {
        method: "POST",
        body: JSON.stringify({ body: draftText }),
      });
      setDraftDirty(false);
      if (activeId) await Promise.all([openThread(activeId), loadList()]);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "批准失败");
    } finally {
      setBusy("");
    }
  }

  async function regenerate() {
    if (!activeId) return;
    setBusy("regen");
    try {
      await api(`/api/inbox/${activeId}/regenerate`, { method: "POST" });
      setDraftDirty(false);
      await Promise.all([openThread(activeId), loadList()]);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "生成失败");
    } finally {
      setBusy("");
    }
  }

  async function discard() {
    if (!draftId) return;
    setBusy("discard");
    try {
      await api(`/api/inbox/${draftId}/discard`, { method: "POST" });
      setDraftDirty(false);
      if (activeId) await Promise.all([openThread(activeId), loadList()]);
    } catch (e) {
      setToast(e instanceof Error ? e.message : "丢弃失败");
    } finally {
      setBusy("");
    }
  }

  async function injectMock() {
    setBusy("mock");
    try {
      const result = await api<{
        outbound: { contactId?: string };
        draft: { kbHits: Array<{ title: string }> };
      }>("/api/inbox/mock", { method: "POST", body: JSON.stringify(mock) });
      const list = await loadList();
      const phone = mock.phone.replace(/\D/g, "");
      const hit = list.find((r) => r.phone.replace(/\D/g, "") === phone);
      setMockOpen(false);
      setToast(`已入站。知识库命中：${result.draft.kbHits.map((h) => h.title).join("；") || "无"}`);
      if (hit) await openThread(hit.id, { mobile: true });
    } catch (e) {
      setToast(e instanceof Error ? e.message : "注入失败");
    } finally {
      setBusy("");
    }
  }

  async function saveCrm() {
    if (!activeId) return;
    setBusy("crm");
    try {
      await api(`/api/contacts/${activeId}`, { method: "PUT", body: JSON.stringify(crm) });
      await Promise.all([openThread(activeId), loadList()]);
      setToast("客户资料已保存");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex h-full min-h-0 bg-[#f0f2f5] text-stone-900">
      <aside
        className={cn(
          "flex w-full shrink-0 flex-col border-r border-[#d1d7db] bg-white md:w-[360px]",
          mobileChat ? "hidden md:flex" : "flex",
        )}
      >
        <div className="flex items-center justify-between bg-[#f0f2f5] px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-[#111b21]">聊天</p>
            <p className="text-[11px] text-[#667781]">收信与发信同一窗口 · DEMO 可注入</p>
          </div>
          <button
            type="button"
            onClick={() => setMockOpen(true)}
            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-950"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            演示
          </button>
        </div>
        <div className="bg-white px-3 py-2">
          <label className="flex items-center gap-2 rounded-lg bg-[#f0f2f5] px-3 py-1.5">
            <Search className="h-4 w-4 text-[#54656f]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索姓名或手机号"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[#667781]"
            />
          </label>
          <div className="mt-2 flex gap-1.5">
            {(
              [
                ["all", `全部`],
                ["pending", `待批准${pendingCount ? ` ${pendingCount}` : ""}`],
                ["tierA", "A类"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px]",
                  filter === key ? "bg-[#00a884] text-white" : "bg-[#f0f2f5] text-[#54656f]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleRows.map((row) => {
            const active = row.id === activeId;
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => openThread(row.id, { mobile: true }).catch((e) => setToast(e.message))}
                className={cn(
                  "flex w-full gap-3 border-b border-[#f0f2f5] px-3 py-3 text-left hover:bg-[#f5f6f6]",
                  active && "bg-[#f0f2f5]",
                )}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: avatarColor(row.name || row.phone) }}
                >
                  {contactInitials(row.name, row.phone)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-[#111b21]">
                      {row.name || row.phone}
                    </span>
                    <span className="shrink-0 text-[11px] text-[#667781]">
                      {formatChatListTime(row.lastAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span className="truncate text-[13px] text-[#667781]">{row.lastPreview}</span>
                    {row.pendingDraft ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" title="待批准草稿" />
                    ) : null}
                    {row.unreadCount > 0 ? (
                      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#00a884] px-1 text-[10px] font-semibold text-white">
                        {row.unreadCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {row.country ? (
                      <span className="rounded bg-[#e7fce3] px-1.5 text-[10px] text-[#027a48]">
                        {row.country}
                      </span>
                    ) : null}
                    <span className="rounded bg-[#e9edef] px-1.5 text-[10px] text-[#54656f]">
                      {row.tier}类
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
          {!visibleRows.length ? (
            <p className="px-4 py-8 text-center text-sm text-[#667781]">没有匹配的会话</p>
          ) : null}
        </div>
      </aside>

      <section
        className={cn(
          "min-w-0 flex-1 flex-col",
          mobileChat ? "flex" : "hidden md:flex",
        )}
      >
        {thread ? (
          <>
            <header className="flex items-center gap-3 bg-[#f0f2f5] px-3 py-2">
              <button
                type="button"
                className="rounded-full p-1 text-[#54656f] md:hidden"
                onClick={() => setMobileChat(false)}
                aria-label="返回会话列表"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ background: avatarColor(thread.name || thread.phone) }}
              >
                {contactInitials(thread.name, thread.phone)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#111b21]">
                  {thread.name || thread.phone}
                </p>
                <p className="truncate text-[11px] text-[#667781]">
                  {thread.phone}
                  {thread.country ? ` · ${thread.country}` : ""}
                  {` · ${thread.tier}类 · ${STAGE_LABELS[thread.stage] || thread.stage}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRightOpen((v) => !v)}
                className="rounded-full p-2 text-[#54656f] hover:bg-black/5"
                title="客户资料与匹配"
              >
                <PanelRight className="h-5 w-5" />
              </button>
              <MoreVertical className="hidden h-5 w-5 text-[#54656f] sm:block" />
            </header>

            <div className="wa-wallpaper min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-8">
              {groups.map((group) => (
                <div key={group.key}>
                  <div className="sticky top-1 z-10 mb-3 flex justify-center">
                    <span className="rounded-lg bg-[#e1f2fa] px-3 py-1 text-[11px] text-[#54656f] shadow-sm">
                      {group.label}
                    </span>
                  </div>
                  {group.items.map((msg) => (
                    <Bubble key={msg.id} msg={msg} />
                  ))}
                </div>
              ))}
              {pendingDrafts.map((msg) => (
                <DraftBubble
                  key={msg.id}
                  msg={msg}
                  value={draftText}
                  busy={busy}
                  onChange={(v) => {
                    setDraftText(v);
                    setDraftDirty(true);
                  }}
                  onApprove={() => approveDraft()}
                  onRegen={() => regenerate()}
                  onDiscard={() => discard()}
                />
              ))}
              <div ref={bottomRef} />
            </div>

            <form
              className="flex items-end gap-2 bg-[#f0f2f5] px-3 py-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendManual();
              }}
            >
              <textarea
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendManual();
                  }
                }}
                rows={1}
                placeholder="输入消息"
                className="max-h-32 min-h-10 flex-1 resize-none rounded-lg bg-white px-3 py-2.5 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={!composer.trim() || busy === "send"}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-white disabled:opacity-40"
                aria-label="发送"
              >
                <SendHorizontal className="h-5 w-5" />
              </button>
            </form>
          </>
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center bg-[#f0f2f5] text-center md:flex">
            <div className="max-w-sm px-6">
              <p className="text-2xl font-light text-[#41525d]">FarmBoxer 聊天</p>
              <p className="mt-2 text-sm leading-relaxed text-[#667781]">
                选择左侧会话，在同一窗口阅读客户来信、编辑 AI 草稿并发送回复。布局对齐 WhatsApp
                Web。
              </p>
            </div>
          </div>
        )}
      </section>

      {thread && rightOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 bg-black/30 xl:hidden"
            aria-label="关闭资料"
            onClick={() => setRightOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-40 flex w-[300px] flex-col overflow-y-auto border-l border-[#d1d7db] bg-white shadow-xl xl:static xl:z-0 xl:shadow-none">
            <CrmPane crm={crm} setCrm={setCrm} hints={hints} onSave={saveCrm} onClose={() => setRightOpen(false)} />
          </aside>
        </>
      ) : null}

      {mockOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold">演示：注入一条入站</p>
              <button type="button" onClick={() => setMockOpen(false)} aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-[#667781]">
              DEMO 模式不会连 WhatsApp。注入后会出现在左侧列表，并在同一聊天窗生成待批准草稿。
            </p>
            <div className="space-y-2">
              <input
                className="h-9 w-full rounded border px-3 text-sm"
                value={mock.phone}
                onChange={(e) => setMock({ ...mock, phone: e.target.value })}
                placeholder="手机号（含国家码）"
              />
              <input
                className="h-9 w-full rounded border px-3 text-sm"
                value={mock.name}
                onChange={(e) => setMock({ ...mock, name: e.target.value })}
                placeholder="姓名"
              />
              <textarea
                className="min-h-24 w-full rounded border px-3 py-2 text-sm"
                value={mock.text}
                onChange={(e) => setMock({ ...mock, text: e.target.value })}
              />
              <button
                type="button"
                onClick={() => injectMock()}
                className="w-full rounded-lg bg-[#00a884] py-2 text-sm text-white"
              >
                {busy === "mock" ? "注入中…" : "模拟客户来信"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <button
          type="button"
          onClick={() => setToast("")}
          className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[#111b21] px-4 py-2 text-xs text-white shadow"
        >
          {toast}
        </button>
      ) : null}
    </div>
  );
}

function Bubble({ msg }: { msg: ChatMessage }) {
  const inbound = msg.direction === "inbound";
  return (
    <div className={cn("mb-1.5 flex", inbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[min(78%,36rem)] px-2.5 pb-1.5 pt-1.5 text-[14.5px] leading-relaxed shadow-sm",
          inbound
            ? "wa-bubble-in bg-white text-[#111b21] shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
            : "wa-bubble-out bg-[#d9fdd3] text-[#111b21] shadow-[0_1px_1px_rgba(0,0,0,0.06)]",
        )}
      >
        <p className="whitespace-pre-wrap">{msg.body}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#667781]">
          <span>{formatBubbleTime(msg.createdAt)}</span>
          <span>{messageStatusLabel(msg.status, msg.autoSent)}</span>
          {!inbound ? (
            msg.status === "failed" ? (
              <span className="text-red-600">!</span>
            ) : msg.status === "sent" || msg.status === "delivered" ? (
              <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )
          ) : null}
        </p>
      </div>
    </div>
  );
}

function DraftBubble({
  msg,
  value,
  busy,
  onChange,
  onApprove,
  onRegen,
  onDiscard,
}: {
  msg: ChatMessage;
  value: string;
  busy: string;
  onChange: (v: string) => void;
  onApprove: () => void;
  onRegen: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="mb-2 flex justify-end">
      <div className="w-full max-w-[min(92%,40rem)] rounded-xl border border-orange-300 bg-[#fff6d8] p-2.5 shadow-sm">
        <p className="mb-1 text-[11px] font-medium text-orange-900">
          AI 待批准草稿
          {msg.confidence != null ? ` · 置信度 ${(msg.confidence * 100).toFixed(0)}%` : ""}
          · 守住毛利底线
        </p>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          className="w-full rounded-lg border border-orange-200 bg-white px-2.5 py-2 text-sm outline-none"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={busy === "approve"}
            className="rounded-lg bg-[#00a884] px-3 py-1.5 text-xs text-white"
          >
            批准发送
          </button>
          <button
            type="button"
            onClick={onRegen}
            disabled={busy === "regen"}
            className="rounded-lg bg-white px-3 py-1.5 text-xs text-[#111b21] ring-1 ring-[#d1d7db]"
          >
            重新生成
          </button>
          <button
            type="button"
            onClick={onDiscard}
            disabled={busy === "discard"}
            className="rounded-lg px-3 py-1.5 text-xs text-red-700"
          >
            丢弃
          </button>
        </div>
      </div>
    </div>
  );
}

function CrmPane({
  crm,
  setCrm,
  hints,
  onSave,
  onClose,
}: {
  crm: { name: string; country: string; needs: string; tier: string; stage: string; productNotes: string };
  setCrm: (c: {
    name: string;
    country: string;
    needs: string;
    tier: string;
    stage: string;
    productNotes: string;
  }) => void;
  hints: ChatHints;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between border-b border-[#f0f2f5] px-4 py-3">
        <div>
          <p className="text-sm font-semibold">客户资料</p>
          <p className="text-[11px] text-[#667781]">不挡住聊天，改完点保存</p>
        </div>
        <button type="button" className="xl:hidden" onClick={onClose} aria-label="关闭">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2 p-4 text-sm">
        <Field label="姓名" value={crm.name} onChange={(v) => setCrm({ ...crm, name: v })} />
        <Field label="国家" value={crm.country} onChange={(v) => setCrm({ ...crm, country: v })} />
        <label className="block text-xs text-[#667781]">
          分层
          <select
            className="mt-1 h-9 w-full rounded border border-[#d1d7db] px-2"
            value={crm.tier}
            onChange={(e) => setCrm({ ...crm, tier: e.target.value })}
          >
            {["A", "B", "C", "D"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[#667781]">
          阶段
          <select
            className="mt-1 h-9 w-full rounded border border-[#d1d7db] px-2"
            value={crm.stage}
            onChange={(e) => setCrm({ ...crm, stage: e.target.value })}
          >
            {Object.entries(STAGE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <Field label="需求" value={crm.needs} onChange={(v) => setCrm({ ...crm, needs: v })} />
        <Field
          label="意向产品"
          value={crm.productNotes}
          onChange={(v) => setCrm({ ...crm, productNotes: v })}
        />
        <button type="button" onClick={onSave} className="w-full rounded-lg bg-[#00a884] py-2 text-sm text-white">
          保存资料
        </button>
      </div>
      <div className="border-t border-[#f0f2f5] px-4 py-3">
        <p className="text-sm font-semibold">本轮匹配</p>
        <div className="mt-2 space-y-2 text-xs">
          {hints.kbHits.map((hit) => (
            <div key={hit.id} className="rounded-lg bg-[#f0f2f5] p-2">
              <p className="font-medium">
                {hit.category} · {hit.title}
                {hit.isSample ? "（样本）" : ""}
              </p>
            </div>
          ))}
          {hints.products.map((p) => (
            <div key={p.id} className="rounded-lg bg-[#e7fce3] p-2">
              <p className="font-medium">
                {p.name} ({p.sku})
              </p>
              <p className="text-[#667781]">
                {formatRmb(p.listPrice)} · 毛利 {marginPercent(p.listPrice, p.cost).toFixed(1)}%
              </p>
            </div>
          ))}
          {!hints.kbHits.length && !hints.products.length ? (
            <p className="text-[#667781]">暂无知识库/产品命中</p>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs text-[#667781]">
      {label}
      <input
        className="mt-1 h-9 w-full rounded border border-[#d1d7db] px-2 text-sm text-[#111b21]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
