import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { startServer } from "../server.js";

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function sign(secret, raw) {
  return "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
}

async function listenMock(handler) {
  const server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    server,
    port,
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve())))
  };
}

const graphState = { mode: "ok" };

const mock = await listenMock((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/debug_token") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: { is_valid: graphState.mode === "ok", expires_at: 0 } }));
    return;
  }
  if (url.pathname.endsWith("/messages") && req.method === "POST") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ messages: [{ id: "wamid.test" }] }));
    return;
  }
  if (graphState.mode === "expired") {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({
      error: {
        message: "Error validating access token: Session has expired",
        type: "OAuthException",
        code: 190
      }
    }));
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({
    verified_name: "FarmBoxer Test",
    display_phone_number: "+1 555 000 1111",
    quality_rating: "GREEN"
  }));
});

const dataDir = await mkdtemp(path.join(tmpdir(), "wa-ops-"));
const configPath = path.join(dataDir, "config.local.json");
await mkdir(path.join(dataDir, "inbox-home"), { recursive: true });

const baseConfig = {
  port: 0,
  publicBaseUrl: "https://wa.chinagardentec.com",
  whatsapp: {
    graphApiVersion: "v21.0",
    appId: "111",
    appName: "FARMBOXER",
    phoneNumberId: "222",
    businessAccountId: "333",
    accessToken: "test-access-token",
    verifyToken: "verify-me",
    appSecret: "super-secret"
  }
};

await writeFile(configPath, JSON.stringify(baseConfig, null, 2));

const app = await startServer({
  configPath,
  dataDir,
  graphApiBase: mock.base,
  port: 0,
  host: "127.0.0.1"
});

const origin = `http://127.0.0.1:${app.port}`;

async function req(pathname, init = {}) {
  const response = await fetch(`${origin}${pathname}`, init);
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep text
  }
  return { response, body, text };
}

before(() => {
  graphState.mode = "ok";
});

after(async () => {
  await app.close();
  await mock.close();
});

test("sensitive static paths are not served", async () => {
  const paths = [
    "/config.local.json",
    "/config.production.json",
    "/server.js",
    "/package.json",
    "/package-lock.json",
    "/data/whatsapp-inbox.json",
    "/data/webhook-ops.json",
    "/node_modules/express/package.json",
    "/.env",
    "/.env.local",
    "/app.zip",
    "/deploy/nginx-whatsapp-webhook.conf"
  ];
  for (const pathname of paths) {
    const { response, text } = await req(pathname);
    assert.ok(response.status === 404 || response.status === 403, `${pathname} => ${response.status}`);
    assert.doesNotMatch(text, /test-access-token/);
    assert.doesNotMatch(text, /super-secret/);
  }
});

test("public UI assets still load", async () => {
  const index = await req("/");
  assert.equal(index.response.status, 200);
  assert.match(index.text, /WhatsApp AI/);
  const js = await req("/app.js");
  assert.equal(js.response.status, 200);
  const css = await req("/styles.css");
  assert.equal(css.response.status, 200);
});

test("path traversal cannot reach secrets", async () => {
  const { response, text } = await req("/styles.css/../../config.local.json");
  assert.ok(response.status === 404 || response.status === 403);
  assert.doesNotMatch(text, /test-access-token/);
});

test("webhook GET challenge succeeds and does not require signature", async () => {
  const { response, text } = await req(
    "/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc123"
  );
  assert.equal(response.status, 200);
  assert.equal(text, "abc123");
});

test("webhook GET rejects a mismatched verify token", async () => {
  const { response, body } = await req(
    "/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=nope"
  );
  assert.equal(response.status, 403);
  assert.equal(body.error, "Webhook verify token mismatch");
});

test("webhook POST accepts a signed Meta payload", async () => {
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              contacts: [{ wa_id: "966500000009", profile: { name: "Test Buyer" } }],
              messages: [
                {
                  id: "wamid.inbound-1",
                  from: "966500000009",
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "Need quotation" }
                }
              ]
            }
          }
        ]
      }
    ]
  };
  const raw = JSON.stringify(payload);
  const { response, body } = await req("/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": sign("super-secret", raw)
    },
    body: raw
  });
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.received, 1);
  const inbox = JSON.parse(await readFile(path.join(dataDir, "whatsapp-inbox.json"), "utf8"));
  assert.equal(inbox[0].id, "wamid.inbound-1");
});

test("webhook POST rejects a bad signature when appSecret is set", async () => {
  const raw = JSON.stringify({ entry: [] });
  const { response, body } = await req("/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": "sha256=deadbeef"
    },
    body: raw
  });
  assert.equal(response.status, 401);
  assert.equal(body.error, "Invalid webhook signature");
});

test("/api/status distinguishes fields-present from a live Graph token", async () => {
  graphState.mode = "ok";
  const ok = await req("/api/status");
  assert.equal(ok.response.status, 200);
  assert.equal(ok.body.configured, true);
  assert.equal(ok.body.tokenValid, true);
  assert.equal(ok.body.appSecretEnabled, true);
  assert.equal(ok.body.webhookUrl, "https://wa.chinagardentec.com/webhook");
  assert.equal(ok.body.accessToken, "已配置");
  assert.doesNotMatch(JSON.stringify(ok.body), /test-access-token/);
  assert.doesNotMatch(JSON.stringify(ok.body), /super-secret/);
  assert.ok(ok.body.receive.verifySuccessCount >= 1);
  assert.ok(ok.body.receive.inboundSuccessCount >= 1);
  assert.ok(ok.body.receive.lastInboundAt);
  assert.ok(ok.body.receive.lastVerifyAt);
  assert.ok(ok.body.receive.signatureFailCount >= 1);

  graphState.mode = "expired";
  const dead = await req("/api/status");
  assert.equal(dead.body.configured, true);
  assert.equal(dead.body.tokenValid, false);
  assert.match(String(dead.body.tokenError), /expired|190|OAuth|token/i);
  assert.equal(dead.body.tokenErrorCode, 190);
  graphState.mode = "ok";
});

test("nginx sample denies secret paths and does not use the app dir as root", async () => {
  const conf = await readFile(path.join(toolRoot, "deploy/nginx-whatsapp-webhook.conf"), "utf8");
  for (const needle of [
    "location = /config.local.json",
    "location ^~ /data/",
    "location = /server.js",
    "location = /package.json",
    "location = /package-lock.json",
    "location ^~ /node_modules/",
    "location ~ /\\.env",
    "deny all"
  ]) {
    assert.match(conf, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(conf, /proxy_pass/);
  assert.doesNotMatch(conf, /^\s*root\s+/m);
});
