/**
 * image.js — 选图/拍照并压缩成 data URL（JPEG），供图片识别接口使用。
 * H5 走 FileReader + canvas；小程序走 compressImage + FileSystemManager。
 */

/** 调起拍照/相册，用户取消返回 null */
function chooseImage() {
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count: 1,
      sourceType: ['camera', 'album'],
      success: (res) => resolve(res),
      fail: (err) => {
        const msg = (err && err.errMsg) || '';
        // 用户取消选择不视为错误
        if (/cancel/i.test(msg)) resolve(null);
        else reject(new Error(msg || '选择图片失败'));
      },
    });
  });
}

// #ifdef H5
/** 按最长边等比缩放到 canvas，导出 JPEG data URL */
function scaleToDataUrl(img, maxEdge, quality) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  let tw = w;
  let th = h;
  if (Math.max(w, h) > maxEdge) {
    const ratio = maxEdge / Math.max(w, h);
    tw = Math.round(w * ratio);
    th = Math.round(h * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  canvas.getContext('2d').drawImage(img, 0, 0, tw, th);
  return canvas.toDataURL('image/jpeg', quality);
}

/** File → dataURL → Image → canvas → 压缩后的 JPEG data URL */
function fileToDataUrl(file, maxEdge, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(scaleToDataUrl(img, maxEdge, quality));
      img.onerror = () => reject(new Error('图片解码失败'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
}
// #endif

// #ifdef MP-WEIXIN
/** 小程序：先压缩，再读成 base64 拼 data URL */
function compressAndRead(src) {
  return new Promise((resolve, reject) => {
    uni.compressImage({
      src,
      quality: 80,
      success: (res) => {
        uni.getFileSystemManager().readFile({
          filePath: res.tempFilePath,
          encoding: 'base64',
          success: (r) => resolve('data:image/jpeg;base64,' + r.data),
          fail: (e) => reject(new Error((e && e.errMsg) || '图片读取失败')),
        });
      },
      fail: (e) => reject(new Error((e && e.errMsg) || '图片压缩失败')),
    });
  });
}
// #endif

/**
 * 选图/拍照并压缩成 data URL（JPEG），最长边 ≤ maxEdge
 * @param {{maxEdge?:number, quality?:number}} options
 * @returns {Promise<string|null>} 用户取消返回 null
 */
export async function pickImageAsDataUrl({ maxEdge = 1600, quality = 0.8 } = {}) {
  const res = await chooseImage();
  if (!res) return null;

  // #ifdef H5
  const file = res.tempFiles && res.tempFiles[0];
  if (!file) return null;
  return fileToDataUrl(file, maxEdge, quality);
  // #endif

  // #ifdef MP-WEIXIN
  const src =
    (res.tempFilePaths && res.tempFilePaths[0]) ||
    (res.tempFiles && res.tempFiles[0] && res.tempFiles[0].path);
  if (!src) return null;
  return compressAndRead(src);
  // #endif

  // 其他平台暂不支持压缩（构建目标仅 H5 / MP-WEIXIN）
  return null;
}
