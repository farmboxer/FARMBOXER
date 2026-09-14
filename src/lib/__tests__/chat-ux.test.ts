import { describe, expect, it } from "vitest";
import {
  contactInitials,
  conversationPreview,
  dateSeparatorLabel,
  groupMessagesByDate,
  messageStatusLabel,
  validateOutboundBody,
} from "@/lib/chat-ux";

describe("chat ux helpers", () => {
  it("builds initials from name or phone", () => {
    expect(contactInitials("Peter Mwangi", "254711")).toBe("PM");
    expect(contactInitials("", "254711000001")).toBe("01");
  });

  it("labels WhatsApp-like statuses in zh-CN", () => {
    expect(messageStatusLabel("pending_approval")).toBe("待批准");
    expect(messageStatusLabel("sent", true)).toBe("自动发送");
    expect(messageStatusLabel("sent", false)).toBe("已发送");
    expect(messageStatusLabel("failed")).toBe("失败");
  });

  it("previews pending drafts distinctly", () => {
    expect(conversationPreview({ direction: "outbound", body: "Hello", status: "pending_approval" })).toBe(
      "草稿：Hello",
    );
    expect(conversationPreview({ direction: "outbound", body: "报价见下", status: "sent" })).toBe("你：报价见下");
  });

  it("groups messages by calendar day", () => {
    const now = new Date("2026-09-14T18:00:00");
    const groups = groupMessagesByDate(
      [
        { id: "1", direction: "inbound", body: "a", status: "read", createdAt: "2026-09-13T10:00:00" },
        { id: "2", direction: "outbound", body: "b", status: "sent", createdAt: "2026-09-14T09:00:00" },
        { id: "3", direction: "inbound", body: "c", status: "read", createdAt: "2026-09-14T10:00:00" },
      ],
      now,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("昨天");
    expect(groups[1].label).toBe("今天");
    expect(groups[1].items).toHaveLength(2);
    expect(dateSeparatorLabel("2026-09-14T01:00:00", now)).toBe("今天");
  });

  it("rejects empty outbound bodies", () => {
    expect(() => validateOutboundBody("   ")).toThrow("回复内容为空");
    expect(validateOutboundBody("  可以  ")).toBe("可以");
  });
});
