"""Export the repository agreement prototype as an offline, single HTML file."""
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
    return html


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    repository = Path(__file__).resolve().parents[3]
    source = Path(__file__).resolve().parent.parent / "协议管理/v1.0-协议管理-原型.html"
    output = args.output.resolve()
    if output == source:
        parser.error("Output must not overwrite the repository source HTML")
    output.write_text(export(source, repository), encoding="utf-8")
    print(output)
