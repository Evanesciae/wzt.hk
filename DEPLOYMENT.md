# wzt.hk 服务端部署

项目现在是 Astro Node SSR 应用。旅行与知识库数据保存在 SQLite，照片原图与网页版本保存在持久化数据卷中。Links 仍从仓库内容构建。

## 服务器要求

- 64 位 Linux VPS
- 2 核 CPU、2–4 GB 内存
- Docker Engine 与 Docker Compose
- 至少 40 GB 磁盘，照片较多时增加数据盘
- 80、443 端口可以从公网访问

DNS 中将 `wzt.hk` 和 `www.wzt.hk` 的 A/AAAA 记录指向服务器。Caddy 会自动申请 HTTPS 证书。

## 首次部署

在自己的电脑生成密码哈希：

```bash
npm run admin:password -- "一条足够长且唯一的密码"
```

服务器上复制环境变量模板：

```bash
cp .env.example .env.production
```

编辑 `.env.production`：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=上一步生成的完整字符串

# 可选：AI 助手（DeepSeek，OpenAI 兼容）。不填则后台 AI 按钮/行程生成器返回「未配置」，站点其余功能正常。
AI_API_KEY=
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
```

`.env.production` 不要提交到 Git。随后启动：

```bash
docker compose up -d --build
```

首次访问时，数据库会从 `src/content/travel/` 与 `src/content/kb/` 自动导入现有行程与笔记。之后管理端的修改以 SQLite 为准。

- 公开站：`https://wzt.hk`
- 管理端：`https://wzt.hk/admin`

## 数据目录

Docker 卷 `wzt_data` 包含：

```text
/data/wzt.db                 SQLite 数据库
/data/media/originals/       私有原图，不通过公开 URL 提供
/data/media/public/          自动生成的网页图片
```

上传限制为单张 100 MB。JPEG、PNG、WebP、TIFF 可直接处理；Docker 镜像包含 HEIC/HEIF 转换工具。公开图片会自动纠正方向、移除 EXIF，并生成 640、1280、2048 和最高 4096px 的高质量 JPEG。

## 更新代码

```bash
git pull
docker compose up -d --build
```

持久化卷不会因重新构建镜像而删除。不要运行 `docker compose down -v`，其中 `-v` 会删除数据卷。

服务器上也可用一键脚本：

```bash
./scripts/deploy.sh   # 等价于 git pull && docker compose up -d --build && docker image prune -f
```

### 自动部署（可选）

`.github/workflows/deploy.yml` 提供经 SSH 的远程部署，默认**手动触发**（仓库 Actions → deploy → Run workflow）。先在仓库 Secrets 配置 `SERVER_HOST`、`SERVER_USER`、`SSH_PRIVATE_KEY`、`SERVER_PATH`。想改成 push 到 main 即部署，把 workflow 的 `on` 加上 `push: branches: [main]`。建议手动跑稳定后再开自动。

### 改配置不改代码

只改服务器上的 `.env.production`（如补 `AI_API_KEY`、换密码）时，无需重建镜像：

```bash
docker compose up -d   # 重建容器读取新 env
```

## 备份

手动备份：

```bash
docker compose exec app npm run backup
```

备份会写到宿主机的 `./backups/`。建议再使用 restic、rsync 或服务器快照，将该目录复制到另一台机器或对象存储。至少每天备份一次，并定期验证恢复。

## 上线前检查

```bash
npm run check
npm run build
docker compose config
```

同时确认：

- 使用了唯一的强密码；
- `.env.production` 没有进入 Git；
- DNS 已生效；
- 云服务器防火墙只开放 SSH、80 和 443；
- 已配置异地备份。
