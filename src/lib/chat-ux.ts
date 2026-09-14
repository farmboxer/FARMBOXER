export type ChatMessageLike = {
  id: string;
  direction: string;
  body: string;
  status: string;
  draftReply?: string;
  autoSent?: boolean;
  createdAt: string | Date;
};

export function contactInitials(name?: string, phone?: string): string {
  const trimmed = (name || "").trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return [...trimmed].slice(0, 2).join("").toUpperCase();
  }
  const digits = (phone || "").replace(/\D/g, "");
  return digits.slice(-2) || "?";
}

export function formatChatListTime(value: string | Date, now = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return "昨天";
  }
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export function formatBubbleTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function dateSeparatorLabel(value: string | Date, now = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return "今天";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return "昨天";
  }
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

export function dayKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function groupMessagesByDate<T extends ChatMessageLike>(
  messages: T[],
  now = new Date(),
): Array<{ key: string; label: string; items: T[] }> {
  const groups: Array<{ key: string; label: string; items: T[] }> = [];
  for (const item of messages) {
    const key = dayKey(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: dateSeparatorLabel(item.createdAt, now), items: [item] });
  }
  return groups;
}

export function messageStatusLabel(status: string, autoSent = false): string {
  if (status === "pending_approval") return "待批准";
  if (status === "failed") return "失败";
  if (status === "discarded") return "已丢弃";
  if (status === "delivered") return "已送达";
  if (status === "received") return "未读";
  if (status === "read") return "已读";
  if (status === "sent" && autoSent) return "自动发送";
  if (status === "sent") return "已发送";
  return status;
}

export function conversationPreview(last?: {
  direction?: string;
  body?: string;
  status?: string;
} | null): string {
  if (!last?.body) return "暂无消息";
  const prefix =
    last.status === "pending_approval" ? "草稿：" : last.direction === "outbound" ? "你：" : "";
  const compact = last.body.replace(/\s+/g, " ").trim();
  return `${prefix}${compact}`.slice(0, 80);
}

export function validateOutboundBody(body: string): string {
  const text = body.replace(/\r\n/g, "\n").trim();
  if (!text) throw new Error("回复内容为空");
  if (text.length > 4000) throw new Error("消息过长（最多 4000 字）");
  return text;
}
