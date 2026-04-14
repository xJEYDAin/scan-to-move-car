# 扫码挪车

基于 Cloudflare Workers 的扫码挪车服务，无需服务器，利用免费额度可做到零成本运行。

---

## 功能特点

- 🚗 **车主注册** - 绑定 Bark Key + 车牌号
- 📱 **扫码通知** - 无需打电话，扫码即推送
- 🔔 **文明推送** - 通过 Bark 发送通知
- 📍 **精确定位** - 支持高德地图地理编码，显示详细地址
- ⏱️ **防骚扰** - 无位置时延迟 30 秒才发推送
- ✅ **双向反馈** - 车主可确认/拒绝，申请人实时看到结果
- 🔢 **次数限制** - 防止恶意骚扰（默认每天 20 次/车牌）
- 🌐 **地域限制** - 默认仅允许中国地区访问
- ⌨️ **智能键盘** - 专用车牌输入键盘，支持新能源车牌
- 📋 **二维码生成** - 一键生成挪车二维码，印出来放车窗

---

## 部署教程

### 第一步：创建 Worker

1. 打开 [Cloudflare Workers](https://dash.cloudflare.com/workers)
2. 点击 **Create Worker**
3. 名称填 `scan-to-move-car`，点击 **Deploy**
4. 点击 **Edit code**，删除全部代码
5. 将 `cloudflare/movecar.js` 的内容粘贴进去
6. 点击 **Save and deploy**

### 第二步：创建 KV 存储

1. 左侧菜单点击 **KV**
2. 点击 **Create a namespace**
3. 名称填 `SCAN_KV`，点击 **Create**

### 第三步：绑定 KV 到 Worker

1. 进入 Worker → **Settings** → **Bindings**
2. 点击 **Add binding**
3. 配置：
   - **Variable name**: `SCAN_KV`
   - **KV namespace**: 选择刚才创建的 `SCAN_KV`
4. 点击 **Save**

### 第四步：配置环境变量

1. Worker → **Settings** → **Variables and Secrets**
2. 点击 **Add variable**，添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `MAX_PER_DAY` | `20` | 每车牌每天最大推送次数 |
| `BARK_BASE_URL` | `https://api.day.app` | 或你的自建 Bark 服务器 |
| `CONFIRM_BASE_URL` | `https://你的Pages域名` | 生成给车主的确认链接，**必须是 Pages 公开地址** |
| `AMAP_KEY` | `你的高德Key` | 地理编码（可选，不填则显示经纬度坐标） |

3. 点击 **Save**

### 第五步：部署前端

1. 创建 Cloudflare Pages 项目，上传 `public/` 目录下的所有文件
2. 绑定自定义域名（可选）

### 第六步：修改前端 API 地址

部署完成后，需要修改前端代码中的 API 地址。

**涉及的 HTML 文件**（每个都要改）：

| 文件 | 用途 |
|------|------|
| `public/index.html` | 扫码挪车表单 |
| `public/register.html` | 车主注册 |
| `public/confirm.html` | 车主确认/拒绝页面 |
| `public/qr.html` | 二维码生成 |

在这几个文件顶部的 `<script>` 里，找到并修改：

```javascript
const API_BASE = "https://scan-to-move-car.你的账号.workers.dev"; // 改成你的 Worker 地址
```

> Worker 地址在 Worker → **Triggers** → **Routes** 里可以看到，默认是 `https://scan-to-move-car.你的用户名.workers.dev`

重新部署 Pages 后生效。

### 第七步：快速验证

部署完成后，按以下顺序测试：

**1. 测试注册** → 打开 `register.html`，填入车牌 + Bark Key，确认注册成功

**2. 测试推送** → 用 `index.html` 扫码，选择场景，提交后检查手机是否收到 Bark 通知

**3. 测试确认** → 点击通知里的链接，进入 `confirm.html`，点击确认/拒绝，申请人页面应立即跳转

如果哪一步出问题，看下面的**常见问题**。

### 第八步（可选）：生成挪车二维码

打开 `qr.html`，填入车主 token（注册后页面会显示），生成二维码并打印放在车窗。

---

## 目录结构

```
scan-to-move-car/
├── cloudflare/
│   └── movecar.js       # Workers 后端代码
├── public/              # 前端页面
│   ├── index.html       # 扫码挪车表单
│   ├── register.html    # 车主注册
│   ├── confirm.html     # 车主确认/拒绝
│   ├── qr.html          # 二维码生成
│   ├── common.js        # 公共函数
│   └── messages.js      # 推送文案
└── README.md
```

---

## 技术架构

```
用户扫码 → Cloudflare Workers
                ↓
        获取 GPS 坐标
                ↓
        调用高德地图 API（GPS → 文字地址）
                ↓
        Workers KV（存储通知记录）
                ↓
        Bark API（iOS 推送，含地址信息）
                ↓
        车主点击确认/拒绝
                ↓
        申请人页面实时跳转（轮询通知状态）
```

---

## 注意事项

- **冷启动延迟**：Workers 首次请求约几百毫秒，后续正常
- **Bark 服务器**：建议自建（BarkServerGo），推送更稳定
- **免费额度**：Workers 每月 10 万次请求，KV 读写各 100 万次/天，Pages 每月 500 次构建
- **IP 地域限制**：默认只允许中国（CN/HK/MO/TW）访问，可在代码中修改
- **高德地图 Key**：用于将 GPS 坐标转为文字地址，不填则显示原始坐标
- **自定义域名**：Worker → Settings → Custom Domains，Pages 也在其设置中绑定
- **确认链接**：`CONFIRM_BASE_URL` 必须是 Pages 的公开地址，不能是未备案的自定义域名

---

## 常见问题

**Q: 点了"通知车主挪车"没反应？**
A: 打开浏览器控制台（F12）看是否有红色报错。常见原因：API 地址填错、浏览器不支持定位（需要 HTTPS）。

**Q: 车主没收到 Bark 通知？**
A: 检查：Bark Key 是否正确 → 在 Bark APP 里测试推送 → 确认 BARK_BASE_URL 可公网访问。

**Q: 申请人提交后一直停在等待页面？**
A: 车主确认后页面会自动跳转。如果等了超过 1 分钟还是没反应，检查 Workers 日志（Worker → Logs）是否有 500 错误。

**Q: 位置获取失败？**
A: 手机浏览器需要 HTTPS 才能获取定位，确保前端也部署在 HTTPS 域名下。

**Q: 每天次数用完了？**
A: 默认每车牌每天 20 次推送，可在 `MAX_PER_DAY` 环境变量中调整。

---

## 隐私说明

- 无任何硬编码敏感信息
- Token/Bark Key 全部存储在 Cloudflare KV，不暴露给前端
- 对外只暴露随机生成的 `pending_id`（UUID）
- 位置为用户主动提供，不提供位置会触发 30 秒防骚扰延迟

---

## Bark Key 获取方式

1. iPhone 下载 [Bark](https://apps.apple.com/us/app/bark/id1403753865) APP
2. 打开 Bark → 点击最下方的 **Bark** → 复制顶部的 **URL**（格式如 `https://api.day.app/xxxx`）
3. `xxxx` 部分就是你的 Bark Key，填入注册页面即可
