import re


IGNORE_KEYWORDS = [
    "total", "subtotal", "tax", "gst", "balance", "payment",
    "receipt", "date", "time", "abn", "store", "pickup",
    "invoice", "cash", "eftpos", "visa", "master", "customer",
    "order", "print", "saved", "rewards", "points", "change",
    "approved", "debit", "card", "eft", "specials", "promo",
    "promotional", "includes gst", "collect", "points balance",
    "you saved", "sale", "discount", "member", "welcome",
    "thank you", "rounding", "balance due", "terminal",
    "purchase", "aid", "auth", "ref", "trace", "merchant",
    "operator", "register", "lane", "pos", "gst included",
    "qr", "barcode", "transaction", "approval", "online",
    "account", "payment method", "change due", "buy", "for"
]


STORE_PATTERNS = {
    "woolworths": "Woolworths",
    "coles": "Coles",
    "aldi": "ALDI",
    "iga": "IGA",
    "costco": "Costco",
    "kmart": "Kmart",
    "target": "Target",
    "walmart": "Walmart",
    "tesco": "Tesco"
}


BAD_ITEM_PATTERNS = [
    r"\bbuy\s+\d+\s+for\b",
    r"\b\d+\s+for\b",
    r"\bot\s+seem\b",
    r"\bsubtotal\b",
    r"\btotal\b",
    r"\bsavings?\b",
    r"\bchange\b",
    r"\bcash\b",
    r"\bcard\b",
    r"\beftpos\b",
    r"\baid\b",
    r"\bauth\b",
    r"\bref\b",
    r"\btrace\b",
    r"\bmerchant\b",
    r"\bterminal\b",
    r"\bpurchase\b",
    r"\bapproval\b",
    r"\btransaction\b"
]


def clean_item_name(name):
    name = re.sub(r"[^a-zA-Z0-9\s&/\-]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def is_noise(line):
    line = line.lower().strip()

    if not line:
        return True

    if any(word in line for word in IGNORE_KEYWORDS):
        return True

    letters = len(re.findall(r"[a-zA-Z]", line))
    digits = len(re.findall(r"\d", line))

    if digits > letters * 2 and digits > 5:
        return True

    return False


def looks_like_item_name(name):
    if not name:
        return False

    if len(name) < 4:
        return False

    if not re.search(r"[a-zA-Z]", name):
        return False

    letters = len(re.findall(r"[a-zA-Z]", name))
    digits = len(re.findall(r"\d", name))

    if digits > letters:
        return False

    if len(name) > 60:
        return False

    return True


def normalize_item_name(name):
    name = clean_item_name(name)

    name = re.sub(r"^\d+\s*", "", name).strip()
    name = re.sub(r"\b\d+\s*[xX]\b", "", name).strip()
    name = re.sub(r"^\d+(g|kg|ml|l)\s*", "", name, flags=re.IGNORECASE).strip()
    name = re.sub(r"\b\d+(g|kg|ml|l)\b$", "", name, flags=re.IGNORECASE).strip()
    name = re.sub(r"\b[a-zA-Z]\b$", "", name).strip()
    name = re.sub(r"[-/]+$", "", name).strip()

    # remove leading isolated junk symbols/letters
    name = re.sub(r"^[\-\.\,]+\s*", "", name).strip()
    name = re.sub(r"^[a-zA-Z]\s+", "", name).strip()

    name = re.sub(r"\s+", " ", name).strip()

    return name


def is_valid_price(price):
    return 0.01 <= price <= 9999.99


def extract_price_candidates(line):
    prices = re.findall(r"\d+[.,]\d{2}", line)
    return [float(p.replace(",", ".")) for p in prices]


def is_bad_item_name(name):
    lower_name = name.lower().strip()

    if len(lower_name.split()) < 2:
        return True

    if any(re.search(pattern, lower_name) for pattern in BAD_ITEM_PATTERNS):
        return True

    # reject names with too many tiny words
    words = lower_name.split()
    tiny_words = [w for w in words if len(w) <= 2]
    if len(tiny_words) >= 3:
        return True

    # reject mostly garbage-like short OCR fragments
    if len(words) <= 3:
        joined_letters = re.sub(r"[^a-z]", "", lower_name)
        if len(joined_letters) < 5:
            return True

    # reject lines with too many uppercase-style OCR junk groups
    if len(re.findall(r"[A-Z]{3,}", name)) > 3:
        return True

    return False


def parse_receipt_items(text):
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    items = []
    seen = set()

    for line in lines:
        if is_noise(line):
            continue

        prices = extract_price_candidates(line)
        if not prices:
            continue

        price = prices[-1]
        if not is_valid_price(price):
            continue

        name = line

        for raw_price in re.findall(r"\d+[.,]\d{2}", line):
            name = name.replace(raw_price, " ")

        name = re.sub(r"\b\d{4,}\b", " ", name)
        name = normalize_item_name(name)

        if not looks_like_item_name(name):
            continue

        if is_noise(name):
            continue

        if is_bad_item_name(name):
            continue

        key = (name.lower(), price)
        if key in seen:
            continue

        seen.add(key)
        items.append({
            "item": name,
            "price": price
        })

    return items


def extract_store_name(text):
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    for line in lines[:12]:
        lower_line = line.lower()
        for pattern, store_name in STORE_PATTERNS.items():
            if pattern in lower_line:
                return store_name

    return None


def extract_savings(text):
    patterns = [
        r"you\s+saved\s+\$?\s*(\d+[.,]\d{2})",
        r"savings?\s+\$?\s*(\d+[.,]\d{2})",
        r"saved\s+\$?\s*(\d+[.,]\d{2})"
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return float(match.group(1).replace(",", "."))

    return None


def extract_total(text):
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    for line in lines:
        lower_line = line.lower()
        if re.search(r"\btotal\b", lower_line) and "subtotal" not in lower_line:
            prices = extract_price_candidates(line)
            if prices:
                return prices[-1]

    for line in lines:
        lower_line = line.lower()
        if re.search(r"\btot[a-z0-9]*l\b", lower_line):
            prices = extract_price_candidates(line)
            if prices:
                return prices[-1]

    return None


def extract_subtotal(text):
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    for line in lines:
        if re.search(r"\bsubtotal\b", line, re.IGNORECASE):
            prices = extract_price_candidates(line)
            if prices:
                return prices[-1]

    return None


def build_receipt_data(text):
    return {
        "store_name": extract_store_name(text),
        "items": parse_receipt_items(text),
        "subtotal": extract_subtotal(text),
        "total": extract_total(text),
        "savings": extract_savings(text)
    }