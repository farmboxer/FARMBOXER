export type InboxRow = {
  id: string;
  phone: string;
  name: string;
  country: string;
  countryCode: string;
  needs: string;
  tier: string;
  stage: string;
  productNotes: string;
  lastPreview: string;
  lastAt: string;
  unreadCount: number;
  pendingDraft: boolean;
  lastMessage: {
    id: string;
    body: string;
    direction: string;
    status: string;
    createdAt: string;
  } | null;
};

export type ChatMessage = {
  id: string;
  direction: string;
  body: string;
  status: string;
  draftReply: string;
  confidence: number | null;
  autoSent: boolean;
  createdAt: string;
  kbIdsJson?: string;
  matchSkuJson?: string;
};

export type ChatContact = {
  id: string;
  phone: string;
  name: string;
  country: string;
  countryCode: string;
  needs: string;
  tier: string;
  stage: string;
  productNotes: string;
  conversations: ChatMessage[];
};

export type ChatHints = {
  kbHits: Array<{ id: string; title: string; category: string; isSample: boolean; content: string }>;
  products: Array<{
    id: string;
    name: string;
    sku: string;
    listPrice: number;
    cost: number;
  }>;
};
