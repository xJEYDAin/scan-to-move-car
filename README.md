# 扫码挪车 - Cloudflare Workers 部署

基于 Cloudflare Workers + Workers KV 的扫码挪车服务，无需服务器、完全免费。

## 功能特性

- 🚗 车主注册，绑定 Bark Key + 车牌号
- 📱 扫码一键通知，无需打电话
- 🔔 Bark 推送，文明礼貌
- ⏱️ 30 秒防骚扰机制（无位置时延迟发送）
- ✅ 车主确认/拒绝双向反馈
- 📊 每日推送次数限制（20 次/天）
- 🌐 全球 CDN 加速

## 技术架构

```
用户扫码
  ↓
Cloudflare Workers（处理所有请求）
  ↓
Workers KV（存储车主/通知/历史数据）
  ↓
Bark API（iOS 推送通知）
```

---

## 部署方式

### 方式一：Cloudflare 官网后台部署（推荐）

无需安装任何工具，直接在浏览器完成部署。

#### 第一步：创建 Worker

1. 打开 https://dash.cloudflare.com/workers
2. 点击 "Create Worker"
3. 名称填 `scan-to-move-car`
4. 删除默认代码，将 `cloudflare/movecar.js` 的全部内容粘贴进去
5. 点击 "Deploy"

#### 第二步：创建 KV 命名空间

1. 左侧菜单点击 "KV"
2. 点击 "Create a namespace"
3. 名称填 `SCAN_KV`，点击 "Create"

#### 第三步：绑定 KV 到 Worker

1. 进入 Worker → "Settings" → "Bindings"
2. 点击 "Add binding"
3. 配置：
   - **Variable name**: `SCAN_KV`
   - **KV namespace**: 选择刚才创建的 `SCAN_KV`
4. 点击 "Save"

#### 第四步：配置环境变量

1. Worker → "Settings" → "Variables and Secrets"
2. 点击 "Add variable"
3. 添加以下变量：
   - `MAX_PER_DAY` = `20`
   - `BARK_BASE_URL` = `https://api.day.app`（使用官方服务器）
     - 如使用自建 Bark 服务器，填你的服务器地址

#### 第五步：重新部署

返回 "Editor"，点击 "Deploy" 重新部署。

#### 第六步：访问

部署成功后，访问：
```
https://scan-to-move-car.<你的子域名>.workers.dev/static/register.html
```

---

### 方式二：Wrangler CLI 部署

需要安装 Node.js 和 Wrangler。

#### 1. 安装 Wrangler

```bash
npm install -g wrangler
wrangler login
```

#### 2. 创建 KV 命名空间

```bash
cd cloudflare
wrangler kv:namespace create "SCAN_KV"
```

把返回的 `id` 填入 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "SCAN_KV"
id = "填入此处"
```

#### 3. 配置 Bark 服务器（可选）

```bash
wrangler secret put BARK_BASE_URL
# 输入你的 Bark 服务器地址
```

#### 4. 部署

```bash
wrangler deploy
```

---

## 目录结构

```
scan-to-move-car/
├── cloudflare/
│   ├── movecar.js       # Workers 主代码
│   ├── kv.js            # KV 工具类
│   └── wrangler.toml    # Workers 配置
├── public/              # 静态文件
│   ├── index.html       # 扫码挪车表单
│   ├── register.html    # 车主注册
│   ├── confirm.html     # 车主确认页
│   ├── qr.html         # 二维码生成
│   └── messages.js      # 推送文案模板
└── README.md            # 本文档
```

## 隐私说明

- **无任何硬编码**：Token、Bark Key 等全部通过 KV 存储
- **不暴露 Token**：对外只暴露 `scan_id`（8 位随机字符串）
- **位置可选**：用户可以不提供位置（会有 30 秒延迟）

## 注意事项

1. **Workers 冷启动**：首次请求可能有几百毫秒延迟
2. **Bark 服务器**：建议自建，避免推送延迟
3. **免费额度**：Workers 每月 10 万次请求，KV 读写各 100 万次/天
4. **自定义域名**：可在 Worker → "Settings" → "Custom Domains" 绑定自己的域名
