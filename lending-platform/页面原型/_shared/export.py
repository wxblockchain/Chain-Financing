"""把仓库内的原型源文件内联成一份可独立评审的单文件 HTML。

用法（在 lending-platform/页面原型/ 下执行）：
  python3 _shared/export.py --source <模块>/<原型>.html --output <仓库外路径>.html

源文件（模块 HTML 与 _shared/ 下的 CSS/JS）始终是唯一维护源；生成件不放回仓库，
避免出现第二份可编辑的公共代码。公共层更新后重新执行导出即可。

本脚本只处理本仓库采用的普通 stylesheet link / script src 写法，不是通用打包器，
也不收录任何远程资源。
"""
from pathlib import Path
import argparse
import re
import json


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent,
                        help="原型根目录，默认为 _shared/ 的上一级（页面原型/）")
    args = parser.parse_args()

    root = args.root.resolve()
    source, output = args.source.resolve(), args.output.resolve()
    if not source.is_relative_to(root) or source.suffix != ".html":
        parser.error("source must be an HTML file under the prototype root")
    if output.is_relative_to(root):
        parser.error("export outside the prototype tree to keep generated copies out of source")
    def standalone(source):
        html = source.read_text(encoding="utf-8")

        def inline(match, tag):
            resource = (source.parent / match.group(1)).resolve()
            if not resource.is_relative_to(root):
                raise ValueError("Only local prototype resources may be inlined: %s" % resource)
            content = resource.read_text(encoding="utf-8")
            content = re.sub(r"</" + tag, lambda m: "<\\/" + m[0][2:], content, flags=re.I)
            return "<%s>\n%s\n</%s>" % (tag, content, tag)

        html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: inline(m, "style"), html)
        html = re.sub(r'<script src="([^"]+)"></script>', lambda m: inline(m, "script"), html)
        if re.search(r'<(?:script\b[^>]*\bsrc=|link\b[^>]*\bhref=)', html, re.I):
            raise ValueError("Unresolved script or stylesheet dependency")
        return html

    html = standalone(source)
    if 'data-admin-module=' in html:
        # Source files keep normal relative links. Offline delivery includes every
        # destination from the same menu contract, with no copied business runtime.
        menu = (root / '_shared/admin-menu.js').read_text(encoding='utf-8')
        entries = json.loads(re.search(r'const entries = (\[.*?\]);', menu, re.S).group(1))
        documents = {}
        for entry in entries:
            filename = entry['file']
            if filename not in documents:
                document = standalone(root / '管理端' / filename)
                bootstrap = '<script>window.AdminPrototypeBundle.install();</script>'
                documents[filename] = document.replace('<head>', '<head>' + bootstrap, 1)
        payload = json.dumps({'documents': documents, 'initial': str(source.relative_to(root / '管理端')),
                              'entries': entries}, ensure_ascii=False).replace('<', '\\u003c')
        runtime = (root / '_shared/admin-bundle.js').read_text(encoding='utf-8')
        html = '<!doctype html><html><head><meta charset="utf-8"><title>Harbour Credit</title></head><body><script>\n' + runtime.replace('window.__ADMIN_BUNDLE_PAYLOAD__', payload) + '\n</script></body></html>'

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8")
    print("Exported %s (%d bytes)" % (output, output.stat().st_size))


if __name__ == "__main__":
    main()
