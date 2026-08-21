# 线上验收交接（本地已完成 → 线上可验收）

> 以下为转发给线上环境负责人 / 部署运维的指令。本地侧（commit、tag、索引定义、权限文档、管理员初始化脚本）已全部就绪，待线上推进。

---

请继续完成以下事项：

1. 将 `main` 的提交 `ca9c924` 推送到 `origin/main`，并推送 Tag `v1.0.1-test.4`。
2. 对线上环境 `luggage-d1ghv33fy2cb9ef96` 依次运行：
   - `npm run cloudbase:check`
   - `npm run cloudbase:apply`
   - 再次运行 `npm run cloudbase:check`
3. 确认新增的 4 个索引已经在线上生效，尤其是 `messages_conversation_moderation_created`。
4. 在控制台逐项确认关键集合为「仅管理端可读写」，并记录检查结果。
5. 我提供管理员 OpenID 后，运行 `bootstrap-admin.js`，确认该用户的 `roleFlags` 包含 `admin` 和 `reviewer`。
6. 核对 33 个云函数的线上部署状态，特别确认 `order-transition`、`evidence-create` 是当前提交对应版本。
7. 提交最终验收报告：推送结果、线上索引检查结果、权限结果、管理员初始化结果、仍需人工真机验证的项目。

⚠️ 不要把 `cloudbase:plan` 当成线上检查结果（plan 仅本地离线校验，check 才是线上真实查询）。

需要我提供什么告诉我。

---

## 本地已就绪（供线上负责人信任的事实）

| 项 | 状态 |
| --- | --- |
| `main` HEAD | `ca9c924` — 「MVP test build: complete CloudBase index plan, document collection permissions, add admin bootstrap」 |
| Test Tag | `v1.0.1-test.4`（本地已建，待推送） |
| 新增索引（4 个） | `messages_conversation_moderation_created`、`orders_requester_updated`、`orders_traveller_updated`、`orders_offer`（定义见 `scripts/setup-cloudbase.js`） |
| 关键集合权限 | 文档已给出「仅管理端可读写」建议（`docs/setup/cloudbase-setup.md`）；控制台仍需人工确认 |
| 管理员初始化 | `scripts/bootstrap-admin.js` 已就绪，待 OpenID |
| 校验 | `check:files` / `check:idempotency` / `check:mutations` / `check:workflow` / `typecheck` / `cloudbase:plan` 全部通过 |
| 本地云函数 | 代码与 2026-08-06 重新部署的 `evidence-create`、`order-transition` 一致 |

> 备注：`.workbuddy/` 为助手本地记忆目录，未纳入本次提交。
