/**
 * request.js — 后端请求封装（uni.request）
 * 后端地址默认 http://localhost:8787，可用本地存储 apiBase 覆盖。
 */

const API_BASE_KEY = 'apiBase';

/**
 * 默认后端地址：
 * - H5（浏览器/公网部署）：与页面同源，部署到哪台服务器就用哪台，无需改代码
 * - 小程序：默认连本机开发后端
 */
function resolveDefaultBase() {
  // #ifdef H5
  try {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
  } catch (e) {}
  // #endif
  return 'http://localhost:8787';
}

const DEFAULT_API_BASE = resolveDefaultBase();

/** 取当前后端地址：优先本地存储，其次默认值 */
export function getApiBase() {
  try {
    return uni.getStorageSync(API_BASE_KEY) || DEFAULT_API_BASE;
  } catch (e) {
    return DEFAULT_API_BASE;
  }
}

/** 设置后端地址 */
export function setApiBase(base) {
  const value = (base || '').trim().replace(/\/+$/, '');
  try {
    if (value) uni.setStorageSync(API_BASE_KEY, value);
    else uni.removeStorageSync(API_BASE_KEY);
  } catch (e) {}
  return value || DEFAULT_API_BASE;
}

/**
 * 获取实时汇率
 * @param {{from?:string, to?:string, force?:boolean}} params force=true 绕过 30 分钟缓存
 * @returns {Promise<{ok:boolean, base:string, quote:string, rate:number, previousRate:number,
 *   change:number|null, changePct:number|null, source:string, sourceDate:string,
 *   fetchedAt:string, stale:boolean, cached:boolean}>}
 */
export function getFxRate({ from = 'USD', to = 'CNY', force = false } = {}) {
  const url =
    getApiBase() +
    '/api/fx?from=' +
    encodeURIComponent(from) +
    '&to=' +
    encodeURIComponent(to) +
    (force ? '&force=1' : '');
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: 'GET',
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data || {});
        } else {
          const data = res.data || {};
          const msg = data.message || data.error || ('HTTP ' + res.statusCode);
          reject(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)));
        }
      },
      fail: (err) => {
        reject(new Error((err && err.errMsg) || '网络请求失败'));
      },
    });
  });
}

/**
 * 调用后端一次性生成接口（非流式）
 * @param {{system:string, input:string, tool?:string, model?:string}} payload
 * @returns {Promise<{text:string, elapsedMs?:number, tokens?:number}>}
 */
export function runOnce(payload) {
  const { system, input, tool = 'rewrite', model = 'deepseek-flash' } = payload;
  return new Promise((resolve, reject) => {
    uni.request({
      url: getApiBase() + '/api/run-once',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { tool, system, input, model },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data || {});
        } else {
          const data = res.data || {};
          const msg = data.error || data.message || ('HTTP ' + res.statusCode);
          reject(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)));
        }
      },
      fail: (err) => {
        reject(new Error((err && err.errMsg) || '网络请求失败'));
      },
    });
  });
}
