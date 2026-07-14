# wzt.hk

一个可自托管的私人入口网站，用于管理知识笔记、旅行计划和常用链接。知识库与链接使用 Markdown / JSON；Travel 使用 SQLite 和服务器图片存储，并提供受保护的网页管理端。

## Project conventions

- Commit messages and push-related notes should be written in English.
- README and long-lived project documentation should prefer English.

## Runtime data sync

Runtime data is intentionally not committed to Git:

```text
data/wzt.db
data/media/
backups/
```

Use GitHub for source code and use SSH/rsync for server data.

Configure the server in `.env`:

```env
SYNC_HOST=example.com
SYNC_USER=wzt
SYNC_PORT=22
SYNC_PATH=/var/www/wzt.hk
```

Pull production data to local:

```bash
npm run data:pull
```

Push local data to the server:

```bash
npm run data:push
```

Both scripts create a SQLite backup before replacing the database. Media files are synchronized with `rsync --delete`, so the target mirrors the source.

## 本地运行

```bash
npm install
npm run admin:password -- "用于本地测试的长密码"
```

将生成结果填入 `.env` 的 `ADMIN_PASSWORD_HASH`，再运行 `npm run dev`。管理端位于 `/admin`。

提交或部署前运行：

```bash
npm run check
npm run build
```

服务端构建位于 `dist/`，通过 `npm start` 运行。生产部署见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 内容位置

```text
src/content/kb/       知识库 Markdown
src/content/travel/   旅行种子内容（首次初始化数据库）
data/wzt.db           运行时 Travel 数据库（不提交 Git）
data/media/           原图与网页图片（不提交 Git）
src/data/links.json   常用链接
src/data/kb-categories.json  知识库分类
src/data/site.json    站点基础信息
```

文件名就是页面地址。例如：

```text
src/content/kb/local-first-content.md
→ /kb/local-first-content/
```

建议文件名只使用小写英文字母、数字和连字符。

## 新建知识库笔记

在 `src/content/kb/` 新建 Markdown 文件：

```md
---
title: 笔记标题
summary: 一句话摘要
category: development
tags: [Astro, Web]
createdAt: 2026-07-07
updatedAt: 2026-07-07
draft: false
featured: false
---

正文从这里开始。
```

分类值来自 `src/data/kb-categories.json`。`draft: true` 的内容不会生成公开页面。

## 新建旅行计划

服务器版中，现有 Markdown 会在空数据库首次启动时导入。之后地点、交通、餐饮、住宿、事件与照片通过 `/admin` 管理并立即反映到公开页面。下面的文件格式仍作为种子数据和可移植内容格式保留。

每段旅行使用一个目录。`index.md` 保存整段旅行的信息，每天一个 Markdown 文件：

```text
src/content/travel/taiwan-2024/
├── index.md
├── days/
│   ├── 2024-03-26.md
│   └── 2024-03-27.md
└── media/
    └── 2024-03-26/
        └── liberty-square/
```

`index.md`：

```md
---
title: 旅行标题
destination: 国家或城市
status: planning
startDate: 2026-10-01
endDate: 2026-10-05
summary: 一句话摘要
pendingItems:
  - 确认交通
  - 预订酒店
updatedAt: 2026-07-08
draft: false
featured: false
---

## 交通

## 酒店

## 预算

## 备注
```

`status` 只能是 `upcoming`、`planning` 或 `archived`。

每日文件以时间线模块保存行程：

```md
---
trip: taiwan-2024
date: 2024-03-26
city: 台北
title: 抵达台北
events:
  - id: hong-kong-to-taoyuan
    type: transit
    title: 香港 → 台北桃园
    method: flight
    from: 香港国际机场
    to: 桃园国际机场
  - id: liberty-square
    type: place
    title: 自由广场
    location: { lat: 25.0361, lng: 121.5183 }
---
```

事件类型包括：

- `place`：景点、街区和商店
- `transit`：航班、火车、地铁等移动
- `meal`：餐厅、咖啡和小吃
- `stay`：酒店与住宿
- `note`：其他记录

除 `id`、`type` 和 `title` 外，大多数字段都是可选的。填写坐标后，该地点会进入当天地图；地图连线只表达访问顺序。

### 添加照片

照片建议按“日期 / 地点 ID”存放。原始大图继续保存在照片库或 NAS，网站目录只放适合网页浏览的副本：

```text
src/content/travel/taiwan-2024/media/2024-03-26/liberty-square/001.jpg
```

在对应事件中引用一次：

```yaml
  - id: liberty-square
    type: place
    title: 自由广场
    photos:
      - src: ../media/2024-03-26/liberty-square/001.jpg
        alt: 自由广场牌楼
        caption: 抵达台北后的第一站
        featured: true
```

路径从 `days/*.md` 出发，所以使用 `../media/`。构建时会自动生成适合网页的图片；地点预览、当天分组和整段行程相册都引用同一张源文件，不需要复制照片。

## 管理链接

编辑 `src/data/links.json`。每条记录需要唯一的 `id`，分类只能是：

```text
AI / Dev / Study / Travel / Storage / Finance / Tools
```

`private: true` 只会显示一个“私人”标签，并不会提供访问控制。任何写入公开构建的地址都可能被访问，不要保存密码、Token 或其他敏感信息。

## 面向未来 Agent

内容结构由 `src/content.config.ts` 统一校验。未来的本地 Agent 应只修改 `src/content/` 与 `src/data/` 中的内容文件，并在修改后执行 `npm run check`。这样可以在生成网站前拦截日期、状态、分类或必填字段错误。
