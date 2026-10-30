"""把模块原型源文件内联成一份可双击打开的单文件评审件。

用法（在 token-issuance-platform/页面原型/ 下执行）：
  python3 _shared/export.py --source 面客端/01-企业登录与企业账户/企业登录与企业账户.html --output <仓库外路径>.html

源文件（模块 HTML 与 _shared/ 下的 CSS/JS）是唯一维护源；生成件不放回仓库。
只处理本目录采用的 <link rel="stylesheet" href> 与 <script src> 相对路径写法，不收录远程资源。
带 data-local-only 的脚本仅用于仓库联看，导出时排除，并明确设置单模块模式。
"""
from pathlib import Path
import argparse
import re


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    src = args.source.resolve()
    html = src.read_text(encoding="utf-8")
    html = re.sub(r'<script\b(?=[^>]*\bdata-local-only\b)[^>]*>\s*</script>',
                  '<script>window.TP=window.TP||{};TP.previewMode="module";</script>', html)

    def read(rel):
        if re.match(r"^[a-z]+:|^//", rel):
            raise SystemExit(f"拒绝远程资源：{rel}")
        return (src.parent / rel).resolve().read_text(encoding="utf-8")

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: "<style>\n" + read(m.group(1)) + "</style>", html)
    html = re.sub(r'<script src="([^"]+)"></script>',
                  lambda m: "<script>\n" + read(m.group(1)).replace("</script", "<\\/script") + "</script>", html)
    args.output.write_text(html, encoding="utf-8")
    print(f"已导出 {args.output}（{len(html.encode('utf-8')) // 1024} KB）")


if __name__ == "__main__":
    main()
