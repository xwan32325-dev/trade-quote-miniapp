/**
 * request.js — 后端请求封装（uni.request）
 * 后端地址默认 http://localhost:8787，可用本地存储 apiBase 覆盖。
 */

const API_BASE_KEY = 'apiBase';
const DEFAULT_API_BASE = 'http://localhost:8787';

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
