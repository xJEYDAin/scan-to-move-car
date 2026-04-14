/**
 * 公共工具函数 - 扫码挪车
 */

/**
 * 获取完整车牌号（从 index.html 的 cell0~cell7 格子读取，或 register.html 的 select/input 读取）
 * @returns {string} 车牌号，如 "粤B12345"
 */
function getCarPlate() {
  // index.html 使用虚拟键盘，格子 id 为 cell0 ~ cell7
  let plate = '';
  for (let i = 0; i <= 7; i++) {
    const cell = document.getElementById('cell' + i);
    if (cell) plate += cell.textContent.trim().replace(/^省$|^字$/, '');
  }
  return plate;
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
