import http from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const defaultConfig = {
  port: 8789,
  publicBaseUrl: "http://127.0.0.1:8789",
  whatsapp: {
    graphApiVersion: "v21.0",
    appId: "",
    appName: "",
    phoneNumberId: "",
    businessAccountId: "",
    accessToken: "",
    verifyToken: "",
    appSecret: ""
  }
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const STATIC_ALLOWLIST = new Set(["/index.html", "/styles.css", "/app.js", "/favicon.ico"]);

const emptyOps = () => ({
  verifySuccessCount: 0,
  verifyFailCount: 0,
  inboundSuccessCount: 0,
  inboundFailCount: 0,
  signatureFailCount: 0,
  lastVerifyAt: null,
  lastVerifyResult: null,
  lastInboundAt: null,
  lastInboundReceived: 0,
  lastSignatureFailureAt: null,
  lastError: null
});

function resolveOptions(overrides = {}) {
  return {
    configPath: overrides.configPath || process.env.WA_CONFIG_PATH || path.join(__dirname, "config.local.json"),
    dataDir: overrides.dataDir || process.env.WA_DATA_DIR || path.join(__dirname, "data"),
    graphApiBase: (overrides.graphApiBase || process.env.GRAPH_API_BASE || "https://graph.facebook.com").replace(/\/$/, ""),
    fetchImpl: overrides.fetchImpl || fetch,
    host: overrides.host || process.env.HOST || undefined,
    port: overrides.port ?? (process.env.PORT ? Number(process.env.PORT) : undefined),
    listen: overrides.listen !== false,
    config: overrides.config
  };
}

async function loadConfig(configPath, override) {
  if (override) {
    return {
      ...defaultConfig,
      ...override,
      whatsapp: { ...defaultConfig.whatsapp, ...(override.whatsapp || {}) }
    };
  }
  if (!existsSync(configPath)) return defaultConfig;
  const local = JSON.parse((await readFile(configPath, "utf8")).replace(/^\uFEFF/, ""));
  return {
    ...defaultConfig,
    ...local,
    whatsapp: { ...defaultConfig.whatsapp, ...(local.whatsapp || {}) }
  };
}

function json(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-hub-signature-256"
  });
  res.end(JSON.stringify(body, null, 2));
}

async function readJsonFile(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJsonFile(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifyMetaSignature(rawBody, header, appSecret) {
  if (!appSecret) return true;
  if (!header?.startsWith("sha256=")) return false;
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(header));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isBlockedStaticPath(relPath) {
  const rel = relPath.replace(/\\/g, "/").toLowerCase();
  if (rel.includes("\0")) return true;
  if (rel === "/config.example.json") return false;
  if (
    rel === "/server.js" ||
    rel === "/package.json" ||
    rel === "/package-lock.json" ||
    rel.startsWith("/data/") ||
    rel === "/data" ||
    rel.startsWith("/node_modules/") ||
    rel === "/node_modules" ||
    rel.startsWith("/.env") ||
    rel.includes("/.env") ||
    /(^|\/)config(\.[^/]+)?\.json$/.test(rel) ||
    /\.(zip|tar|gz|tgz|7z)$/.test(rel) ||
    rel.startsWith("/deploy/") ||
    rel === "/deploy"
  ) {
    return true;
  }
  return false;
}

function normalizeWebhookMessages(payload) {
  const records = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const contacts = value.contacts || [];
      for (const message of value.messages || []) {
        const contact = contacts.find(item => item.wa_id === message.from) || contacts[0] || {};
        const text =
          message.text?.body ||
          message.button?.text ||
          message.interactive?.button_reply?.title ||
          message.interactive?.list_reply?.title ||
          `[${message.type || "unknown"} message]`;
        records.push({
          id: message.id,
          customer: contact.profile?.name || message.from || "WhatsApp 客户",
          phone: message.from || "",
          country: inferCountryFromPhone(message.from || ""),
          text,
          status: "待审核",
          source: "WhatsApp Cloud API",
          createdAt: new Date(Number(message.timestamp || Date.now() / 1000) * 1000).toISOString(),
          rawType: message.type || "unknown"
        });
      }
    }
  }
  return records;
}

function inferCountryFromPhone(phone) {
  const rules = [
    ["966", "Saudi Arabia"],
    ["234", "Nigeria"],
    ["52", "Mexico"],
    ["55", "Brazil"],
    ["971", "United Arab Emirates"],
    ["91", "India"],
    ["62", "Indonesia"],
    ["84", "Vietnam"],
    ["86", "China"]
  ];
  const hit = rules.find(([prefix]) => phone.startsWith(prefix));
  return hit ? hit[1] : "Unknown Market";
}

function configuredFields(wa) {
  return Boolean(wa.phoneNumberId && wa.accessToken && wa.verifyToken);
}

function publicStatusFields(config, graph, ops) {
  const wa = config.whatsapp;
  return {
    configured: configuredFields(wa),
    tokenValid: Boolean(graph.tokenValid),
    tokenError: graph.tokenError || null,
    tokenErrorCode: graph.tokenErrorCode ?? null,
    tokenExpiresAt: graph.tokenExpiresAt || null,
    tokenCheckedAt: graph.tokenCheckedAt || null,
    verifiedName: graph.verifiedName || null,
    displayPhoneConfigured: Boolean(graph.displayPhoneConfigured),
    webhookUrl: `${String(config.publicBaseUrl || "").replace(/\/$/, "")}/webhook`,
    graphApiVersion: wa.graphApiVersion,
    appId: wa.appId ? "已配置" : "未配置",
    appName: wa.appName || "未配置",
    phoneNumberId: wa.phoneNumberId ? "已配置" : "未配置",
    accessToken: wa.accessToken ? "已配置" : "未配置",
    verifyToken: wa.verifyToken ? "已配置" : "未配置",
    appSecretEnabled: Boolean(wa.appSecret),
    appSecret: wa.appSecret ? "已启用签名校验" : "未启用签名校验",
    receive: ops
  };
}

async function inspectGraphToken(config, { graphApiBase, fetchImpl }) {
  const wa = config.whatsapp;
  const tokenCheckedAt = new Date().toISOString();
  if (!wa.accessToken || !wa.phoneNumberId) {
    return {
      tokenValid: false,
      tokenError: "Phone Number ID 或 Access Token 未配置",
      tokenErrorCode: null,
      tokenExpiresAt: null,
      tokenCheckedAt,
      verifiedName: null,
      displayPhoneConfigured: false
    };
  }

  let tokenExpiresAt = null;
  if (wa.appId && wa.appSecret) {
    try {
      const debugUrl =
        `${graphApiBase}/debug_token` +
        `?input_token=${encodeURIComponent(wa.accessToken)}` +
        `&access_token=${encodeURIComponent(`${wa.appId}|${wa.appSecret}`)}`;
      const debugRes = await fetchImpl(debugUrl);
      const debugJson = await debugRes.json().catch(() => ({}));
      const data = debugJson.data || {};
      if (typeof data.expires_at === "number") {
        tokenExpiresAt = data.expires_at === 0 ? "never" : new Date(data.expires_at * 1000).toISOString();
      }
    } catch {
      // Phone-number check remains the source of truth.
    }
  }

  try {
    const fields = "verified_name,display_phone_number,quality_rating";
    const phoneUrl = `${graphApiBase}/${wa.graphApiVersion}/${encodeURIComponent(wa.phoneNumberId)}?fields=${fields}`;
    const phoneRes = await fetchImpl(phoneUrl, {
      headers: { authorization: `Bearer ${wa.accessToken}` }
    });
    const phoneJson = await phoneRes.json().catch(() => ({}));
    if (!phoneRes.ok) {
      return {
        tokenValid: false,
        tokenError: phoneJson.error?.message || `Graph API ${phoneRes.status}`,
        tokenErrorCode: phoneJson.error?.code ?? phoneRes.status,
        tokenExpiresAt,
        tokenCheckedAt,
        verifiedName: null,
        displayPhoneConfigured: false
      };
    }
    return {
      tokenValid: true,
      tokenError: null,
      tokenErrorCode: null,
      tokenExpiresAt,
      tokenCheckedAt,
      verifiedName: phoneJson.verified_name || null,
      displayPhoneConfigured: Boolean(phoneJson.display_phone_number)
    };
  } catch (error) {
    return {
      tokenValid: false,
      tokenError: error.message || "Graph API 请求失败",
      tokenErrorCode: null,
      tokenExpiresAt,
      tokenCheckedAt,
      verifiedName: null,
      displayPhoneConfigured: false
    };
  }
}

export async function startServer(overrides = {}) {
  const options = resolveOptions(overrides);
  const inboxPath = path.join(options.dataDir, "whatsapp-inbox.json");
  const outboxPath = path.join(options.dataDir, "whatsapp-outbox.json");
  const opsPath = path.join(options.dataDir, "webhook-ops.json");

  async function loadOps() {
    const stored = await readJsonFile(opsPath, {});
    return { ...emptyOps(), ...stored };
  }

  async function saveOps(patch) {
    const next = { ...(await loadOps()), ...patch };
    await writeJsonFile(opsPath, next);
    return next;
  }

  async function appendInbox(messages) {
    const existing = await readJsonFile(inboxPath, []);
    const knownIds = new Set(existing.map(item => item.id));
    const merged = [...messages.filter(item => !knownIds.has(item.id)), ...existing];
    await writeJsonFile(inboxPath, merged);
    return merged;
  }

  async function sendWhatsAppText(config, to, body) {
    const { graphApiVersion, phoneNumberId, accessToken } = config.whatsapp;
    if (!phoneNumberId || !accessToken) {
      throw new Error("WhatsApp Cloud API is not configured.");
    }
    const url = `${options.graphApiBase}/${graphApiVersion}/${phoneNumberId}/messages`;
    const response = await options.fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body }
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error?.message || `WhatsApp API request failed with ${response.status}`);
    }
    const outbox = await readJsonFile(outboxPath, []);
    outbox.unshift({ to, body, result, sentAt: new Date().toISOString() });
    await writeJsonFile(outboxPath, outbox);
    return result;
  }

  async function serveStatic(req, res) {
    const url = new URL(req.url, "http://localhost");
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    } catch {
      return json(res, 400, { error: "Bad path" });
    }
    if (pathname.includes("\0")) return json(res, 400, { error: "Bad path" });

    const root = path.resolve(__dirname);
    const filePath = path.normalize(path.join(root, pathname));
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      return json(res, 403, { error: "Forbidden" });
    }

    const rel = "/" + path.relative(root, filePath).split(path.sep).join("/");
    if (isBlockedStaticPath(rel) || !STATIC_ALLOWLIST.has(rel)) {
      return json(res, 404, { error: "Not found" });
    }

    try {
      const info = await stat(filePath);
      if (!info.isFile()) return json(res, 404, { error: "Not found" });
      res.writeHead(200, { "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
      createReadStream(filePath).pipe(res);
    } catch {
      json(res, 404, { error: "Not found" });
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const config = await loadConfig(options.configPath, options.config);
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

      if (req.method === "OPTIONS") return json(res, 200, { ok: true });

      if (url.pathname === "/webhook" && req.method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode === "subscribe" && token && token === config.whatsapp.verifyToken) {
          await saveOps({
            lastVerifyAt: new Date().toISOString(),
            lastVerifyResult: "ok",
            verifySuccessCount: (await loadOps()).verifySuccessCount + 1
          });
          res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
          return res.end(challenge || "");
        }
        const ops = await loadOps();
        await saveOps({
          lastVerifyAt: new Date().toISOString(),
          lastVerifyResult: "mismatch",
          verifyFailCount: ops.verifyFailCount + 1,
          lastError: "Webhook verify token mismatch"
        });
        return json(res, 403, { error: "Webhook verify token mismatch" });
      }

      if (url.pathname === "/webhook" && req.method === "POST") {
        const rawBody = await readBody(req);
        const okSignature = verifyMetaSignature(rawBody, req.headers["x-hub-signature-256"], config.whatsapp.appSecret);
        if (!okSignature) {
          const ops = await loadOps();
          await saveOps({
            lastSignatureFailureAt: new Date().toISOString(),
            signatureFailCount: ops.signatureFailCount + 1,
            inboundFailCount: ops.inboundFailCount + 1,
            lastError: "Invalid webhook signature"
          });
          return json(res, 401, { error: "Invalid webhook signature" });
        }
        let payload;
        try {
          payload = JSON.parse(rawBody.toString("utf8") || "{}");
        } catch {
          const ops = await loadOps();
          await saveOps({
            inboundFailCount: ops.inboundFailCount + 1,
            lastError: "Invalid webhook JSON"
          });
          return json(res, 400, { error: "Invalid webhook JSON" });
        }
        const messages = normalizeWebhookMessages(payload);
        await appendInbox(messages);
        const ops = await loadOps();
        await saveOps({
          inboundSuccessCount: ops.inboundSuccessCount + 1,
          lastInboundAt: new Date().toISOString(),
          lastInboundReceived: messages.length,
          lastError: null
        });
        return json(res, 200, { ok: true, received: messages.length });
      }

      if (url.pathname === "/api/status" && req.method === "GET") {
        const [graph, ops] = await Promise.all([
          inspectGraphToken(config, options),
          loadOps()
        ]);
        return json(res, 200, publicStatusFields(config, graph, ops));
      }

      if (url.pathname === "/api/messages" && req.method === "GET") {
        return json(res, 200, await readJsonFile(inboxPath, []));
      }

      if (url.pathname === "/api/send-message" && req.method === "POST") {
        const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
        if (!body.to || !body.text) return json(res, 400, { error: "Missing to or text" });
        const result = await sendWhatsAppText(config, body.to, body.text);
        return json(res, 200, { ok: true, result });
      }

      return serveStatic(req, res);
    } catch (error) {
      if (!res.headersSent) {
        return json(res, 500, { error: error.message || "Internal server error" });
      }
    }
  });

  const config = await loadConfig(options.configPath, options.config);
  const port = options.port ?? config.port;
  if (options.listen) {
    await new Promise((resolve, reject) => {
      const onError = error => reject(error);
      server.once("error", onError);
      server.listen(port, options.host, () => {
        server.off("error", onError);
        resolve();
      });
    });
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`WhatsApp AI Sales Tool running at http://127.0.0.1:${actualPort}`);
    console.log(`Webhook endpoint: ${String(config.publicBaseUrl || "").replace(/\/$/, "")}/webhook`);
  }

  return {
    server,
    config,
    dataDir: options.dataDir,
    port: typeof server.address() === "object" && server.address() ? server.address().port : port,
    close() {
      return new Promise((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
      });
    }
  };
}

export { verifyMetaSignature, isBlockedStaticPath, normalizeWebhookMessages, publicStatusFields };

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  await startServer();
}
