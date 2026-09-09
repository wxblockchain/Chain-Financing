"""Export a repository prototype as an offline, single HTML file."""
import argparse
import re
from pathlib import Path


def export(source: Path, repository: Path) -> str:
    def read(relative: str) -> str:
        path = (source.parent / relative).resolve()
        if not path.is_relative_to(repository.resolve()):
            raise ValueError(f"Resource is outside the repository: {relative}")
        return path.read_text(encoding="utf-8")

    html = source.read_text(encoding="utf-8")
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: '<style>\n' + read(m[1]) + '\n</style>', html)
    html = re.sub(r'<script src="([^"]+)"></script>',
                  lambda m: '<script>\n' + read(m[1]) + '\n</script>', html)
    html = html.replace("</body>", "<script>\ndocument.addEventListener('click',function(e){\n var a=e.target.closest('a[href]');\n if(!a||!a.getAttribute('href').startsWith('../'))return;\n e.preventDefault();e.stopImmediatePropagation();\n if(window.CF&&CF.toast)CF.toast('info',CF.L('Open the complete repository to view another module.','请从完整仓库打开原型以查看其他模块。'));\n},true);\n</script>\n</body>")
    return html


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source", type=Path, help="Module HTML; defaults to agreements for backward compatibility")
    args = parser.parse_args()
    repository = Path(__file__).resolve().parents[3]
    source = (args.source or (Path(__file__).resolve().parent.parent / "协议管理/v1.0-协议管理-原型.html")).resolve()
    if not source.is_relative_to(repository):
        parser.error("Source must be inside the repository")
    output = args.output.resolve()
    if output == source:
        parser.error("Output must not overwrite the repository source HTML")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(export(source, repository), encoding="utf-8")
    print(output)
