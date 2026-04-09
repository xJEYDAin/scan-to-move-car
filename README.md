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

## 部署步骤

### 前置准备

1. 安装 Wrangler CLI：
   ```bash
   npm install -g wrangler
   ```

2. 登录 Cloudflare：
   ```bash
   wrangler login
   ```

### 1. 创建 KV 命名空间

```bash
cd cloudflare
wrangler kv:namespace create "SCAN_KV"
```

输出类似：
```
{ binding = "SCAN_KV", id = "xxxxxxxxxxxxxxxxxxxx" }
```

### 2. 配置 wrangler.toml

编辑 `cloudflare/wrangler.toml`，填入 KV ID：

```toml
[[kv_namespaces]]
binding = "SCAN_KV"
id = "填入上一步返回的 id"
```

### 3. （可选）配置 Bark 服务器

如果使用自建 Bark 服务（而非官方 `api.day.app`），设置环境变量：

```bash
wrangler secret put BARK_BASE_URL
# 输入你的 Bark 服务器地址，如 https://bark.eggtata.top
```

### 4. 部署

```bash
wrangler deploy
```

部署成功后会返回 Workers URL，格式如：
```
https://scan-to-move-car.your-subdomain.workers.dev
```

### 5. 验证部署

访问 `https://scan-to-move-car.your-subdomain.workers.dev/static/register.html` 注册车主。

## 一键部署命令

```bash
cd cloudflare
wrangler kv:namespace create "SCAN_KV"
# 复制上一步的 id，填入 wrangler.toml
wrangler secret put BARK_BASE_URL  # 可选
wrangler deploy
```

## 目录结构

```
scan-to-move-car/
├── cloudflare/
│   ├── movecar.js       # Workers 主代码（API 路由 + KV 存储）
│   ├── kv.js            # KV 工具类（参考）
│   └── wrangler.toml    # Workers 配置
├── public/              # 静态文件（自动 CDN 分发）
│   ├── index.html       # 扫码挪车表单
│   ├── register.html    # 车主注册
│   ├── confirm.html     # 车主确认页
│   ├── qr.html          # 二维码生成
│   └── messages.js      # 推送文案模板
└── README.md            # 本文档
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/register` | 车主注册 |
| POST | `/api/notify` | 发送挪车通知 |
| GET | `/api/status/{id}` | 查询通知状态 |
| GET | `/api/status/key/{key}` | 通过确认码查询状态 |
| POST | `/api/confirm/{key}` | 车主确认挪车 |
| POST | `/api/reject/{key}` | 车主拒绝 |
| GET | `/api/history/{token}` | 历史记录 |
| GET | `/api/scan/{scan_id}` | 通过 scan_id 获取车主信息 |
| GET | `/api/qr/{token}` | 通过 token 获取车主信息 |
| GET | `/s/c?k=xxx` | 短链接跳转确认页 |

## KV 数据模型

所有数据存储在 Cloudflare KV 中，无数据库依赖。

| Key 格式 | 说明 |
|----------|------|
| `owner:{token}` | 车主信息（JSON） |
| `owner_bark:{bark_key}` | Bark Key → Token 索引 |
| `owner_plate:{plate}` | 车牌 → Token 索引 |
| `scan:{scan_id}` | 公开 scan_id 映射 |
| `notif:{id}` | 通知记录（JSON） |
| `notif_key:{confirmed_key}` | 确认码 → 通知 ID（7 天过期） |
| `rate:{token}:{date}` | 当日推送计数 |
| `hist:{token}` | 历史通知列表（最近 50 条） |
| `counter:notif` | 通知 ID 计数器 |
| `counter:scan` | Scan ID 计数器 |

## 隐私说明

- **无任何硬编码**：Token、Bark Key 等全部通过 KV 存储
- **不暴露 Token**：对外只暴露 `scan_id`（8 位随机字符串）
- **位置可选**：用户可以不提供位置（会有 30 秒延迟）
- **地区限制**：Workers 默认仅对中国大陆用户开放

## 注意事项

1. **Workers 冷启动**：首次请求可能有几百毫秒延迟，之后会缓存
2. **KV 延迟**：KV 写入有最终一致性，介意者可用 D1（需改代码）
3. **Bark 服务器**：建议自建，避免推送延迟
4. **免费额度**：Workers 每月 10 万次请求，KV 读写各 100 万次/天

## 本地开发

```bash
cd cloudflare
wrangler dev
# 访问 http://localhost:8787
```

本地开发时需提前创建 KV namespace 并在 `wrangler.toml` 中配置 `preview_id`。
