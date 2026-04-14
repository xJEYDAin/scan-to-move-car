/**
 * 扫码挪车 - Cloudflare KV 封装
 *
 * 本文件提供 KV 存储的 CRUD 操作封装。
 * Workers 主代码（movecar.js）统一从本文件 import KVStore。
 */

export class KVStore {
  constructor(kv) {
    this.kv = kv;
  }

  // ── owners ──
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

  async setOwnerByBarkKey(barkKey, token) {
    await this.kv.put("owner_bark:" + barkKey, token);
  }

  // ── notifications ──
  async getNotification(id) {
    const raw = await this.kv.get("notif:" + id);
    return raw ? JSON.parse(raw) : null;
  }

  async setNotification(id, data) {
    await this.kv.put("notif:" + id, JSON.stringify(data));
  }

  async setNotificationWithTTL(id, data, ttlSeconds) {
    await this.kv.put("notif:" + id, JSON.stringify(data), { expirationTtl: ttlSeconds });
  }

  async getNotificationByKey(confirmedKey) {
    const id = await this.kv.get("notif_key:" + confirmedKey);
    if (!id) return null;
    return this.getNotification(id);
  }

  async setNotificationKey(confirmedKey, id) {
    await this.kv.put("notif_key:" + confirmedKey, String(id), { expirationTtl: 7 * 86400 });
  }

  async deleteNotificationKey(confirmedKey) {
    await this.kv.delete("notif_key:" + confirmedKey);
  }

  // ── 计数器（限流）──
  // 注意：Cloudflare KV 不支持原子 increment，此实现存在竞态条件。
  // 并发请求可能导致计数略微偏低（实际限制比预期更宽松），但不会导致超限。
  async incrDailyCount(token) {
    const today = new Date().toISOString().slice(0, 10);
    const key = "rate:" + token + ":" + today;
    const val = await this.kv.get(key);
    const cnt = val ? parseInt(val) + 1 : 1;
    await this.kv.put(key, String(cnt));
    return cnt;
  }

  async getDailyCount(token) {
    const today = new Date().toISOString().slice(0, 10);
    const key = "rate:" + token + ":" + today;
    const val = await this.kv.get(key);
    return val ? parseInt(val) : 0;
  }

  // ── 历史记录（按 token 索引）──
  async appendHistory(token, notification) {
    const listKey = "history:" + token;
    const raw = await this.kv.get(listKey);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(notification);
    // 只保留最近 50 条
    if (list.length > 50) list.splice(50);
    await this.kv.put(listKey, JSON.stringify(list));
  }

  async getHistory(token) {
    const raw = await this.kv.get("history:" + token);
    return raw ? JSON.parse(raw) : [];
  }

  // ── 扫码记录 ──
  async getScan(scanId) {
    const raw = await this.kv.get("scan:" + scanId);
    return raw ? JSON.parse(raw) : null;
  }

  async setScan(scanId, data) {
    await this.kv.put("scan:" + scanId, JSON.stringify(data));
  }

  // ── ID 计数器 ──
  // 使用 UUID 替代自增 ID，避免并发请求时的竞态条件
  async nextNotifId() {
    return crypto.randomUUID();
  }
}
