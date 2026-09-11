#!/bin/sh
# 源文件共享，交付时内联：把 src/ 下的分层源码按序拼成单文件交付物。
# 改样式或逻辑请改 src/ 下对应文件后重新执行本脚本，不要手改生成物。
set -e
cd "$(dirname "$0")"
OUT="v1.0-借贷广场-融资需求与代币质押-原型.html"
cat src/00-head.html src/10-shell.html \
    src/20-data.js src/30-calc.js src/40-ui.js src/50-charts.js \
    src/60-pages-plaza.js src/61-pages-detail.js src/62-pages-publish.js \
    src/70-actions.js src/80-router.js \
    src/99-tail.html > "$OUT"
echo "built: $OUT ($(wc -c < "$OUT") bytes)"
