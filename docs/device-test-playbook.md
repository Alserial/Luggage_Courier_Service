# 真机测试执行手册（MVP 验收 ③）

控制台侧前置已全部就绪：索引已上线、6 个关键集合已设为「仅管理端可读写」、33 个云函数版本核对为 `ca9c924`、管理员已初始化（`o7dBp3UXAvKOsYsJnNq2TzTWN4G8` = admin/reviewer）。

本手册只覆盖需要你用**微信开发者工具 + 3 个微信账号 + 真机**完成的部分。

---

## 0. 准备阶段

### 0.1 上传体验版
1. 打开**微信开发者工具**，导入项目目录 `D:\工作\Luggage_Courier_Service\miniprogram`（确认 `project.config.json` 里的 AppID 是你的小程序 AppID）。
2. 点右上角 **「上传」** → 填版本号（如 `1.0.1-test.4`）和备注 → 上传为**体验版**。
3. 上传成功后，去 **微信公众平台（mp.weixin.qq.com）→ 管理 → 版本管理 → 体验版本**，确认体验版已生效。

### 0.2 准备 3 个微信测试账号
需要 3 个**真实微信号**（可用你自己的小号 / 家人号 / 同事号），在公众平台加入为**体验者**：
- **A = 需求方**（Requester）
- **B = 携带人**（Traveller/Carrier）
- **C = 管理员**（Admin/Reviewer）—— 就是 OpenID `o7dBp3UXAvKOsYsJnNq2TzTWN4G8` 那个账号

加入体验者路径：公众平台 → 管理 → 成员管理 → 体验者 → 添加（用微信号搜索添加）。

> 关键：3 个账号都必须在体验版里**各自登录过一次**（走小程序的 mock 登录），这样 `auth-login` 才会为每个账号建好 `users` 记录。管理员账号 C 之前已经登录过（`roleFlags` 已是 admin/reviewer）。

### 0.3 账号角色分配建议（同一台手机可切微信账号，或 3 台真机）
- 正常流程：A 发需求、B 发行程+报价、A 接单+支付、B 交接+送达、A 确认完成。
- 争议流程：A 发需求（或复用）、B 报价接单支付后，A 在送达前发起争议、C 登录后台 Mock 退款。

---

## 1. 正常流程：报价 → 支付 → 交接 → 送达 → 完成

> 全流程在任何一步卡住或报错，**立刻截图 + 记下当前页面**，先别重试，发给 WorkBuddy。

| 步骤 | 操作账号 | 在 App 里做什么 | 完成后应到的状态 | 需要记下的内容 |
|---|---|---|---|---|
| 1 | B（携带人） | 发布行程（Publish Trip）：路线、日期、容量≤5kg、选允许品类 | trips: 待审核 / 已审核 | 行程 ID（可选） |
| 2 | A（需求方） | 发布物品需求（Publish Item Request）：名称、品类（白名单）、申报价值≤¥2000、重量≤5kg、1–6 张图、勾选风险声明 | item_requests: 待审核 / 已审核 | 需求 ID（可选） |
| 3 | A 或 B | 匹配页搜索（Match）：用 tripId 或 requestId，确认出现匹配结果 | — | — |
| 4 | B | 从匹配结果发起报价（Offer）：服务费必须 >0 且 ≤¥500，文案注明“仅服务费” | offers: pending | 报价 ID（可选） |
| 5 | A | 需求详情里**接受报价**（Accept Offer） | orders: `pending_payment` | **orderId（必记）** |
| 6 | A | 支付页确认（Mock 支付）：看清显示“当前为模拟支付”、金额=服务费 | orders: `paid_locked`；payments 新增 1 条 | 支付金额（核对是否只含服务费） |
| 7 | A 或 B | 交接页：先上传交接证据（item_photo），完成勾选清单后扫确认码 | orders: `item_handed_to_carrier`；handover_records + 系统证据 | — |
| 8 | B | 推进：`in_transit` → `arrived`（到达） | orders: `arrived` | — |
| 9 | B | 上传送达照片/视频（delivery_photo_or_video），标记送达 | orders: `delivered` | — |
| 10 | A | 需求方确认完成（Confirm Completion） | orders: `completed`；自动生成 mutual_confirmation 证据 | — |

**正常流程结束，把下面发我：**
- `orderId`（步骤 5 记下的值）
- 是否出现任何报错/异常
- 支付金额（确认 payments 只记服务费）

---

## 2. 争议流程：上传证据 → 发起争议 → 管理员 Mock 退款

可另起一个新订单（重复 1.1–1.6 到 `paid_locked`），也可在已完成的订单上演示。建议用**新订单**走到 `item_handed_to_carrier` 或 `in_transit` 后发起争议，更接近真实。

| 步骤 | 操作账号 | 在 App 里做什么 | 完成后应到的状态 | 需要记下的内容 |
|---|---|---|---|---|
| 1 | A 或 B | 上传证据（Evidence）：选类型如 item_photo / delivery_photo_or_video，传图/视频（图≤5MB、视频≤20MB、≤6 个） | evidence 新增记录 | — |
| 2 | A（或 B） | 订单详情 → 发起争议（Dispute）：理由必填、描述必填，可先加证据 | orders: `disputed`；disputes 新增 1 条 | **disputeId（必记）** + orderId |
| 3 | C（管理员） | 管理员后台/审核页：查看争议、查看已审证据，作出裁决（refund 决定），二次确认 | disputes: 终态（refunded/resolved）；orders: `refunded`（如退款） | 裁决结果 |
| 4 | 系统 | Mock 退款：仅退服务费，生成退款记录 | payments/退款记录更新 | 退款金额（应=服务费） |

**争议流程结束，把下面发我：**
- `orderId`
- `disputeId`（步骤 2 记下的值）
- 管理员裁决结果与退款金额
- 是否出现任何报错/异常

---

## 3. 我拿到数据后会核对什么（验收判定项）

你把上面两组 `orderId` / `disputeId` / 报错发回后，WorkBuddy 会在 CloudBase 控制台侧核对：

1. **orders 最终状态与状态历史** —— 状态机是否按预期推进，历史是否连续无跳变。
2. **是否重复下单 / 重复支付** —— 同一 offer 双击接单只应生成 1 个订单；同笔支付重试只应生成 1 条 payments。
3. **payments 是否只记录服务费** —— 不含货款、不含平台抽成之外的项；provider=mock。
4. **证据是否齐全** —— 交接（handover_qr_scan / item_photo）、送达（delivery_photo_or_video）、完成（mutual_confirmation）等是否都在。
5. **disputes 裁决与 Mock 退款** —— 仅退服务费、裁决有二次确认、无并发双争议。
6. **audit_logs 覆盖度** —— 关键操作（建单、支付、交接、状态流转、争议、裁决）是否都有审计记录。
7. **云函数日志异常** —— order-transition / evidence-create / payment-confirm-mock / dispute-* 等是否有报错。

---

## 4. 常见坑提示

- 任何一步出现“网络异常 / cloud_unavailable”而实际网络正常，多半是云函数未部署或环境 ID 不对 —— 截图发我。
- 支付页如果显示的金额不是服务费、或允许你改金额，说明前端越权 —— 立刻停，发我。
- 争议页如果非管理员也能看到“裁决/退款”按钮，说明权限校验有问题 —— 立刻停，发我。
- 重复点击“接受报价 / 支付”时，订单和支付应各只生成一条（幂等），可故意快速点两次验证。
