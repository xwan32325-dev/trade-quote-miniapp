# 本次任务：报价页加「📷 拍照填单」（识别采购单/发票 → 自动填表）

## 背景

业务员手上最多的就是采购单、形式发票、装箱单。要能拍一张照片就把表单填好，省掉手工录入。

后端接口**已经做好并实测通过**（用一张模拟采购单识别，字段全对，耗时 3.2 秒）：

```
POST {apiBase}/api/parse-image
body: { "image": "data:image/jpeg;base64,..." }
resp: {
  ok: true,
  fields: {
    productName: "不锈钢保温杯 500ml（内胆304）",
    customerName: "宁波恒达金属制品有限公司",
    qty: 1000, price: 100, currency: "CNY",
    vatRate: 13, rebateRate: 13,
    cartonL: 50, cartonW: 40, cartonH: 30, grossWeight: 12,
    notes: "交期30天,T/T30%定金,余款见提单副本"
  },
  raw, elapsedMs, tokens, model
}
识别不到的字段返回 null；失败返回 502 + { ok:false, message }
```

## 一、新增 `src/utils/image.js`

```js
/** 选图/拍照并压缩成 data URL（JPEG），最长边 ≤ maxEdge */
export async function pickImageAsDataUrl({ maxEdge = 1600, quality = 0.8 } = {})
```

- 用 `uni.chooseImage({ count: 1, sourceType: ['camera', 'album'] })`
- **H5**：`tempFiles[0]` 是 File → FileReader 读成 dataURL → 用 canvas 缩放到最长边 ≤ maxEdge → `toDataURL('image/jpeg', quality)`
- **小程序（MP-WEIXIN）**：先 `uni.compressImage({ src, quality: 80 })` 压缩，再用
  `uni.getFileSystemManager().readFile({ filePath, encoding: 'base64' })` 读 base64，拼成 `data:image/jpeg;base64,...`
- 用条件编译 `// #ifdef H5` / `// #ifdef MP-WEIXIN`
- 用户取消选择 → 返回 null（不要报错）

## 二、`src/utils/request.js` 增加

```js
export function parseImage(imageDataUrl) // POST /api/parse-image，返回 { fields, elapsedMs, tokens, model }
```
失败时抛出带后端 `message` 的错误（沿用现有错误处理风格）。

## 三、报价页 `src/pages/quote/index.vue`

1. 页面顶部（「基础信息」卡片上方）加一张卡片：
   - 按钮 `📷 拍照填单`（大按钮，主色）
   - 灰色小字：`拍采购单 / 发票 / 装箱单，自动识别产品、数量、单价、箱规`
2. 点击流程：
   - 选图 → 显示**缩略图** + `识别中…`（按钮禁用，防重复点）
   - 成功后按字段填入（**只填识别到的，null 跳过**，不覆盖用户已填的其他字段）：
     - `productName` → `form.productName`
     - `customerName` → `form.customerName`
     - `qty` → `form.qty`
     - `price` → `form.price`（采购成本含税）
     - `vatRate` / `rebateRate` → 对应字段
     - `currency` → 若在币种表 `CURRENCIES` 里，则设 `form.currency` 并**重新拉该币种实时汇率**
     - `cartonL/W/H`、`grossWeight` → **写入装柜页记忆**（读 `loadForm('loading')` 合并后 `saveForm('loading', …)`），提示里说明"箱规已同步到装柜页"
   - 提示当前状态：`✅ 已填入：产品名、数量、单价、箱规`（列实际填入的字段名）
     - 若 `fields.notes` 有内容，显示 `单据备注：xxx`
     - 若某个关键字段是 null，明确写出来，例如 `未识别到：客户名、退税率`
   - 失败：显示后端错误信息（红字），不清空用户已填内容
3. 识别结果区域可折叠/简洁展示，不打断现有布局
4. 识别过程与结果**不写入历史记录**（那是报价记录）

## 四、约束

- 不引 UI 库；不改 `calc.js` / `incoterms.js` 的计算逻辑
- **不要启动任何服务**（8787 / 8790 在跑），**不要**跑 `dev:mp-weixin`
- 自测：`npm run build:mp-weixin` 与 `npm run build:h5` 都要 Build complete
- 提交：`git -c user.email=dev@local -c user.name=dev commit -m "feat(quote): 拍照填单（图片识别自动填入产品/数量/单价/箱规）"`

## 五、汇报（中文）

改了哪些文件、两端取图与压缩的实现差异、字段映射与"只填识别到的"规则、失败处理、两个 build 结果、遗留问题。
