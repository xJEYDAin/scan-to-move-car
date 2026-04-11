# 扫码挪车

基于 Cloudflare Workers 的免费扫码挪车服务，无需服务器，完全零成本。

---

## 功能特点

- 🚗 **车主注册** - 绑定 Bark Key + 车牌号
- 📱 **扫码通知** - 无需打电话，扫码即推送
- 🔔 **文明推送** - 通过 Bark 发送通知
- 📍 **精确定位** - 支持高德地图地理编码，显示详细地址
- ⏱️ **防骚扰** - 无位置时延迟 30 秒发送
- ✅ **双向反馈** - 车主可确认/拒绝
- 🔢 **次数限制** - 防止恶意骚扰（默认每天 20 次/车牌）
- 🌐 **地域限制** - 默认仅允许中国地区访问
- ⌨️ **智能键盘** - 专用车牌输入键盘，支持新能源车牌

---

## 截图预览

```
┌─────────────────────────────┐
│      🚗 扫码挪车          │
│                             │
│  请选择场景                │
│  ┌─────┐┌─────┐┌─────┐   │
│  │🔴紧急││🟡重要││🟢一般│   │
│  └─────┘└─────┘└─────┘   │
│                             │
│  车牌                     │
│  ┌─┐┌─┐  ┌─┬─┬─┬─┬─┬─┐   │
│  │粤││B│ ·│ │ │ │ │ │ │   │
│  └─┘└─┘  └─┴─┴─┴─┴─┴─┘   │
│                             │
│  ┌─ 快捷留言 ─────────┐   │
│  │ 请让一下，谢谢 🚗   │   │
│  └───────────────────┘   │
│                             │
│  📍 获取当前位置（可选）   │
│                             │
│  [  立即通知车主  ]       │
└─────────────────────────────┘
```

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
4. 复制返回的 **Namespace ID**（后面会用到）

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
| `CONFIRM_BASE_URL` | `https://你的Pages域名` | 用于生成确认链接 |
| `AMAP_KEY` | `你的高德Key` | 地理编码（可选，不填则显示坐标） |

3. 点击 **Save**

### 第五步：部署前端

1. 创建 Cloudflare Pages 项目
2. 上传 `public/` 目录下的所有文件
3. 绑定自定义域名（可选）

### 第六步：修改前端 API 地址

1. 打开 `public/` 目录下的 HTML 文件
2. 找到 `API_BASE` 配置，改为你的 Worker URL：
   ```javascript
   const API_BASE = 'https://你的Worker域名';
   ```
3. 重新部署 Pages

### 第七步：完成

访问：`https://你的Pages域名/register.html`

---

## 目录结构

```
scan-to-move-car/
├── cloudflare/
│   └── movecar.js       # Workers 主代码
├── public/               # 前端页面
│   ├── index.html       # 扫码挪车表单
│   ├── register.html    # 车主注册
│   ├── confirm.html     # 车主确认/拒绝
│   ├── qr.html          # 二维码生成
│   ├── common.js        # 公共函数
│   ├── style.css        # 公共样式
│   └── messages.js      # 推送文案
└── README.md
```

---

## 技术架构

```
用户扫码
  ↓
Cloudflare Workers
  ↓
Workers KV（存储数据）
  ↓
Bark API（iOS 推送）
  ↓
高德地图（地理编码，可选）
```

---

## 注意事项

- **冷启动延迟**：首次请求约几百毫秒，后续正常
- **Bark 服务器**：建议自建，推送更稳定
- **免费额度**：Workers 每月 10 万次请求，KV 读写各 100 万次/天
- **IP 地域限制**：默认只允许中国（CN/HK/MO/TW）访问，可在代码中修改
- **高德地图 Key**：用于将 GPS 坐标转换为文字地址，可选功能
- **自定义域名**：Worker → Settings → Custom Domains

---

## 隐私说明

- 无任何硬编码敏感信息
- Token/Bark Key 全部存储在 KV
- 对外只暴露 `scan_id`（随机 8 位字符串）
- 位置可选，不提供位置会有 30 秒延迟
