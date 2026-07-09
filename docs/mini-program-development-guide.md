# 帮带平台微信小程序开发文档 v0.1

> 项目：Luggage Courier Service / 跨境顺路帮带微信小程序  
> 阶段：MVP 开发设计  
> 目标：为前端、云函数、数据库、审核、订单、证据和争议流程提供可执行的开发基础  
> 核心原则：低值、低频、低风险、强审核、强留痕、持牌支付服务商、平台不托管商品货款

## 1. 产品定位

本项目是一个面向跨境顺路帮带场景的微信小程序。A 作为携带人发布真实跨境行程，B 作为需求方发布低风险物品帮带需求，平台负责实名、审核、撮合、订单状态、服务费支付接口、交接证据、争议处理和评价体系。

平台边界必须保持清晰：

- 不是代购平台：A 不负责替 B 购买商品。
- 不是物流/快递平台：平台不承诺运输时效、通关结果或门到门配送。
- 不是报关/清关服务：平台不替代海关申报、纳税或用户个人法律责任。
- 不是跨境支付/资金池：平台不托管商品货款，不自行沉淀用户资金。
- MVP 只允许低价值、低重量、低风险、强审核的小件物品。

## 2. MVP 范围

### 2.1 首期目标

- 跑通 A 发布行程、B 发布需求、平台审核、双方匹配、确认订单、交接留痕、到达交付、评价和争议的完整闭环。
- 先覆盖中国 ↔ 澳大利亚方向的低风险个人小件。
- 所有高风险物品默认拒绝，不做“什么都能带”的开放发布。
- 支付部分先做状态机、接口抽象和 Mock，不实现真实资金托管、自动放款或平台资金池。

### 2.2 首期不做

- 不做 A 代买商品。
- 不做商品货款托管。
- 不做大额奢侈品、药品、食品、烟酒、动植物制品、现金、贵金属、商业批量货物。
- 不做真实保险或全额包赔。
- 不做海关规则自动裁决，只做规则提示、证据留存和人工审核。

## 3. 推荐技术方案

| 层级 | 推荐方案 |
|---|---|
| 小程序框架 | 微信小程序原生或 TDesign Mini Program 组件体系 |
| UI 组件 | TDesign Mini Program |
| 后端 | 微信云开发 CloudBase 云函数 |
| 数据库 | CloudBase 数据库 |
| 文件存储 | CloudBase 云存储 |
| 登录 | 微信登录 + 手机号绑定 + 后续第三方实名服务 |
| 支付 | 微信支付/服务商支付接口抽象；MVP 先使用 Mock |
| 地图/位置 | 腾讯地图小程序 SDK，首期仅用于交接地点展示和定位辅助 |
| 管理后台 | MVP 可先用云开发 CMS / 简易 Web Admin；后续独立后台 |

## 4. 小程序信息架构

### 4.1 底部导航

| Tab | 页面 | 说明 |
|---|---|---|
| 首页 | `pages/home/index` | 展示行程/需求入口、推荐匹配、审核提示 |
| 行程 | `pages/trips/index` | A 发布和管理行程，B 浏览可匹配行程 |
| 需求 | `pages/requests/index` | B 发布和管理物品需求，A 浏览可接需求 |
| 订单 | `pages/orders/index` | 双方查看订单、状态、证据和争议 |
| 我的 | `pages/profile/index` | 资料、实名、信用、设置、帮助与规则 |

### 4.2 核心页面清单

| 模块 | 页面路径 | 优先级 | 说明 |
|---|---|---|---|
| 登录 | `pages/auth/index` | P0 | 微信登录、手机号绑定、协议确认 |
| 实名 | `pages/verification/index` | P0 | 实名状态展示，MVP 可先 Mock |
| 首页 | `pages/home/index` | P0 | 发布入口、待处理事项、推荐卡片 |
| 发布行程 | `pages/trips/create` | P0 | A 填写路线、时间、航班、容量、品类 |
| 行程详情 | `pages/trips/detail` | P0 | 行程信息、可接受品类、报价入口 |
| 发布需求 | `pages/requests/create` | P0 | B 填写物品、价值、照片、交接信息 |
| 需求详情 | `pages/requests/detail` | P0 | 需求信息、审核状态、报价列表 |
| 匹配列表 | `pages/matches/index` | P0 | 按路线、时间、品类和容量展示匹配 |
| 报价 | `pages/offers/create` | P0 | A 对需求报价或 B 选择 A |
| 订单详情 | `pages/orders/detail` | P0 | 状态机、费用、证据、聊天、操作 |
| 交接确认 | `pages/handover/index` | P0 | 二维码、扫码确认、照片/视频上传 |
| 支付确认 | `pages/payment/index` | P0 | Mock 支付、费用明细、风险确认 |
| 证据上传 | `pages/evidence/upload` | P0 | 上传照片、视频、证明文件 |
| 争议中心 | `pages/disputes/detail` | P0 | 发起争议、补充证据、查看裁决 |
| 评价 | `pages/ratings/create` | P1 | 双方评分、标签、评价 |
| 规则中心 | `pages/rules/index` | P1 | 允许清单、禁止清单、责任说明 |
| 消息 | `pages/messages/index` | P1 | 订单系统通知，聊天可后置 |

## 5. 用户角色与权限

| 角色 | 权限 |
|---|---|
| 未登录用户 | 浏览规则、查看基础说明，不能发布、报价或下单 |
| 普通用户 | 可完善资料、申请实名、查看公开行程/需求 |
| 携带人 A | 可发布行程、浏览需求、报价、交接确认、上传证据 |
| 需求方 B | 可发布需求、选择报价、支付服务费、交接确认、上传证据 |
| 平台运营 | 审核物品、处理争议、限制用户、维护品类规则 |
| 管理员 | 管理运营账号、风控规则、支付配置、审计日志 |

同一个用户可以同时是 A 和 B，但同一订单内角色必须固定。

## 6. 核心业务流程

### 6.1 A 发布行程

1. 用户完成登录和基础实名状态检查。
2. 填写出发国家/城市/机场，到达国家/城市/机场。
3. 填写出发时间、到达时间、航班号或交通信息。
4. 填写可用重量、可用体积、可接受品类、不可接受品类、交接偏好。
5. 系统校验时间、路线、容量和品类。
6. 行程进入 `active` 或 `pending_verification` 状态。

关键限制：

- 不允许“什么都能带”。
- 航班证明在 MVP 可选，但订单确认前建议要求补充。
- 不在前端日志或数据库明文字段中保存证件敏感信息。

### 6.2 B 发布物品需求

1. 用户完成登录和基础实名状态检查。
2. 填写物品名称、品类、数量、申报价值、重量、尺寸。
3. 上传物品照片：正面、背面、包装、标签、数量整体照。
4. 填写取件地、交付地、期望到达时间。
5. 勾选风险声明和海关/税费责任确认。
6. 系统先进行正面清单和禁止清单校验。
7. 需求进入 `pending_review`，等待人工或规则审核。

关键限制：

- 默认只允许正面清单品类。
- 不确定品类进入人工审核。
- 禁止清单命中时直接拒绝或要求重新提交。

### 6.3 匹配与报价

匹配优先级：

1. 路线同向。
2. 时间窗口兼容。
3. 物品已通过审核。
4. 品类在 A 接受范围内。
5. 重量/体积不超过 A 可用容量。
6. 交接地点可接受。
7. 双方信用、完成率和争议率符合风控要求。
8. 价格区间接近。

MVP 推荐先使用确定性评分函数，不使用黑盒模型：

```text
score = routeScore + dateScore + categoryScore + capacityScore + locationScore + trustScore + priceScore - riskPenalty
```

所有匹配结果必须可解释，例如展示“路线一致、时间匹配、物品已审核、容量满足”。

### 6.4 订单确认

订单确认前双方必须确认：

- 物品信息、数量、照片和申报价值。
- 帮带服务费和平台服务费。
- 税费承担规则。
- 取消规则。
- 交接时间地点。
- 证据要求。
- 禁止站外交易和虚假申报提示。

### 6.5 支付与费用

MVP 只实现支付接口抽象和 Mock 状态，不实现真实资金托管。

费用结构：

```text
B 支付金额 = 帮带服务费 + 平台服务费
```

开发约束：

- 支付创建、回调验证、退款、放款都必须在云函数中处理。
- 前端不得保存商户号、API Key、证书、AppSecret 等密钥。
- `paid_locked` 在 MVP 中可由 Mock 云函数模拟。
- 真实支付上线前必须确认微信支付商户、服务商方案、分账能力、法务和结算规则。

### 6.6 交接与证据

交接分两次：

- 出发地交接：B 把物品交给 A。
- 目的地交付：A 把物品交给 B 或指定接收人。

每次交接必须包含：

- 二维码扫码确认。
- 双方确认记录。
- 时间戳。
- 交接照片或视频。
- 物品外观、数量和包装照片。
- 可选定位信息。

证据只能新增，不能覆盖。误传或补充证据也必须创建新记录。

### 6.7 争议处理

任一方可在订单活跃阶段发起争议。争议发起后：

1. 订单进入 `disputed`。
2. 未放款资金保持冻结或 Mock 冻结状态。
3. 双方在限定时间内补充证据。
4. 平台运营查看订单时间线、聊天、交接记录、支付记录和证明材料。
5. 平台给出处理结果：继续履约、退款、放款、部分处理、关闭争议。
6. 所有处理动作写入审计日志。

## 7. 订单状态机

小程序和云函数必须使用统一状态值：

| 状态 | 含义 | 主要动作 |
|---|---|---|
| `draft` | 草稿 | 编辑、删除、提交审核 |
| `pending_review` | 待审核 | 平台审核、补充资料、拒绝 |
| `approved` | 审核通过 | 匹配、报价、确认条款 |
| `pending_payment` | 待支付 | 创建支付、取消 |
| `paid_locked` | 服务费已锁定 | 等待交接、申请取消 |
| `item_handed_to_carrier` | 出发地已交接 | 上传证据、开始在途 |
| `in_transit` | 携带在途 | 状态更新、异常申报 |
| `arrived` | 已到达目的地 | 安排交付 |
| `delivered` | 已交付待确认 | B 确认、发起争议 |
| `completed` | 已完成 | 放款/Mock 放款、评价 |
| `disputed` | 争议中 | 补证、平台裁决 |
| `cancelled` | 已取消 | 记录原因、释放资源 |
| `refunded` | 已退款 | 记录退款来源和原因 |

核心流转：

```text
draft -> pending_review -> approved -> pending_payment -> paid_locked
paid_locked -> item_handed_to_carrier -> in_transit -> arrived -> delivered -> completed
active_state -> disputed
pre_handover_state -> cancelled/refunded
```

非法状态流转必须由云函数拒绝，前端只负责展示可用动作。

## 8. 数据库集合设计

### 8.1 `users`

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 用户 ID |
| `openid` | string | 微信 openid |
| `unionid` | string | 可选 |
| `nickname` | string | 昵称 |
| `avatarUrl` | string | 头像 |
| `phoneMasked` | string | 脱敏手机号 |
| `roleFlags` | array | `traveller`, `requester` |
| `verificationStatus` | string | `unverified`, `pending`, `verified`, `rejected` |
| `ratingAvg` | number | 平均评分 |
| `completedOrders` | number | 完成订单数 |
| `disputeCount` | number | 争议次数 |
| `riskLevel` | string | `low`, `medium`, `high`, `blocked` |
| `createdAt` | date | 创建时间 |
| `updatedAt` | date | 更新时间 |

### 8.2 `trips`

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 行程 ID |
| `travellerId` | string | A 用户 ID |
| `fromCountry` | string | 出发国家 |
| `fromCity` | string | 出发城市 |
| `fromAirportOrStation` | string | 出发机场/车站 |
| `toCountry` | string | 到达国家 |
| `toCity` | string | 到达城市 |
| `toAirportOrStation` | string | 到达机场/车站 |
| `departureTime` | date | 出发时间 |
| `arrivalTime` | date | 到达时间 |
| `flightNo` | string | 航班号 |
| `luggageCapacityKg` | number | 可用重量 |
| `acceptableCategories` | array | 可接受品类 |
| `unacceptableCategories` | array | 不接受品类 |
| `handoverPreference` | string | 交接偏好 |
| `status` | string | `draft`, `active`, `matched`, `expired`, `cancelled` |
| `createdAt` | date | 创建时间 |

### 8.3 `item_requests`

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 需求 ID |
| `requesterId` | string | B 用户 ID |
| `itemName` | string | 物品名称 |
| `category` | string | 品类 |
| `quantity` | number | 数量 |
| `declaredValue` | number | 申报价值 |
| `currency` | string | 币种 |
| `estimatedWeightKg` | number | 预估重量 |
| `estimatedSize` | object | 长宽高 |
| `purchaseMethod` | string | 自有/已购买/其他 |
| `pickupLocation` | object | 出发地交接地点 |
| `deliveryLocation` | object | 目的地交付地点 |
| `deadline` | date | 最晚送达时间 |
| `itemPhotos` | array | 图片 fileId |
| `riskFlags` | array | 风险标签 |
| `reviewStatus` | string | `pending`, `approved`, `rejected`, `need_info` |
| `reviewReason` | string | 审核说明 |
| `riskDeclarationAccepted` | boolean | 风险声明 |
| `createdAt` | date | 创建时间 |

### 8.4 `offers`

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 报价 ID |
| `requestId` | string | 需求 ID |
| `tripId` | string | 行程 ID |
| `travellerId` | string | A 用户 ID |
| `serviceFeeQuote` | number | 帮带服务费 |
| `currency` | string | 币种 |
| `message` | string | 报价说明 |
| `conditions` | string | 条件 |
| `status` | string | `pending`, `accepted`, `rejected`, `expired`, `cancelled` |
| `expiresAt` | date | 过期时间 |

### 8.5 `orders`

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 订单 ID |
| `requestId` | string | 需求 ID |
| `offerId` | string | 报价 ID |
| `tripId` | string | 行程 ID |
| `travellerId` | string | A 用户 ID |
| `requesterId` | string | B 用户 ID |
| `status` | string | 订单状态 |
| `feeBreakdown` | object | 服务费、平台费、通道费 |
| `taxRule` | object | 税费承担规则 |
| `cancellationRule` | object | 取消规则 |
| `evidenceRequired` | array | 必需证据 |
| `currentRiskLevel` | string | 当前风险等级 |
| `createdAt` | date | 创建时间 |
| `updatedAt` | date | 更新时间 |

### 8.6 `payments`

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 支付 ID |
| `orderId` | string | 订单 ID |
| `provider` | string | `mock`, `wechat_pay`, `service_provider` |
| `providerPaymentId` | string | 第三方支付单号 |
| `amount` | number | 金额 |
| `currency` | string | 币种 |
| `paymentStatus` | string | `created`, `paid`, `failed`, `closed` |
| `lockStatus` | string | `none`, `locked`, `released`, `refunded` |
| `refundStatus` | string | `none`, `requested`, `refunded`, `failed` |
| `createdAt` | date | 创建时间 |

### 8.7 `evidence`

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 证据 ID |
| `orderId` | string | 订单 ID |
| `uploaderId` | string | 上传人 |
| `evidenceType` | string | 证据类型 |
| `fileIds` | array | 云存储文件 |
| `description` | string | 说明 |
| `visibility` | string | `both_parties`, `admin_only` |
| `metadata` | object | 时间、定位、设备、扫码信息 |
| `createdAt` | date | 上传时间 |

### 8.8 `disputes`

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 争议 ID |
| `orderId` | string | 订单 ID |
| `openedBy` | string | 发起人 |
| `reason` | string | 原因 |
| `description` | string | 描述 |
| `evidenceIds` | array | 证据 ID |
| `status` | string | `open`, `waiting_evidence`, `reviewing`, `decided`, `closed` |
| `decision` | object | 裁决结果 |
| `createdAt` | date | 创建时间 |
| `closedAt` | date | 关闭时间 |

### 8.9 `audit_logs`

| 字段 | 类型 | 说明 |
|---|---|---|
| `_id` | string | 日志 ID |
| `actorId` | string | 操作人 |
| `actorRole` | string | 用户/运营/系统 |
| `targetType` | string | 目标类型 |
| `targetId` | string | 目标 ID |
| `action` | string | 操作 |
| `before` | object | 变更前 |
| `after` | object | 变更后 |
| `createdAt` | date | 创建时间 |

## 9. 云函数设计

| 云函数 | 说明 | 优先级 |
|---|---|---|
| `auth.login` | 微信登录、创建/更新用户 | P0 |
| `user.updateProfile` | 更新基础资料 | P0 |
| `verification.submitMock` | MVP 实名 Mock 提交 | P0 |
| `trip.create` | 创建行程 | P0 |
| `trip.update` | 更新行程 | P0 |
| `trip.list` | 行程列表和筛选 | P0 |
| `itemRequest.create` | 创建需求 | P0 |
| `itemRequest.review` | 运营审核需求 | P0 |
| `itemRequest.list` | 需求列表和筛选 | P0 |
| `match.search` | 匹配行程与需求 | P0 |
| `offer.create` | 创建报价 | P0 |
| `offer.accept` | 接受报价并生成订单 | P0 |
| `order.get` | 获取订单详情 | P0 |
| `order.transition` | 订单状态流转 | P0 |
| `payment.createMock` | 创建 Mock 支付 | P0 |
| `payment.confirmMock` | 确认 Mock 支付并进入 `paid_locked` | P0 |
| `evidence.uploadToken` | 获取上传授权/参数 | P0 |
| `evidence.create` | 创建证据记录 | P0 |
| `handover.createQr` | 创建交接二维码 | P0 |
| `handover.confirmScan` | 扫码确认交接 | P0 |
| `dispute.open` | 发起争议 | P0 |
| `dispute.addEvidence` | 争议补充证据 | P0 |
| `dispute.decide` | 运营裁决 | P0 |
| `rating.create` | 创建评价 | P1 |
| `notification.send` | 发送站内通知 | P1 |

云函数规则：

- 所有写操作必须校验登录态和用户角色。
- 所有订单状态变更必须写入 `audit_logs`。
- 所有支付相关函数必须只存在于云函数，不允许前端直接调用支付密钥。
- 管理员/运营函数必须做 RBAC 校验。

## 10. 前端组件设计

| 组件 | 说明 |
|---|---|
| `RouteSelector` | 国家、城市、机场/车站选择 |
| `DateTimeRangePicker` | 出发/到达时间选择 |
| `CategoryWhitelistPicker` | 正面清单品类选择 |
| `RiskWarningPanel` | 禁限品、海关、税费提示 |
| `PhotoUploader` | 多图上传、预览、删除 |
| `FeeBreakdown` | 帮带费、平台费、总额展示 |
| `OrderStatusTimeline` | 订单状态时间线 |
| `EvidenceList` | 证据列表 |
| `QrConfirmPanel` | 交接二维码和扫码确认 |
| `DisputePanel` | 争议状态、补证入口、裁决结果 |
| `TrustBadge` | 实名、评分、完成率、争议率展示 |

## 11. 校验与风控规则

### 11.1 发布行程校验

- 出发时间必须早于到达时间。
- 行程时间不能早于当前时间。
- 可用重量必须大于 0，且低于平台上限。
- 必须选择至少一个可接受品类。
- 不允许填写“都可以”“什么都能带”等泛化描述。

### 11.2 发布需求校验

- 物品必须在正面清单内。
- 申报价值、重量、数量必须低于 MVP 上限。
- 必须上传至少一张物品照片。
- 必须确认风险声明。
- 命中禁止关键词时禁止提交或进入人工审核。

### 11.3 订单风控

- 未实名用户不能进入订单确认。
- 高风险用户不能报价或下单。
- 同一用户每日/每月订单数量应有限制。
- 同路线、同物品、同金额的重复订单应触发审核。
- 争议率过高用户应限制功能。

## 12. 物品品类规则

### 12.1 MVP 正面清单

- 普通服饰鞋帽。
- 普通书籍、教材、纸质学习资料。
- 文具、小礼品、普通摆件。
- 不含电池的 3C 配件。
- 非液体、非粉末、非药品、非食品的普通小件日用品。

### 12.2 默认禁止清单

- 食品、饮品、农产品、生鲜、肉蛋奶、种子、蜂蜜。
- 药品、保健品、医疗器械、处方药。
- 液体、粉末、喷雾、香水、化妆水。
- 烟酒、电子烟、烟油、尼古丁制品。
- 现金、银行卡、证券、黄金、珠宝、贵金属。
- 奢侈品、高价值电子产品、商业批量货物。
- 动植物及制品、木制品、羽毛、贝壳、皮草、标本。
- 危险品、武器、刀具、仿真枪、电池、磁铁、化学品。
- 仿冒、盗版、侵权商品。

## 13. 安全与隐私

- 不在前端保存任何密钥。
- 不在日志中输出 openid、手机号、证件号、支付单号原文。
- 手机号、身份证明、地址、航班证明等敏感信息应脱敏展示。
- 云存储文件必须按订单和用户权限控制访问。
- 管理后台必须启用操作审计。
- 证据文件不得被用户覆盖或删除，只能追加。
- 支付回调必须服务端验签。
- 小程序端所有提交都必须在云函数再次校验。

## 14. 管理后台需求

MVP 至少需要以下后台能力：

- 用户列表、实名状态、风险等级。
- 行程列表和异常行程标记。
- 物品需求审核：通过、拒绝、要求补充资料。
- 禁止清单和正面清单配置。
- 订单列表、订单状态时间线。
- 证据查看。
- 争议处理和裁决记录。
- 用户限制、封禁、解除限制。
- 审计日志查询。

后台可以先用 CloudBase CMS 或简易 Web Admin 实现，不一定放在微信小程序内。

## 15. 项目目录建议

```text
.
├── miniprogram/
│   ├── app.json
│   ├── app.ts
│   ├── app.wxss
│   ├── pages/
│   ├── components/
│   ├── services/
│   ├── utils/
│   └── assets/
├── cloudfunctions/
│   ├── auth/
│   ├── user/
│   ├── trip/
│   ├── itemRequest/
│   ├── match/
│   ├── offer/
│   ├── order/
│   ├── payment/
│   ├── evidence/
│   ├── handover/
│   └── dispute/
├── docs/
│   ├── mini-program-development-guide.md
│   ├── architecture/
│   └── setup/
├── .agents/
│   └── skills/
├── project.config.json
├── package.json
└── AGENTS.md
```

## 16. 开发里程碑

### Milestone 1：项目骨架

- 初始化微信小程序项目。
- 接入 TDesign Mini Program。
- 配置 CloudBase 环境占位。
- 建立页面路由和基础主题。
- 建立云函数调用封装。

### Milestone 2：用户与发布流程

- 微信登录和用户资料。
- A 发布行程。
- B 发布需求。
- 物品正面清单和禁止清单校验。
- 图片上传到云存储。

### Milestone 3：审核、匹配与报价

- 需求审核状态。
- 匹配列表。
- A 报价。
- B 接受报价。
- 生成订单。

### Milestone 4：订单、支付 Mock 与交接

- 订单状态机。
- Mock 支付。
- 交接二维码。
- 扫码确认。
- 证据上传。

### Milestone 5：争议、评价与运营后台

- 争议发起和补证。
- 运营裁决接口。
- 评价体系。
- 基础管理后台。
- 审计日志。

## 17. 测试重点

| 类型 | 测试内容 |
|---|---|
| 单元测试 | 品类校验、匹配评分、订单状态机、费用计算 |
| 云函数测试 | 权限校验、非法状态流转、支付 Mock、证据创建 |
| 集成测试 | 发布需求到完成订单全流程 |
| 风控测试 | 禁止品类、超额价值、重复订单、高争议用户 |
| UI 测试 | 表单校验、错误提示、状态时间线、上传失败 |
| 安全测试 | 越权访问、文件访问权限、敏感字段泄露 |

## 18. 文案约束

小程序内不得出现以下承诺：

- “什么都能带”
- “保证通关”
- “海关无忧”
- “平台全额包赔”
- “比快递更安全”
- “官方托管商品货款”
- “自动放款/平台资金池”
- “代购全流程”

推荐使用更克制的表达：

- “受限品类顺路帮带”
- “平台内留痕”
- “低风险小件”
- “费用由持牌服务商处理”
- “通关和税费以海关要求为准”
- “争议依据平台内证据处理”

## 19. 待确认事项

- 第一阶段只做中国到澳大利亚，还是中澳双向。
- 微信小程序 AppID。
- CloudBase 环境 ID。
- 是否采用原生小程序 + TDesign，还是使用 Taro/uni-app。
- 实名认证供应商和实名等级。
- 支付服务商方案、分账能力和延迟结算能力。
- 单笔物品价值、重量、尺寸、数量上限。
- 平台服务费计算方式。
- 是否建设独立 Web 管理后台。
- MVP 是否开放给全部用户，还是邀请码/白名单试运营。

## 20. 开发原则

- 先跑通受控闭环，再扩展品类和路线。
- 所有风险判断后端再校验，前端校验只做用户体验。
- 所有关键行为写审计日志。
- 所有证据只能追加，不能覆盖。
- 所有支付和放款逻辑先 Mock，真实接入必须等待合规确认。
- 宁可拒绝不确定物品，也不要默认放行。
- 小程序页面要让用户清楚知道平台边界，而不是把平台包装成物流、代购或通关保证服务。

## 21. 当前开发进度

### 21.1 已完成

- 初始化微信小程序项目配置、TypeScript 配置和基础依赖。
- 创建小程序全局样式、首页、行程、需求、订单、我的、规则页面。
- 实现发布行程表单和发布需求表单的前端校验。
- 建立正面清单、禁止清单提示、订单状态机和费用计算工具。
- 实现订单详情、Mock 支付、交接确认、证据上传和争议提交页面。
- 创建 CloudBase 云函数占位：登录、创建行程、创建需求、订单状态流转、Mock 支付、证据创建、交接确认和争议发起。
- 实现报价和匹配基础链路：行程详情、需求详情、匹配列表、创建报价、接受报价并生成待支付订单。
- 新增云函数占位：匹配搜索、创建报价、接受报价、读取订单。
- 所有支付相关逻辑均保持 Mock 或接口占位，未实现真实托管、自动放款或平台资金池。

### 21.2 下一步

- 接入真实 CloudBase 环境 ID，并在微信开发者工具中编译预览。
- 将 Mock 订单替换为云数据库读取。
- 增加订单状态变更按钮和服务端状态同步。
- 接入云存储真实上传流程，保存 fileId 到 `evidence` 集合。
- 建设最小运营审核后台或 CloudBase CMS 配置。
