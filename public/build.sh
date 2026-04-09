#!/bin/bash
# 构建脚本 - 扫码挪车前端
# 用法: ./build.sh
# 依赖: npm install -g html-minifier terser cssnano-cli (可选)
#
# 无依赖模式: 直接运行，会用 sed 做基础压缩

set -e

SRC="./public"
DIST="./dist"

echo "==> 清理 dist 目录"
rm -rf "$DIST"
mkdir -p "$DIST"

echo "==> 压缩 HTML..."
for f in "$SRC"/*.html; do
  name=$(basename "$f")
  if command -v html-minifier &>/dev/null; then
    html-minifier --collapse-whitespace --remove-comments --remove-optional-tags "$f" -o "$DIST/$name"
  else
    # 基础压缩：移除注释和多余空白
    sed -E 's/<!--.*-->//g; /^[[:space:]]*$/d; s/[[:space:]]+/ /g' "$f" > "$DIST/$name"
  fi
  echo "    $name"
done

echo "==> 压缩 JS (common.js, messages.js)..."
for f in "$SRC"/*.js; do
  name=$(basename "$f")
  if [[ "$name" == "qrcode"* ]]; then continue; fi  # 跳过第三方库引用
  if command -v terser &>/dev/null; then
    terser "$f" -c -m -o "$DIST/$name"
  else
    cp "$f" "$DIST/$name"
  fi
  echo "    $name"
done

echo "==> 压缩 CSS (style.css)..."
if command -v cssnano &>/dev/null; then
  cssnano "$SRC/style.css" "$DIST/style.css"
else
  # 基础压缩：移除注释和多余空白
  sed -E 's:/\*.*?\*/::g; /^[[:space:]]*$/d; s/[[:space:]]+/ /g; s/\s*{\s*/{/g; s/\s*}\s*/}/g; s/\s*;\s*/;/g; s/\s*:\s*/:/g' \
    "$SRC/style.css" > "$DIST/style.css"
fi
echo "    style.css"

echo ""
echo "==> 构建完成: $DIST"
ls -lh "$DIST"
