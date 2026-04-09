# 扫码挪车

基于 Cloudflare Workers 的免费扫码挪车服务，无需服务器，完全零成本。

---

## 功能特点

| 功能 | 说明 |
|------|------|
| 🚗 车主注册 | 绑定 Bark Key + 车牌号 |
| 📱 扫码通知 | 无需打电话，扫码即推送 |
| 🔔 文明推送 | 通过 Bark 发送通知 |
| ⏱️ 防骚扰 | 无位置时延迟 30 秒发送 |
| ✅ 双向反馈 | 车主可确认/拒绝 |
| 🔢 次数限制 | 防止恶意骚扰同一车主（默认每天 20 次） |

---

## 每日推送限制

**限制逻辑：** 按车牌号维度计算，同一车牌每天最多推送 N 次。到达上限后返回错误："今日推送次数已达上限"。

**如何修改次数限制：**
1. 进入 Cloudflare Workers 后台
2. 打开你的 Worker → Settings → Variables and Secrets
3. 找到 `MAX_PER_DAY` 变量，修改为想要的值
4. 重新部署

---

## 快速部署

### 方式一：Cloudflare 官网部署（推荐）

无需安装任何工具，浏览器即可完成。

#### 第一步：创建 Worker

1. 打开 [Cloudflare Workers](https://dash.cloudflare.com/workers)
2. 点击 **Create Worker**
3. 名称填 `scan-to-move-car`，点击 **Deploy**
4. 点击 **Edit code**，删除全部代码
5. 将 `cloudflare/movecar.js` 的内容粘贴进去
6. 点击 **Save and deploy**

#### 第二步：创建 KV 存储

1. 左侧菜单点击 **KV**
2. 点击 **Create a namespace**
3. 名称填 `SCAN_KV`，点击 **Create**

#### 第三步：绑定 KV 到 Worker

1. 进入 Worker → **Settings** → **Bindings**
2. 点击 **Add binding**
3. 配置：
   - **Variable name**: `SCAN_KV`
   - **KV namespace**: 选择刚才创建的 `SCAN_KV`
4. 点击 **Save**

#### 第四步：配置环境变量

1. Worker → **Settings** → **Variables and Secrets**
2. 点击 **Add variable**，添加：
   - `MAX_PER_DAY` = `20`
   - `BARK_BASE_URL` = `https://api.day.app`
3. 点击 **Save**

#### 第五步：完成

访问：`https://scan-to-move-car.<你的子域名>.workers.dev/static/register.html`

---

### 方式二：Wrangler CLI 部署

需要 Node.js 环境。

```bash
# 安装 Wrangler
npm install -g wrangler
wrangler login

# 创建 KV 命名空间
cd cloudflare
wrangler kv:namespace create "SCAN_KV"

# 将返回的 id 填入 wrangler.toml
# [[kv_namespaces]]
# binding = "SCAN_KV"
# id = "填入此处"

# 配置 Bark 服务器（可选）
wrangler secret put BARK_BASE_URL

# 部署
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
├── public/              # 前端页面
│   ├── index.html       # 扫码挪车表单
│   ├── register.html    # 车主注册
│   ├── confirm.html     # 车主确认/拒绝
│   ├── qr.html          # 二维码生成
│   ├── common.js        # 公共函数
│   ├── style.css        # 公共样式
│   ├── messages.js      # 推送文案
│   └── build.sh         # 构建脚本
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
```

---

## 注意事项

- **冷启动延迟**：首次请求约几百毫秒，后续正常
- **Bark 服务器**：建议自建，推送更稳定
- **免费额度**：Workers 每月 10 万次请求，KV 读写各 100 万次/天
- **自定义域名**：Worker → Settings → Custom Domains

---

## 隐私说明

- 无任何硬编码，Token/Bark Key 全部存储在 KV
- 对外只暴露 `scan_id`（随机 8 位字符串），不泄露任何敏感信息
- 位置可选，不提供位置会有 30 秒延迟
