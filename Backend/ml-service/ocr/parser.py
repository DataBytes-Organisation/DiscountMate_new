import re

def parse_receipt(text):
    lines = text.split("\n")
    items = []

    ignore_keywords = ["total", "tax", "subtotal", "balance", "due"]

    for line in lines:
        line_lower = line.lower().strip()

        if not line_lower:
            continue

        if any(keyword in line_lower for keyword in ignore_keywords):
            continue

        price_match = re.search(r"\d+\.\d{2}", line)

        if price_match:
            price = float(price_match.group())

            name = line.replace(price_match.group(), "").strip()

            # remove special characters
            name = re.sub(r"[^a-zA-Z0-9\s]", "", name)

            # remove quantity number at beginning
            name = re.sub(r"^\d+\s*", "", name)

            # remove leftover standalone numbers
            name = re.sub(r"\b\d+\b", "", name)

            # clean extra spaces
            name = re.sub(r"\s+", " ", name).strip()

            if len(name) > 2:
                items.append({
                    "item": name,
                    "price": price
                })

    return items