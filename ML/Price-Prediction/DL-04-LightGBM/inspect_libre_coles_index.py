from __future__ import annotations

import html
import re
import urllib.request


URL = "https://pub.libre.net.au/datasets/coles-raw-prices/"


def main() -> None:
    text = urllib.request.urlopen(URL, timeout=30).read().decode("utf-8", "replace")
    rows = re.findall(
        r'href="([^"]+\.jsonl\.zst)">([^<]+)</a>\s+(\d{2}-\w{3}-\d{4} \d{2}:\d{2})\s+([^\s<]+)',
        text,
    )
    rows = [(html.unescape(href), html.unescape(name), date, size) for href, name, date, size in rows]

    print(f"index_url: {URL}")
    print(f"snapshot_files: {len(rows)}")
    print("\nfirst files:")
    for _, name, date, size in rows[:8]:
        print(f"{name}\t{date}\t{size}")

    print("\nlast files:")
    for _, name, date, size in rows[-8:]:
        print(f"{name}\t{date}\t{size}")

    small = []
    for href, name, date, size in rows:
        if size.endswith("M"):
            try:
                mb = int(size[:-1])
            except ValueError:
                continue
            if mb <= 20:
                small.append((href, name, date, size))

    print("\nsmall sample candidates:")
    for href, name, date, size in small[:10]:
        print(f"{href}\t{name}\t{date}\t{size}")


if __name__ == "__main__":
    main()
