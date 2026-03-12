#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-dist}"
ARCHIVE_NAME="${2:-aupi-project-package}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUT_DIR"

TAR_PATH="$OUT_DIR/${ARCHIVE_NAME}-${TIMESTAMP}.tar.gz"
ZIP_PATH="$OUT_DIR/${ARCHIVE_NAME}-${TIMESTAMP}.zip"

# 打包项目源码，排除 Git 元数据与常见构建产物
EXCLUDES=(
  --exclude=.git
  --exclude=node_modules
  --exclude=.next
  --exclude=dist
)

tar -czf "$TAR_PATH" "${EXCLUDES[@]}" .
zip -rq "$ZIP_PATH" . -x '.git/*' 'node_modules/*' '.next/*' 'dist/*'

echo "✅ 打包完成"
echo "tar.gz: $TAR_PATH"
echo "zip:    $ZIP_PATH"
