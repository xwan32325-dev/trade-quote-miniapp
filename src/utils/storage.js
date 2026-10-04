/**
 * storage.js — 本地存储封装（统一走 uni API，兼容小程序 / H5）
 * 目前用于「我的记录」：报价历史最多保留 50 条，新记录在前。
 */

const HISTORY_KEY = 'quoteHistory';
const MAX_HISTORY = 50;
const FORM_PREFIX = 'form:';

/** 生成一条记录的唯一 id */
export function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 读取全部历史记录，异常时返回空数组 */
export function getHistory() {
  try {
    const list = uni.getStorageSync(HISTORY_KEY);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

/** 保存一条记录到最前面，超出 50 条则截断；返回新的列表 */
export function saveRecord(record) {
  const list = getHistory();
  list.unshift(record);
  const trimmed = list.slice(0, MAX_HISTORY);
  try {
    uni.setStorageSync(HISTORY_KEY, trimmed);
  } catch (e) {
    // 存储失败不阻断页面流程
  }
  return trimmed;
}

/** 按 id 删除单条记录，返回新的列表 */
export function removeRecord(id) {
  const list = getHistory().filter((item) => item.id !== id);
  try {
    uni.setStorageSync(HISTORY_KEY, list);
  } catch (e) {}
  return list;
}

/** 保存表单记忆，key 区分页面（如 'quote' / 'loading' / 'ai'） */
export function saveForm(key, obj) {
  try {
    uni.setStorageSync(FORM_PREFIX + key, obj);
  } catch (e) {
    // 存储失败不阻断页面流程
  }
}

/** 读取表单记忆，读不到或非对象时返回 null */
export function loadForm(key) {
  try {
    const v = uni.getStorageSync(FORM_PREFIX + key);
    return v && typeof v === 'object' ? v : null;
  } catch (e) {
    return null;
  }
}

/** 清空全部记录 */
export function clearHistory() {
  try {
    uni.removeStorageSync(HISTORY_KEY);
  } catch (e) {}
  return [];
}
