const seed = {
  messages: [
    {
      id: crypto.randomUUID(),
      customer: "Ahmed Trading",
      country: "Saudi Arabia",
      phone: "966500000001",
      text: "We need 200 sets, can you recommend a stable model for hot climate? Please send best price, warranty and delivery time.",
      status: "待审核",
      createdAt: new Date().toISOString()
    },
    {
      id: crypto.randomUUID(),
      customer: "Lagos Build Co.",
      country: "Nigeria",
      phone: "2348000000002",
      text: "Customer asks if your product can use cheaper configuration. Target price is 15% lower than your quotation.",
      status: "待审核",
      createdAt: new Date().toISOString()
    }
  ],
  knowledge: [
    {
      title: "价格底线原则",
      tags: "价格, 利润",
      body: "任何报价必须先核对成本和最低价，目标毛利不低于15%。若客户压价，优先调整配置、数量、交期或付款条件，不直接突破最低价。"
    },
    {
      title: "高温市场配置建议",
      tags: "中东, 配置, 售后",
      body: "中东及高温地区优先推荐高温稳定配置，强调寿命、质保、备件和总拥有成本，不能只比较裸机价格。"
    }
  ],
  products: [
    {
      name: "Alpha Pro 300",
      category: "标准主推款",
      specs: "高温稳定配置 / 工业级核心件 / 2年质保",
      price: 1280,
      floor: 1160,
      cost: 980
    },
    {
      name: "Alpha Lite 200",
      category: "价格竞争款",
      specs: "基础配置 / 快速交付 / 1年质保",
      price: 960,
      floor: 875,
      cost: 760
    }
  ],
  markets: [
    {
      country: "Saudi Arabia",
      demand: "重视耐高温、稳定性、质保和交付确定性",
      price: "竞品区间 USD 1100-1450",
      competitor: "本地代理 + 土耳其品牌",
      note: "建议用 Alpha Pro 300 做价值销售，突出寿命和售后。"
    },
    {
      country: "Nigeria",
      demand: "预算敏感，常要求降低配置",
      price: "竞品区间 USD 820-1050",
      competitor: "印度低价品牌",
      note: "用 Alpha Lite 200 抢单，同时设置付款和备件条件。"
    }
  ],
  selectedId: null
};

let state = loadState();
const canUseBackend = location.protocol === "http:" || location.protocol === "https:";
const apiBase = canUseBackend ? location.origin : "";

async function api(path, options = {}) {
  if (!canUseBackend) throw new Error("请通过本地服务地址打开工具，而不是直接打开文件。");
  const response = await fetch(`${apiBase}${path}`, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `请求失败：${response.status}`);
  return data;
}

function loadState() {
  const saved = localStorage.getItem("wa-ai-sales-state");
  return saved ? JSON.parse(saved) : structuredClone(seed);
}

function saveState() {
  localStorage.setItem("wa-ai-sales-state", JSON.stringify(state));
}

function money(n) {
  return Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function scoreMessage(message) {
  const text = message.text.toLowerCase();
  let score = 35;
  if (/\d+/.test(text)) score += 18;
  if (text.includes("price") || text.includes("quotation") || text.includes("best price")) score += 14;
  if (text.includes("warranty") || text.includes("delivery") || text.includes("stable")) score += 12;
  if (text.includes("target price") || text.includes("cheaper")) score -= 8;
  return Math.max(10, Math.min(96, score));
}

function gradeFromScore(score) {
  if (score >= 72) return "A 高意向";
  if (score >= 52) return "B 可培育";
  return "C 低优先";
}

function findMarket(country) {
  return state.markets.find(item => item.country.toLowerCase() === country.toLowerCase()) || state.markets[0];
}

function bestProduct(message) {
  const market = findMarket(message.country);
  const priceSensitive = /cheaper|lower|target price|budget/i.test(message.text);
  const product = priceSensitive
    ? state.products.reduce((a, b) => Number(a.price) < Number(b.price) ? a : b)
    : state.products.reduce((a, b) => Number(a.price) > Number(b.price) ? a : b);
  return { product, market };
}

function buildReply(message) {
  const { product, market } = bestProduct(message);
  const margin = ((product.price - product.cost) / product.price * 100).toFixed(1);
  return `您好，感谢您的需求。根据您所在市场（${message.country}）的使用环境和客户关注点，我们建议优先考虑 ${product.name}。\n\n推荐理由：${product.specs}。当地市场情况显示：${market.demand}，价格参考为 ${market.price}，主要竞品是 ${market.competitor}。\n\n报价建议：标准报价 USD ${money(product.price)}，我们的内部最低控制价为 USD ${money(product.floor)}。为了保证公司利润率不低于15%，如果客户需要更低价格，建议通过调整配置、订单数量、付款条件或交期来优化，而不是直接突破底价。\n\n下一步建议：请确认预计采购数量、目标交期、使用场景和必须配置，我们可以在24小时内给出正式方案、质保条款和交付计划。`;
}

function buildSolution(message) {
  const { product, market } = bestProduct(message);
  const score = scoreMessage(message);
  const margin = ((product.price - product.cost) / product.price * 100).toFixed(1);
  return `
    <strong>推荐产品：</strong>${product.name}<br>
    <strong>配置：</strong>${product.specs}<br>
    <strong>报价 / 底价 / 成本：</strong>USD ${money(product.price)} / ${money(product.floor)} / ${money(product.cost)}<br>
    <strong>预计毛利率：</strong>${margin}%<br>
    <strong>客户等级：</strong>${gradeFromScore(score)}（${score}分）<br>
    <strong>市场策略：</strong>${market.note}
  `;
}

function renderMessages() {
  const list = document.querySelector("#messageList");
  list.innerHTML = state.messages.map(message => {
    const score = scoreMessage(message);
    const tagClass = score >= 72 ? "hot" : score < 45 ? "risk" : "warn";
    return `
      <article class="message-card ${state.selectedId === message.id ? "active" : ""}" data-id="${message.id}">
        <div class="meta-row">
          <span class="customer-name">${message.customer}</span>
          <span class="tag ${tagClass}">${gradeFromScore(score)}</span>
        </div>
        <div class="muted">${message.country} · ${message.phone || "无号码"} · ${message.status}</div>
        <p class="message-text">${message.text}</p>
      </article>
    `;
  }).join("");
  document.querySelector("#reviewCount").textContent = state.messages.filter(m => m.status === "待审核").length;
  document.querySelector("#hotLeadCount").textContent = state.messages.filter(m => scoreMessage(m) >= 72).length;
}

function renderSelected() {
  const selected = state.messages.find(item => item.id === state.selectedId) || state.messages[0];
  if (!selected) return;
  state.selectedId = selected.id;
  document.querySelector("#selectedContext").innerHTML = `
    <strong>${selected.customer}</strong><br>
    来源国家：${selected.country}<br>
    WhatsApp：${selected.phone || "未记录号码"}<br>
    原始问题：${selected.text}
  `;
  document.querySelector("#draftReply").value = buildReply(selected);
  document.querySelector("#solutionBox").innerHTML = buildSolution(selected);
  document.querySelector("#confidenceTag").textContent = `建议置信度 ${scoreMessage(selected)}%`;
  const { market, product } = bestProduct(selected);
  document.querySelector("#intelContent").innerHTML = `
    <strong>当地市场：</strong>${market.country}<br>
    <strong>需求偏好：</strong>${market.demand}<br>
    <strong>价格与竞品：</strong>${market.price}；${market.competitor}<br>
    <strong>匹配产品：</strong>${product.name}<br>
    <strong>经营提醒：</strong>低于 USD ${money(product.floor)} 需要老板审批；优先保证 15%+ 利润率。
  `;
  saveState();
}

function renderKnowledge() {
  document.querySelector("#knowledgeList").innerHTML = state.knowledge.map((item, index) => `
    <article class="record-card">
      <div class="meta-row"><strong>${item.title}</strong><span class="tag">${item.tags}</span></div>
      <p>${item.body}</p>
      <button class="ghost" data-delete-kb="${index}"><span data-lucide="trash-2"></span>删除</button>
    </article>
  `).join("");
}

function renderProducts() {
  document.querySelector("#productList").innerHTML = state.products.map((item, index) => {
    const margin = ((item.price - item.cost) / item.price * 100).toFixed(1);
    const cls = margin >= 15 ? "hot" : "risk";
    return `
      <article class="record-card">
        <div class="meta-row"><strong>${item.name}</strong><span class="tag ${cls}">毛利 ${margin}%</span></div>
        <p>${item.category} · ${item.specs}</p>
        <p>报价 USD ${money(item.price)} / 底价 USD ${money(item.floor)} / 成本 USD ${money(item.cost)}</p>
        <button class="ghost" data-delete-product="${index}"><span data-lucide="trash-2"></span>删除</button>
      </article>
    `;
  }).join("");
}

function renderMarkets() {
  document.querySelector("#marketList").innerHTML = state.markets.map((item, index) => `
    <article class="record-card">
      <div class="meta-row"><strong>${item.country}</strong><span class="tag warn">${item.price}</span></div>
      <p>${item.demand}</p>
      <p>竞品：${item.competitor}</p>
      <p>${item.note}</p>
      <button class="ghost" data-delete-market="${index}"><span data-lucide="trash-2"></span>删除</button>
    </article>
  `).join("");
}

function renderCustomers() {
  const grouped = state.messages.reduce((acc, msg) => {
    const score = scoreMessage(msg);
    const grade = gradeFromScore(score);
    acc[grade] = acc[grade] || [];
    acc[grade].push({ ...msg, score });
    return acc;
  }, {});
  document.querySelector("#customerBoard").innerHTML = ["A 高意向", "B 可培育", "C 低优先"].map(grade => `
    <section class="record-card">
      <strong>${grade}</strong>
      ${(grouped[grade] || []).map(item => `
        <div class="customer-card">
          <div class="meta-row"><span>${item.customer}</span><span class="tag">${item.score}分</span></div>
          <p>${item.country} · ${item.text}</p>
        </div>
      `).join("") || "<p>暂无客户</p>"}
    </section>
  `).join("");
}

function generateReport() {
  const hot = state.messages.filter(m => scoreMessage(m) >= 72);
  const riskProducts = state.products.filter(p => ((p.price - p.cost) / p.price * 100) < 0.15);
  const countries = [...new Set(state.messages.map(m => m.country))];
  document.querySelector("#reportContent").innerHTML = `
    <div class="report-block"><strong>客户信息总结：</strong><br>过去3天共跟进 ${state.messages.length} 条客户消息，高意向客户 ${hot.length} 个。重点国家：${countries.join("、")}。优先处理有明确数量、价格、交期和质保问题的客户。</div>
    <div class="report-block"><strong>产品价格与利润：</strong><br>产品库共 ${state.products.length} 个产品。${riskProducts.length ? `以下产品低于15%目标毛利，需要调整报价或成本：${riskProducts.map(p => p.name).join("、")}。` : "当前样例产品报价均满足15%+毛利要求。"}</div>
    <div class="report-block"><strong>竞品与市场：</strong><br>已记录 ${state.markets.length} 个市场。每天应按 WhatsApp 来源国家补充当地价格、配置偏好、渠道、竞品品牌、付款习惯和售后要求。</div>
    <div class="report-block"><strong>批评与建议：</strong><br>从0.15亿到10亿，不能靠被动报价。必须建立国家级市场打法、主推产品矩阵、底价纪律、客户分级跟进节奏和复盘机制。建议每周选择2个重点国家做深度突破，每月淘汰低毛利低复购客户。</div>
    <div class="report-block"><strong>下一个具体动作：</strong><br>1. 给A类客户当天回复正式方案；2. 给B类客户安排二次追问；3. 对每个新增国家补充竞品价格；4. 将重复问题沉淀为标准话术；5. 低于15%毛利的订单必须审批。</div>
  `;
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseBulkKnowledge(input) {
  const text = input.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.map((item, index) => ({
      title: item.title || item.name || `导入知识 ${index + 1}`,
      tags: item.tags || item.category || "批量导入",
      body: item.body || item.content || item.specs || JSON.stringify(item, null, 2)
    }));
  } catch {}

  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length > 1 && /title|name|标题|产品|category|tags|body|content/i.test(lines[0])) {
    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
    return lines.slice(1).map((line, index) => {
      const cells = parseCsvLine(line);
      const get = (...keys) => {
        const key = keys.find(k => headers.includes(k));
        return key ? cells[headers.indexOf(key)] : "";
      };
      return {
        title: get("title", "name", "标题", "产品") || `导入知识 ${index + 1}`,
        tags: get("tags", "category", "标签", "品类") || "CSV导入",
        body: get("body", "content", "内容", "说明", "specs") || line
      };
    });
  }

  const chunks = text.split(/\n(?=#\s+|##\s+|产品[:：]|标题[:：])/).map(chunk => chunk.trim()).filter(Boolean);
  return chunks.map((chunk, index) => {
    const titleMatch = chunk.match(/^(?:#{1,3}\s*|产品[:：]|标题[:：])(.+)$/m);
    const tagMatch = chunk.match(/标签[:：]\s*(.+)/);
    return {
      title: titleMatch ? titleMatch[1].trim() : `导入知识 ${index + 1}`,
      tags: tagMatch ? tagMatch[1].trim() : "自由文本导入",
      body: chunk
    };
  });
}

function parseBulkProducts(input) {
  const knowledgeRows = parseBulkKnowledge(input);
  return knowledgeRows.map(row => {
    const body = row.body;
    const pickNumber = (...names) => {
      for (const name of names) {
        const match = body.match(new RegExp(`${name}[:：]?\\s*(?:USD|usd|￥|¥)?\\s*([0-9]+(?:\\.[0-9]+)?)`, "i"));
        if (match) return Number(match[1]);
      }
      return 0;
    };
    const specsMatch = body.match(/(?:参数|配置|specs?)[:：]\s*(.+)/i);
    return {
      name: row.title,
      category: row.tags,
      specs: specsMatch ? specsMatch[1].trim() : body.slice(0, 140),
      price: pickNumber("报价", "价格", "price"),
      floor: pickNumber("底价", "最低价", "floor"),
      cost: pickNumber("成本", "cost")
    };
  });
}

function renderAll() {
  renderMessages();
  renderSelected();
  renderKnowledge();
  renderProducts();
  renderMarkets();
  renderCustomers();
  generateReport();
  if (window.lucide) window.lucide.createIcons();
}

async function syncWhatsAppMessages() {
  try {
    const messages = await api("/api/messages");
    const knownIds = new Set(state.messages.map(item => item.id));
    const fresh = messages.filter(item => !knownIds.has(item.id));
    state.messages = [...fresh, ...state.messages];
    if (fresh[0]) state.selectedId = fresh[0].id;
    saveState();
    renderAll();
    return fresh.length;
  } catch (error) {
    alert(error.message);
    return 0;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatTime(value) {
  return value ? escapeHtml(value) : "尚无记录";
}

async function checkConnection() {
  try {
    const status = await api("/api/status");
    const tokenValid = Boolean(status.tokenValid);
    const statusEl = document.querySelector("#connectionStatus");
    if (!status.configured) {
      statusEl.textContent = "未完成配置（Phone Number ID / Token / Verify Token 仍有空项）";
      statusEl.className = "status-bad";
    } else if (!tokenValid) {
      statusEl.textContent = `字段已填写，但 Graph Token 无效：${status.tokenError || "未知错误"}`;
      statusEl.className = "status-bad";
    } else {
      statusEl.textContent = "已配置，Graph Token 有效，可以接收 Webhook 并发送消息";
      statusEl.className = "status-ok";
    }
    const receive = status.receive || {};
    document.querySelector("#webhookHelp").innerHTML = `
      Webhook URL：<strong>${escapeHtml(status.webhookUrl)}</strong><br>
      Graph API：${escapeHtml(status.graphApiVersion)}<br>
      App：${escapeHtml(status.appName)}（${escapeHtml(status.appId)}）<br>
      Phone Number ID：${escapeHtml(status.phoneNumberId)}<br>
      Access Token 字段：${escapeHtml(status.accessToken)}<br>
      Verify Token 字段：${escapeHtml(status.verifyToken)}<br>
      Graph Token：${tokenValid ? "有效" : "无效"} ${status.tokenError ? `（${escapeHtml(status.tokenError)}）` : ""}<br>
      Token 过期：${escapeHtml(status.tokenExpiresAt || "未知")}<br>
      App Secret：${escapeHtml(status.appSecretEnabled ? "已启用签名校验（生产应开启）" : status.appSecret || "未启用签名校验")}
    `;
    document.querySelector("#receiveDiagnostics").innerHTML = `
      <strong>接收诊断</strong><br>
      最近 Webhook 校验：${formatTime(receive.lastVerifyAt)}（${escapeHtml(receive.lastVerifyResult || "无")}）<br>
      校验成功 / 失败：${escapeHtml(receive.verifySuccessCount ?? 0)} / ${escapeHtml(receive.verifyFailCount ?? 0)}<br>
      最近入站消息：${formatTime(receive.lastInboundAt)}（本批 ${escapeHtml(receive.lastInboundReceived ?? 0)} 条）<br>
      入站成功 / 失败：${escapeHtml(receive.inboundSuccessCount ?? 0)} / ${escapeHtml(receive.inboundFailCount ?? 0)}<br>
      签名失败：${escapeHtml(receive.signatureFailCount ?? 0)}（最近 ${formatTime(receive.lastSignatureFailureAt)}）<br>
      最近错误：${escapeHtml(receive.lastError || "无")}
    `;
  } catch (error) {
    document.querySelector("#connectionStatus").textContent = "后端服务未启动";
    document.querySelector("#connectionStatus").className = "status-bad";
    document.querySelector("#webhookHelp").textContent = error.message;
    document.querySelector("#receiveDiagnostics").textContent = "无法读取接收诊断。";
  }
  if (window.lucide) window.lucide.createIcons();
}

document.addEventListener("click", event => {
  const nav = event.target.closest(".nav-item");
  if (nav) {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach(item => item.classList.remove("active"));
    nav.classList.add("active");
    document.querySelector(`#${nav.dataset.view}`).classList.add("active");
  }

  const card = event.target.closest(".message-card");
  if (card) {
    state.selectedId = card.dataset.id;
    renderAll();
  }

  const kbDelete = event.target.closest("[data-delete-kb]");
  if (kbDelete) {
    state.knowledge.splice(Number(kbDelete.dataset.deleteKb), 1);
    saveState();
    renderAll();
  }
  const productDelete = event.target.closest("[data-delete-product]");
  if (productDelete) {
    state.products.splice(Number(productDelete.dataset.deleteProduct), 1);
    saveState();
    renderAll();
  }
  const marketDelete = event.target.closest("[data-delete-market]");
  if (marketDelete) {
    state.markets.splice(Number(marketDelete.dataset.deleteMarket), 1);
    saveState();
    renderAll();
  }
});

document.querySelector("#addMessage").addEventListener("click", () => {
  const raw = document.querySelector("#rawMessage").value.trim();
  if (!raw) return;
  const countryMatch = raw.match(/country[:：]\s*([^,，\n]+)/i);
  const phoneMatch = raw.match(/(?:phone|whatsapp|wa)[:：]\s*(\+?\d[\d\s-]{6,})/i);
  state.messages.unshift({
    id: crypto.randomUUID(),
    customer: `新客户 ${state.messages.length + 1}`,
    country: countryMatch ? countryMatch[1].trim() : "Unknown Market",
    phone: phoneMatch ? phoneMatch[1].replace(/[^\d]/g, "") : "",
    text: raw,
    status: "待审核",
    createdAt: new Date().toISOString()
  });
  document.querySelector("#rawMessage").value = "";
  state.selectedId = state.messages[0].id;
  saveState();
  renderAll();
});

document.querySelector("#addDemoMessage").addEventListener("click", () => {
  document.querySelector("#rawMessage").value = "Country: Brazil, customer wants 500 units for distributor channel. They ask for competitor comparison, local price, best configuration and payment terms.";
});

document.querySelector("#approveReply").addEventListener("click", () => {
  const selected = state.messages.find(item => item.id === state.selectedId);
  if (selected) selected.status = "已审核";
  saveState();
  renderAll();
});

document.querySelector("#markSent").addEventListener("click", () => {
  const selected = state.messages.find(item => item.id === state.selectedId);
  if (selected) selected.status = "已发送";
  saveState();
  renderAll();
});

document.querySelector("#sendWhatsApp").addEventListener("click", async () => {
  const selected = state.messages.find(item => item.id === state.selectedId);
  if (!selected) return;
  if (!selected.phone) {
    alert("这个客户没有 WhatsApp 号码。Webhook 收到的真实客户会自动带号码；手工粘贴消息请先补充号码。");
    return;
  }
  try {
    await api("/api/send-message", {
      method: "POST",
      body: JSON.stringify({ to: selected.phone, text: document.querySelector("#draftReply").value })
    });
    selected.status = "已发送";
    saveState();
    renderAll();
    alert("已通过 WhatsApp Cloud API 发送。");
  } catch (error) {
    alert(`发送失败：${error.message}`);
  }
});

document.querySelector("#saveKnowledge").addEventListener("click", () => {
  const selected = state.messages.find(item => item.id === state.selectedId);
  state.knowledge.unshift({
    title: `${selected?.country || "客户"} 问答沉淀`,
    tags: "客户问题, WhatsApp",
    body: document.querySelector("#draftReply").value
  });
  saveState();
  renderAll();
});

document.querySelector("#scheduleResearch").addEventListener("click", () => {
  const selected = state.messages.find(item => item.id === state.selectedId);
  if (!selected) return;
  state.markets.unshift({
    country: selected.country,
    demand: "待补充：从今日 WhatsApp 来源客户问题中整理配置偏好",
    price: "待调研：当地主流成交价和竞品报价",
    competitor: "待调研：本地代理、低价品牌、主要进口商",
    note: "今日任务：收集当地价格、竞品参数、渠道结构和售后要求。"
  });
  saveState();
  renderAll();
});

document.querySelector("#addKnowledge").addEventListener("click", () => {
  const title = document.querySelector("#kbTitle").value.trim();
  const body = document.querySelector("#kbBody").value.trim();
  if (!title || !body) return;
  state.knowledge.unshift({
    title,
    tags: document.querySelector("#kbTags").value.trim() || "未分类",
    body
  });
  ["#kbTitle", "#kbTags", "#kbBody"].forEach(id => document.querySelector(id).value = "");
  saveState();
  renderAll();
});

document.querySelector("#importKnowledge").addEventListener("click", () => {
  const input = document.querySelector("#bulkKnowledge");
  const rows = parseBulkKnowledge(input.value);
  if (!rows.length) return;
  state.knowledge = [...rows, ...state.knowledge];
  input.value = "";
  saveState();
  renderAll();
  alert(`已导入 ${rows.length} 条知识。`);
});

document.querySelector("#importProducts").addEventListener("click", () => {
  const input = document.querySelector("#bulkKnowledge");
  const rows = parseBulkProducts(input.value);
  if (!rows.length) return;
  state.products = [...rows, ...state.products];
  input.value = "";
  saveState();
  renderAll();
  alert(`已导入 ${rows.length} 个产品。`);
});

document.querySelector("#addProduct").addEventListener("click", () => {
  const name = document.querySelector("#productName").value.trim();
  if (!name) return;
  state.products.unshift({
    name,
    category: document.querySelector("#productCategory").value.trim() || "未分类",
    specs: document.querySelector("#productSpecs").value.trim() || "待补充",
    price: Number(document.querySelector("#productPrice").value || 0),
    floor: Number(document.querySelector("#productFloor").value || 0),
    cost: Number(document.querySelector("#productCost").value || 0)
  });
  ["#productName", "#productCategory", "#productSpecs", "#productPrice", "#productFloor", "#productCost"].forEach(id => document.querySelector(id).value = "");
  saveState();
  renderAll();
});

document.querySelector("#addMarket").addEventListener("click", () => {
  const country = document.querySelector("#marketCountry").value.trim();
  if (!country) return;
  state.markets.unshift({
    country,
    demand: document.querySelector("#marketDemand").value.trim() || "待补充",
    price: document.querySelector("#marketPrice").value.trim() || "待补充",
    competitor: document.querySelector("#marketCompetitor").value.trim() || "待补充",
    note: document.querySelector("#marketNote").value.trim() || "待补充"
  });
  ["#marketCountry", "#marketDemand", "#marketPrice", "#marketCompetitor", "#marketNote"].forEach(id => document.querySelector(id).value = "");
  saveState();
  renderAll();
});

document.querySelector("#regradeCustomers").addEventListener("click", renderCustomers);
document.querySelector("#generateReport").addEventListener("click", generateReport);
document.querySelector("#syncWhatsApp").addEventListener("click", async () => {
  const count = await syncWhatsAppMessages();
  alert(`已同步 ${count} 条 WhatsApp 新消息。`);
});
document.querySelector("#checkConnection").addEventListener("click", checkConnection);

document.querySelector("#exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "whatsapp-ai-sales-data.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#importData").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  state = JSON.parse(await file.text());
  saveState();
  renderAll();
});

renderAll();
checkConnection();
