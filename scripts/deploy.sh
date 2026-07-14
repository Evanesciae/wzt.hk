#!/bin/sh
# 服务器端部署脚本：在服务器项目目录里运行（./scripts/deploy.sh）。
# 拉取最新代码并重建容器，数据卷 wzt_data 不受影响。
set -e

cd "$(git rev-parse --show-toplevel)"

echo "==> git pull"
git pull

echo "==> docker compose up -d --build"
docker compose up -d --build

echo "==> prune dangling images"
docker image prune -f

echo "==> done. 日志：docker compose logs -f app"
