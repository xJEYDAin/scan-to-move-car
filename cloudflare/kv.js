/**
 * 扫码挪车 - Cloudflare KV 封装
 *
 * 本文件提供 KV 存储的 CRUD 操作封装。
 * Workers 主代码中默认使用 D1，若需使用 KV 可按以下方式替换：
 *
 *   import { KVStore } from './kv.js';
 *   const store = new KVStore(env.SCAN_KV);
 *
 * 注意：KV 适合缓存，不建议用于核心业务数据。
 * 推荐使用 D1（SQLite）作为主数据库，KV 作为可选缓存层。
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

  async getOwnerByPhone(phone) {
    const key = await this.kv.get("owner_phone:" + phone);
    if (!key) return null;
    return this.getOwner(key);
  }

  async setOwnerByPhone(phone, token) {
    await this.kv.put("owner_phone:" + phone, token);
  }

  async getOwnerByBarkKey(barkKey) {
    const key = await this.kv.get("owner_bark:" + barkKey);
    if (!key) return null;
    return this.getOwner(key);
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

  async getNotificationByKey(confirmedKey) {
    const id = await this.kv.get("notif_key:" + confirmedKey);
    if (!id) return null;
    return this.getNotification(id);
  }

  async setNotificationKey(confirmedKey, id) {
    await this.kv.put("notif_key:" + confirmedKey, String(id));
    // 过期时间 7 天
    await this.kv.putWithMetadata("notif_key:" + confirmedKey, String(id), { expirationTtl: 7 * 86400 });
  }

  // ── 计数器（限流）──
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
}
