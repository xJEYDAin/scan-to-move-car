/**
 * 扫码挪车 - Cloudflare Workers
 *
 * 部署步骤：
 *   cd cloudflare
 *   wrangler kv:namespace create "SCAN_KV"
 *   # 将返回的 id 填入 wrangler.toml 的 [[kv_namespaces]] id 字段
 *   wrangler secret put BARK_BASE_URL   # 可选，默认 api.day.app
 *   wrangler deploy
 */

// ─────────────────────────────────────────────
// 常量
// ─────────────────────────────────────────────
const MAX_PER_DAY = 20;
const NO_LOCATION_DELAY_MS = 30_000; // 30 秒延迟防骚扰
const SOUNDS = {
  critical:  { sound: "alarm",       icon: "🔴" },
  high:      { sound: "anticipate",  icon: "🟡" },
  warning:   { sound: "static",      icon: "🟢" },
  low:       { sound: "static",      icon: "⚪" },
  default:   { sound: "static",      icon: "🔔" },
};
const SCENARIO_DEFAULT_URGENCY = {
  "小区":        "low",
  "商场":        "low",
  "路边":        "high",
  "停车场出口":  "critical",
  "地下车库":    "low",
  "医院/学校":   "critical",
  "景区":        "low",
  "加油站":      "high",
  "其他":        "low",
};

// ─────────────────────────────────────────────
// Bark 推送
// ─────────────────────────────────────────────
async function pushBark(barkKey, title, body, urgency = "default", barkBaseUrl = "https://api.day.app") {
  const { sound } = SOUNDS[urgency] || SOUNDS["default"];
  let baseUrl = barkBaseUrl;
  let deviceKey = barkKey;

  if (barkKey && barkKey.startsWith("http")) {
    try {
      const u = new URL(barkKey);
      baseUrl = u.origin;
      deviceKey = u.pathname.replace(/^\//, "");
    } catch { /* ignore */ }
  }

  const url = `${baseUrl}/${deviceKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}?sound=${sound}&group=${encodeURIComponent("挪车提醒")}`;
  try {
    const resp = await fetch(url, { method: "GET", cf: { cacheTtl: 0 } });
    if (resp.ok) {
      try {
        const data = await resp.json();
        return data.code === 200;
      } catch {
        return true;
      }
    }
  } catch (_) {}
  return false;
}

// ─────────────────────────────────────────────
// KV 存储封装
// ─────────────────────────────────────────────
class KVStore {
  constructor(kv) { this.kv = kv; }

  async getOwner(token) {
    const raw = await this.kv.get("owner:" + token);
    return raw ? JSON.parse(raw) : null;
  }
  async setOwner(token, owner) {
    await this.kv.put("owner:" + token, JSON.stringify(owner));
  }
  async getOwnerByBarkKey(barkKey) {
    const token = await this.kv.get("owner_bark:" + barkKey);
    return token ? this.getOwner(token) : null;
  }
  async setOwnerBarkKey(barkKey, token) {
    await this.kv.put("owner_bark:" + barkKey, token);
  }
  async getOwnerByPlate(plate) {
    const token = await this.kv.get("owner_plate:" + plate);
    return token ? this.getOwner(token) : null;
  }
  async setOwnerPlate(plate, token) {
    await this.kv.put("owner_plate:" + plate, token);
  }

  async getScan(scanId) {
    const raw = await this.kv.get("scan:" + scanId);
    return raw ? JSON.parse(raw) : null;
  }
  async setScan(scanId, data) {
    await this.kv.put("scan:" + scanId, JSON.stringify(data));
  }

  async getNotification(id) {
    const raw = await this.kv.get("notif:" + id);
    return raw ? JSON.parse(raw) : null;
  }
  async setNotification(id, data) {
    await this.kv.put("notif:" + id, JSON.stringify(data));
  }
  async getNotificationByKey(confirmedKey) {
    const id = await this.kv.get("notif_key:" + confirmedKey);
    return id ? this.getNotification(id) : null;
  }
  async setNotificationKey(confirmedKey, id) {
    await this.kv.put("notif_key:" + confirmedKey, String(id), { expirationTtl: 7 * 86400 });
  }

  async getDailyCount(token) {
    const today = new Date().toISOString().slice(0, 10);
    const val = await this.kv.get("rate:" + token + ":" + today);
    return val ? parseInt(val) : 0;
  }
  async incrDailyCount(token) {
    const today = new Date().toISOString().slice(0, 10);
    const key = "rate:" + token + ":" + today;
    const val = await this.kv.get(key);
    const cnt = val ? parseInt(val) + 1 : 1;
    await this.kv.put(key, String(cnt));
    return cnt;
  }

  async appendHistory(token, notif) {
    const key = "hist:" + token;
    const raw = await this.kv.get(key);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(notif);
    if (list.length > 50) list.splice(50);
    await this.kv.put(key, JSON.stringify(list));
  }
  async getHistory(token) {
    const raw = await this.kv.get("hist:" + token);
    return raw ? JSON.parse(raw) : [];
  }

  async nextNotifId() {
    const val = await this.kv.get("counter:notif");
    const next = val ? parseInt(val) + 1 : 1;
    await this.kv.put("counter:notif", String(next));
    return next;
  }
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────
function genToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz0123456789";
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join("");
}

function genScanId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz0123456789";
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join("");
}

function genConfirmedKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz0123456789";
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join("");
}

async function readBody(request) {
  const text = await request.text();
  try { return JSON.parse(text); } catch { return {}; }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ─────────────────────────────────────────────
// 主路由
// ─────────────────────────────────────────────
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS 预检
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // 首页 → 静态文件
  if (path === "/" || path === "") {
    return Response.redirect("https://scan-to-move-car.rolojyssill.pages.dev/index.html", 302);
  }

  // favicon
  if (path === "/favicon.ico") {
    return new Response(null, { status: 204 });
  }

  // 短链接 /s/c?k=xxx
  if (path === "/s/c") {
    const k = url.searchParams.get("k");
    if (!k) return json({ detail: "无效链接" }, 400);
    return Response.redirect("https://scan-to-move-car.rolojyssill.pages.dev/confirm.html?key=" + encodeURIComponent(k), 302);
  }

  // API 路由
  if (path === "/api/register" && request.method === "POST") {
    return handleRegister(request, env);
  }
  if (path === "/api/notify" && request.method === "POST") {
    return handleNotify(request, env);
  }
  if (path.startsWith("/api/status/") && request.method === "GET") {
    const id = parseInt(path.split("/")[3]);
    return handleStatus(id, env);
  }
  if (path.startsWith("/api/status/key/") && request.method === "GET") {
    const key = path.split("/")[3];
    return handleStatusByKey(key, env);
  }
  if (path.startsWith("/api/confirm/") && request.method === "POST") {
    const key = path.split("/")[3];
    return handleConfirm(key, env);
  }
  if (path.startsWith("/api/reject/") && request.method === "POST") {
    const key = path.split("/")[3];
    return handleReject(key, env);
  }
  if (path === "/api/confirm.html" && request.method === "GET") {
    return handleConfirmPage(url, env);
  }
  if (path.startsWith("/api/history/") && request.method === "GET") {
    const token = path.split("/")[3];
    return handleHistory(token, env);
  }
  if (path.startsWith("/api/scan/") && request.method === "GET") {
    const scanId = path.split("/")[3];
    return handleScan(scanId, env);
  }
  if (path.startsWith("/api/qr/") && request.method === "GET") {
    const token = path.split("/")[3];
    return handleQr(token, env);
  }

  return json({ detail: "Not Found" }, 404);
}

// ─────────────────────────────────────────────
// POST /api/register
// ─────────────────────────────────────────────
async function handleRegister(request, env) {
  const body = await readBody(request);
  const { name, bark_key, license_plates = [] } = body;

  if (!name || !bark_key) {
    return json({ detail: "name, bark_key required" }, 400);
  }
  if (!license_plates || license_plates.length === 0) {
    return json({ detail: "license_plates required（请至少填写一个车牌号）" }, 400);
  }

  const store = new KVStore(env.SCAN_KV);

  const existing = await store.getOwnerByBarkKey(bark_key);
  if (existing) {
    return json({ detail: "该 Bark Key 已注册，请使用原有 Token" }, 400);
  }
  for (const plate of license_plates) {
    const owner = await store.getOwnerByPlate(plate);
    if (owner) {
      return json({ detail: `车牌 ${plate} 已注册，请使用原有 Token` }, 400);
    }
  }

  const token = genToken();
  const scanId = genScanId();
  const now = new Date().toISOString();

  const owner = { token, name, bark_key, license_plates, created_at: now };
  await store.setOwner(token, owner);
  await store.setOwnerBarkKey(bark_key, token);
  for (const plate of license_plates) {
    await store.setOwnerPlate(plate, token);
  }

  const scan = { scan_id: scanId, owner_token: token, active: true, created_at: now };
  await store.setScan(scanId, scan);

  return json({ token, name, scan_id: scanId, message: "注册成功" });
}

// ─────────────────────────────────────────────
// POST /api/notify
// ─────────────────────────────────────────────
async function handleNotify(request, env) {
  const body = await readBody(request);
  const {
    token, scenario, message = "", urgency,
    user_lat = 0, user_lon = 0, car_plate = "",
    pending_id, // 延迟流程二次调用
  } = body;

  if (!token || !scenario) {
    return json({ detail: "token, scenario required" }, 400);
  }

  const store = new KVStore(env.SCAN_KV);
  const barkBaseUrl = env.BARK_BASE_URL || "https://api.day.app";

  // ── 延迟流程二次调用 ──
  if (pending_id) {
    const notif = await store.getNotification(parseInt(pending_id));
    if (!notif) return json({ detail: "通知不存在" }, 404);
    if (notif.status !== "waiting_confirmation") {
      return json({ success: true, status: notif.status, message: "已处理" });
    }

    const owner = await store.getOwner(token);
    if (!owner) return json({ detail: "车主不存在" }, 404);

    const urgencyLevel = urgency || SCENARIO_DEFAULT_URGENCY[scenario] || "default";
    const plateInfo = car_plate ? `被挡:${car_plate}\n` : "";
    const title = `🔔 ${scenario}`;
    const text = `${plateInfo}请确认是否能够挪车`;
    const ok = await pushBark(owner.bark_key, title, text, urgencyLevel, barkBaseUrl);

    await store.setNotification(notif.id, {
      ...notif,
      status: ok ? "pending" : "failed",
      success: ok,
      submitted_at: notif.submitted_at || new Date().toISOString(),
      requester_lat: parseFloat(user_lat) || 0,
      requester_lon: parseFloat(user_lon) || 0,
      car_plate,
    });

    if (ok) await store.incrDailyCount(token);
    await store.appendHistory(token, {
      id: notif.id, scenario, message,
      pushed_at: new Date().toISOString(),
      success: ok ? 1 : 0,
      status: ok ? "pending" : "failed",
    });

    return json({
      success: ok,
      pending_id: String(notif.id),
      message: ok ? "推送成功" : "推送失败，请稍后重试",
    });
  }

  // ── 普通流程 ──
  const owner = await store.getOwner(token);
  if (!owner) return json({ detail: "车主不存在" }, 404);

  const todayCnt = await store.getDailyCount(token);
  if (todayCnt >= MAX_PER_DAY) {
    return json({ detail: `今日推送次数已达上限（${MAX_PER_DAY}次），请明天再试` }, 429);
  }

  const urgencyLevel = urgency || SCENARIO_DEFAULT_URGENCY[scenario] || "default";
  const userLat = parseFloat(user_lat) || 0;
  const userLon = parseFloat(user_lon) || 0;
  const now = new Date();

  // ── 无位置：延迟 30 秒 ──
  if (!userLat || !userLon) {
    const confirmedKey = genConfirmedKey();
    const nid = await store.nextNotifId();
    const waitUntil = new Date(now.getTime() + NO_LOCATION_DELAY_MS).toISOString();

    const notif = {
      id: nid, token, scenario, message,
      status: "waiting_confirmation",
      confirmed_key: confirmedKey,
      submitted_at: now.toISOString(),
      wait_until: waitUntil,
      requester_lat: 0, requester_lon: 0,
      car_plate, success: false,
    };
    await store.setNotification(nid, notif);
    await store.setNotificationKey(confirmedKey, nid);

    return json({
      success: true,
      pending_id: String(nid),
      can_send_at: waitUntil,
      message: "提交成功，需等待 30 秒后才能发送通知（防止恶意骚扰）",
    });
  }

  // ── 有位置：立即推送 ──
  const confirmedKey = genConfirmedKey();
  const nid = await store.nextNotifId();
  const plateInfo = car_plate ? `被挡:${car_plate}\n` : "";
  const title = `🔔 ${scenario}`;
  const text = `${plateInfo}请确认是否能够挪车`;
  const ok = await pushBark(owner.bark_key, title, text, urgencyLevel, barkBaseUrl);

  const notif = {
    id: nid, token, scenario, message,
    status: ok ? "pending" : "failed",
    confirmed_key: confirmedKey,
    submitted_at: now.toISOString(),
    wait_until: null,
    requester_lat: userLat,
    requester_lon: userLon,
    car_plate,
    success: ok,
  };
  await store.setNotification(nid, notif);
  await store.setNotificationKey(confirmedKey, nid);

  if (ok) await store.incrDailyCount(token);
  await store.appendHistory(token, {
    id: nid, scenario, message,
    pushed_at: now.toISOString(),
    success: ok ? 1 : 0,
    status: ok ? "pending" : "failed",
  });

  return json({
    success: ok,
    pending_id: String(nid),
    message: ok ? "推送成功" : "推送失败，请稍后重试",
  });
}

// ─────────────────────────────────────────────
// GET /api/status/{id}
// ─────────────────────────────────────────────
async function handleStatus(id, env) {
  const store = new KVStore(env.SCAN_KV);
  const barkBaseUrl = env.BARK_BASE_URL || "https://api.day.app";

  const notif = await store.getNotification(id);
  if (!notif) return json({ detail: "通知不存在" }, 404);

  // 无位置延迟流程
  if (notif.status === "waiting_confirmation" && notif.wait_until) {
    const now = Date.now();
    const waitMs = new Date(notif.wait_until).getTime();
    if (now >= waitMs) {
      // 到时间，触发 Bark
      const owner = await store.getOwner(notif.token);
      if (owner) {
        const urgencyLevel = SCENARIO_DEFAULT_URGENCY[notif.scenario] || "default";
        const plateInfo = notif.car_plate ? `被挡:${notif.car_plate}\n` : "";
        const title = `🔔 ${notif.scenario}`;
        const text = `${plateInfo}请确认是否能够挪车`;
        const ok = await pushBark(owner.bark_key, title, text, urgencyLevel, barkBaseUrl);

        await store.setNotification(id, {
          ...notif,
          status: ok ? "pending" : "failed",
          success: ok,
          submitted_at: notif.submitted_at || new Date().toISOString(),
        });

        if (ok) await store.incrDailyCount(notif.token);
        await store.appendHistory(notif.token, {
          id, scenario: notif.scenario, message: notif.message,
          pushed_at: new Date().toISOString(),
          success: ok ? 1 : 0,
          status: ok ? "pending" : "failed",
        });
      }
    } else {
      const remaining = Math.ceil((waitMs - now) / 1000);
      return json({
        status: "waiting_confirmation",
        scenario: notif.scenario,
        message: notif.message,
        submitted_at: notif.submitted_at || "",
        car_plate: notif.car_plate || "",
        can_send_at: notif.wait_until,
        remaining_seconds: remaining,
      });
    }
  }

  return json({
    status: notif.status,
    scenario: notif.scenario,
    message: notif.message,
    submitted_at: notif.submitted_at || "",
    car_plate: notif.car_plate || "",
    requester_lat: notif.requester_lat || 0,
    requester_lon: notif.requester_lon || 0,
  });
}

// ─────────────────────────────────────────────
// GET /api/status/key/{key}
// ─────────────────────────────────────────────
async function handleStatusByKey(key, env) {
  const store = new KVStore(env.SCAN_KV);
  const notif = await store.getNotificationByKey(key);
  if (!notif) return json({ status: "not_found" });
  return json({
    status: notif.status,
    scenario: notif.scenario || "",
    message: notif.message || "",
    submitted_at: notif.submitted_at || "",
    car_plate: notif.car_plate || "",
  });
}

// ─────────────────────────────────────────────
// POST /api/confirm/{key}
// ─────────────────────────────────────────────
async function handleConfirm(key, env) {
  const store = new KVStore(env.SCAN_KV);
  const barkBaseUrl = env.BARK_BASE_URL || "https://api.day.app";

  const notif = await store.getNotificationByKey(key);
  if (!notif) return json({ detail: "确认链接无效或已过期" }, 404);
  if (notif.status === "confirmed" || notif.status === "rejected") {
    return json({ ok: true, message: "已经处理过了" });
  }

  await store.setNotification(notif.id, {
    ...notif,
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
  });

  // 二次推送告知扫码者
  const owner = await store.getOwner(notif.token);
  if (owner && owner.bark_key) {
    const locStr = (notif.requester_lat && notif.requester_lon)
      ? `\n\n📍 被挡者位置：https://maps.apple.com/?q=&ll=${notif.requester_lat},${notif.requester_lon}`
      : "";
    await pushBark(
      owner.bark_key,
      "✅ 车主已确认挪车",
      `车主(${owner.name || "某车主"})已确认会尽快挪车，请稍候。${locStr}`,
      "low",
      barkBaseUrl
    );
  }

  return json({ ok: true, message: "确认成功" });
}

// ─────────────────────────────────────────────
// POST /api/reject/{key}
// ─────────────────────────────────────────────
async function handleReject(key, env) {
  const store = new KVStore(env.SCAN_KV);

  const notif = await store.getNotificationByKey(key);
  if (!notif) return json({ detail: "确认链接无效或已过期" }, 404);
  if (notif.status === "confirmed" || notif.status === "rejected") {
    return json({ ok: true, message: "已经处理过了" });
  }

  await store.setNotification(notif.id, {
    ...notif,
    status: "rejected",
    confirmed_at: new Date().toISOString(),
  });

  return json({ ok: true, message: "已拒绝" });
}

// ─────────────────────────────────────────────
// GET /api/confirm.html（车主确认页）
// ─────────────────────────────────────────────
async function handleConfirmPage(url, env) {
  const key = url.searchParams.get("key");
  if (!key) {
    return new Response("<h1>无效链接</h1>", { status: 400, headers: { "Content-Type": "text/html" } });
  }

  const store = new KVStore(env.SCAN_KV);
  const notif = await store.getNotificationByKey(key);
  if (!notif) {
    return new Response("<h1>链接已失效或不存在</h1>", { status: 404, headers: { "Content-Type": "text/html" } });
  }

  const scenario = notif.scenario || "";
  const message = notif.message || "";
  const reqLat = notif.requester_lat || 0;
  const reqLon = notif.requester_lon || 0;
  const carPlate = notif.car_plate || "";
  const status = notif.status || "pending";
  const statusLabel = {
    waiting_confirmation: "等待确认",
    pending: "已通知",
    confirmed: "已确认",
    rejected: "已拒绝",
    failed: "发送失败"
  }[status] || status;

  const locHtml = (reqLat && reqLon)
    ? `<div class="owner-loc">📍 对方位置：<a href="https://maps.apple.com/?q=&ll=${reqLat},${reqLon}" target="_blank">查看地图</a></div>`
    : "";

  const isDone = status === "confirmed" || status === "rejected" || status === "failed";
  const actionHtml = isDone
    ? `<p style="text-align:center;color:#888;font-size:15px;">此请求已处理完毕</p>`
    : `<div class="action-btns">
        <button class="btn btn-confirm" id="confirmBtn" onclick="doConfirm()">✅ 确认挪车</button>
        <button class="btn btn-reject" id="rejectBtn" onclick="doReject()">❌ 暂时不便</button>
       </div>`;

  const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>挪车确认 - 扫码挪车</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.card{background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.15);padding:40px 36px;width:100%;max-width:440px}
.hero{text-align:center;margin-bottom:28px}
.hero-icon{font-size:60px;margin-bottom:12px}
h1{font-size:24px;text-align:center;margin-bottom:8px;color:#1a1a2e;font-weight:700}
.subtitle{text-align:center;color:#888;font-size:15px}
.info-box{background:#f8f7ff;border:1.5px solid #e0dcff;border-radius:14px;padding:16px;margin-bottom:20px}
.info-row{display:flex;justify-content:space-between;font-size:14px;color:#555;margin-bottom:8px}
.info-row:last-child{margin-bottom:0}
.info-label{font-weight:600;color:#888}
.status-badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600}
.status-waiting,.status-pending{background:#fff3cd;color:#856404}
.status-confirmed{background:#d4edda;color:#155724}
.status-rejected,.status-failed{background:#f8d7da;color:#721c24}
.action-btns{display:flex;gap:12px;margin-top:24px}
.btn{flex:1;padding:14px;border:none;border-radius:14px;font-size:16px;font-weight:600;cursor:pointer;transition:all 0.2s}
.btn-confirm{background:linear-gradient(135deg,#28a745,#20c997);color:#fff}
.btn-reject{background:#f0f0f0;color:#555}
.btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.15)}
.btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
.msg{text-align:center;margin-top:16px;font-size:14px;font-weight:500}
.msg.ok{color:#28a745}
.msg.err{color:#dc3545}
.owner-loc{background:#e8f5e9;border:1px solid #c8e6c9;border-radius:10px;padding:12px;margin-top:12px;font-size:13px;color:#2e7d32}
.owner-loc a{color:#2e7d32}
</style>
</head>
<body>
<div class="card">
  <div class="hero"><div class="hero-icon">🚗</div><h1>有人需要您挪车</h1><p class="subtitle">请确认是否方便挪车</p></div>
  <div class="info-box">
    <div class="info-row"><span class="info-label">场景</span><span>${scenario}</span></div>
    <div class="info-row"><span class="info-label">说明</span><span>${message}</span></div>
    <div class="info-row"><span class="info-label">状态</span><span class="status-badge status-${status}" id="statusBadge">${statusLabel}</span></div>
    ${carPlate ? `<div class="info-row"><span class="info-label">被挡车牌</span><span style="font-weight:700;color:#667eea">${carPlate}</span></div>` : ""}
    ${locHtml}
  </div>
  <div id="actionArea">${actionHtml}</div>
  <div class="msg" id="msg"></div>
</div>
<script>
const key = "${key}";
async function doConfirm(){
  setBtns(false);
  try {
    const resp = await fetch('/api/confirm/' + key, {method:'POST'});
    const data = await resp.json();
    if(resp.ok){
      document.getElementById('statusBadge').textContent='已确认';
      document.getElementById('statusBadge').className='status-badge status-confirmed';
      document.getElementById('actionArea').innerHTML='<p style="text-align:center;color:#28a745;font-size:16px;font-weight:600;">✅ 已确认！对方会收到您的位置信息</p>';
    } else {
      document.getElementById('msg').textContent='操作失败：'+(data.detail||'');
      document.getElementById('msg').className='msg err';
      setBtns(true);
    }
  } catch(e){
    document.getElementById('msg').textContent='网络错误，请稍后重试';
    document.getElementById('msg').className='msg err';
    setBtns(true);
  }
}
async function doReject(){
  setBtns(false);
  try {
    const resp = await fetch('/api/reject/' + key, {method:'POST'});
    const data = await resp.json();
    if(resp.ok){
      document.getElementById('statusBadge').textContent='已拒绝';
      document.getElementById('statusBadge').className='status-badge status-rejected';
      document.getElementById('actionArea').innerHTML='<p style="text-align:center;color:#888;font-size:16px;font-weight:600;">❌ 已拒绝通知</p>';
    } else {
      document.getElementById('msg').textContent='操作失败：'+(data.detail||'');
      document.getElementById('msg').className='msg err';
      setBtns(true);
    }
  } catch(e){
    document.getElementById('msg').textContent='网络错误，请稍后重试';
    document.getElementById('msg').className='msg err';
    setBtns(true);
  }
}
function setBtns(enabled){
  const cb=document.getElementById('confirmBtn'),rb=document.getElementById('rejectBtn');
  if(cb)cb.disabled=!enabled;
  if(rb)rb.disabled=!enabled;
}
</script>
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// ─────────────────────────────────────────────
// GET /api/history/{token}
// ─────────────────────────────────────────────
async function handleHistory(token, env) {
  const store = new KVStore(env.SCAN_KV);
  const rows = await store.getHistory(token);
  return json(rows.map(r => ({
    id: r.id,
    scenario: r.scenario,
    message: r.message,
    pushed_at: r.pushed_at,
    success: r.success,
  })));
}

// ─────────────────────────────────────────────
// GET /api/scan/{scanId}
// ─────────────────────────────────────────────
async function handleScan(scanId, env) {
  const store = new KVStore(env.SCAN_KV);
  const scan = await store.getScan(scanId);
  if (!scan || !scan.active) return json({ detail: "二维码不存在或已禁用" }, 404);
  const owner = await store.getOwner(scan.owner_token);
  if (!owner) return json({ detail: "车主不存在" }, 404);
  return json({
    token: owner.token,
    name: owner.name,
    license_plates: owner.license_plates || [],
    latitude: owner.latitude || 0,
    longitude: owner.longitude || 0,
  });
}

// ─────────────────────────────────────────────
// GET /api/qr/{token}
// ─────────────────────────────────────────────
async function handleQr(token, env) {
  const store = new KVStore(env.SCAN_KV);
  const owner = await store.getOwner(token);
  if (!owner) return json({ detail: "车主不存在" }, 404);
  return json({
    token: owner.token,
    name: owner.name,
    license_plates: owner.license_plates || [],
    latitude: owner.latitude || 0,
    longitude: owner.longitude || 0,
  });
}

// ─────────────────────────────────────────────
// Worker 入口
// ─────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
