# wzt.hk Personal Knowledge Base — Project Status

> 长期工程状态看板。每次完成一个阶段后更新。
> 详细设计见 `../workspace/goals/wzt-hk-personal-knowledge-base/files/01-step1-project-discovery.md`（Muse 工作区）。

## Current phase

**Phase 2 — 离线 pipeline v1**（进行中）
目标：快照 → GLM 6 阶段抽取 → 校验 → 入库的离线 pipeline 脚手架，本地 SQLite 验证通过。

## Completed

- [x] **Phase 0 — Project Discovery**（2026-10-07）
  - 勘察现有架构：Astro 7 + Cloudflare Workers + D1 + R2 + Cloudflare Images；AI 现状走 DeepSeek（`src/server/ai.ts`），仅写作辅助、无队列、无 Agent 页。
  - 架构决策：继续 D1；KB 以 `kb_*` overlay 表实现；重型 AI 全部离线（VM + GLM）；向量库选 Cloudflare Vectorize；AI 产物保留 raw source + 版本可重跑。
- [x] **Phase 1 — KB schema**（2026-10-07）
  - `migrations/0015_kb_overlay.sql`：9 张表（`kb_sources` / `kb_entities` / `kb_entity_aliases` / `kb_relations` / `kb_knowledge_items` / `kb_timex` / `kb_chunks` + FTS5 / `kb_jobs` / `kb_media` 骨架）。
  - 本地 sqlite3 验证通过（建表、FTS5 触发器、外键）。
  - PR #3：`feature/kb-overlay-schema` → `main`（待 review，不合 main、不部署）。

## In progress

- [ ] Phase 2 pipeline 脚手架：`scripts/kb/`（snapshot / extract 6 阶段 / validate / run）
- [ ] GLM 小样本冒烟测试（1–2 篇 kb_notes 级别样本，验证 prompts 有效）

## Next

- Phase 2（续）：预览 D1 小批量回填验证 → 需要 Cloudflare wrangler 登录（Level C，届时索取）
- Phase 3：Entity resolution + KB 后台管理页（merge / edit / rerun / failed 列表）
- Phase 4：混合搜索（FTS5 + Vectorize + 结构化过滤）→ 需确认开通 Vectorize（Level B）
- Phase 5：RAG 问答 + Agent 页面 → 需确认在线模型/key（Level B）
- Phase 6：Media ingestion（R2 EXIF → `kb_media`，vision 描述试点）→ 需 NAS/照片源信息（Level C）

## Blocked

无。当前所有工作均可在 feature branch + 本地环境完成。

## Architecture decisions

- ADR-1：继续 D1（SQLite），不迁 PostgreSQL——未达瓶颈。
- ADR-2：KB 以 `kb_*` overlay 表实现，不修改现有业务表——最小侵入。
- ADR-3：重型 AI 全部离线（VM + GLM），Worker 只读——避免请求超时与成本失控。
- ADR-4：向量库选 Cloudflare Vectorize（原生、免运维）——备选 D1 BLOB 穷举。
- ADR-5：所有 AI 产物保留 raw source + model + 版本 + confidence——可重跑。
- ADR-6：时间存 ISO 8601 + precision，不确定的不编造。
- ADR-7：生产 D1 写入/migration 必须经用户明确确认；先预览环境验证。

## Migration status

| Migration | 内容 | 状态 |
|---|---|---|
| 0001–0014 | 现有业务表 | 已在生产/预览 D1 应用（历史） |
| 0015 | `kb_*` overlay（9 表 + FTS5） | PR #3 待 review；**未应用到任何 D1** |

## Production actions pending（Level B，需用户确认）

- （无）Phase 1 的 migration 尚未申请生产执行；按流程先在预览 D1 验证（Phase 2 需要 wrangler 登录后进行）。
