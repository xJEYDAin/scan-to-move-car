/**
 * 公共工具函数 - 扫码挪车
 */

/**
 * Haversine 公式计算两点间距离（米）
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} 距离（米）
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 获取完整车牌号（从 cp1-cp8 元素读取）
 * @returns {string} 车牌号，如 "粤B12345"
 */
function getCarPlate() {
  const v1 = document.getElementById('cp1')?.value || '';
  const v2 = document.getElementById('cp2')?.value || '';
  if (!v1 || !v2) return '';
  const p3 = document.getElementById('cp3')?.value || '';
  const p4 = document.getElementById('cp4')?.value || '';
  const p5 = document.getElementById('cp5')?.value || '';
  const p6 = document.getElementById('cp6')?.value || '';
  const p7 = document.getElementById('cp7')?.value || '';
  const p8 = document.getElementById('cp8')?.value || '';
  return v1 + v2 + p3 + p4 + p5 + p6 + p7 + p8;
}

/**
 * API 请求封装（15 秒超时）
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<any>}
 */
async function apiFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return await resp.json();
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * 显示错误消息（3 秒后自动清除）
 * @param {string} text
 */
function showErr(text) {
  const el = document.getElementById('msg');
  if (!el) return;
  el.textContent = text;
  el.className = 'msg err';
  setTimeout(() => {
    if (el.textContent === text) {
      el.textContent = '';
      el.className = 'msg';
    }
  }, 3000);
}

/**
 * 显示成功消息（3 秒后自动清除）
 * @param {string} text
 */
function showOk(text) {
  const el = document.getElementById('msg');
  if (!el) return;
  el.textContent = text;
  el.className = 'msg ok';
  setTimeout(() => {
    if (el.textContent === text) {
      el.textContent = '';
      el.className = 'msg';
    }
  }, 3000);
}

/**
 * 关闭当前窗口（兼容不同浏览器）
 */
function closeWindow() {
  try {
    window.opener?.postMessage('closed', '*');
  } catch (_) {}
  try {
    window.close();
  } catch (_) {}
}
