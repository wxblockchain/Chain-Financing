"""Inline a repository prototype's local CSS/JS into a standalone review HTML.

Usage (from repository root):
  python3 financial-service-platform/prototypes/_shared/export.py --source SOURCE.html --output OUTPUT.html
The source HTML and referenced shared files remain the only maintained sources.
"""
from pathlib import Path
import argparse
import re


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parent.parent / "协议管理/v1.0-协议管理-原型.html")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    root = Path(__file__).resolve().parents[3]
    if not source.is_relative_to(root) or source.suffix != ".html":
        parser.error("source must be an HTML file in this repository")
    if output.is_relative_to(root):
        parser.error("export outside the repository to keep generated copies out of source")
    html = source.read_text(encoding="utf-8")

    def inline(match, tag):
        resource = (source.parent / match.group(1)).resolve()
        if not resource.is_relative_to(root):
            raise ValueError("Only local repository resources may be inlined")
        content = resource.read_text(encoding="utf-8")
        # Embedded sample text may contain an HTML closing-script sequence.
        content = re.sub(r"</" + tag, lambda m: "<\\/" + m[0][2:], content, flags=re.I)
        return f"<{tag}>\n{content}\n</{tag}>"

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: inline(m, "style"), html)
    html = re.sub(r'<script src="([^"]+)"></script>', lambda m: inline(m, "script"), html)
    if re.search(r'<(?:script\b[^>]*\bsrc=|link\b[^>]*\bhref=)', html, re.I):
        raise ValueError("Unresolved script or stylesheet dependency")
    # A standalone module cannot navigate to a sibling HTML that was not exported.
    # Keep the real navigation visible and explain the boundary instead of a broken link.
    boundary = """<script>
document.addEventListener('click', function(event) {
  var link = event.target.closest('a[href]');
  if (!link || !link.getAttribute('href').startsWith('../')) return;
  event.preventDefault();event.stopImmediatePropagation();
  if (window.CF) CF.toast('info', CF.L(
    'This preview includes the current module only. Open the complete repository to visit other modules.',
    '单文件附件仅包含当前模块。访问其他模块请打开完整仓库。'));
}, true);
</script>"""
    html = html.replace('</body>', boundary + '\n</body>')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(html, encoding="utf-8")
    print(f"Exported {output} ({output.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
