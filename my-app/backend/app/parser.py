import re
from datetime import date
from decimal import Decimal, InvalidOperation

MONEY = r'(\d[\d,]*\.\d{2}|\d[\d,]*)'

def parse_receipt(text: str):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    merchant = next((line for line in lines[:5] if re.search(r'[a-zA-Zก-๙]', line)), '')[:160]
    parsed_date = None
    for match in re.finditer(r'\b(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{2,4})\b', text):
        a, b, c = map(int, match.groups())
        y, m, d = (a, b, c) if a > 31 else (c, b, a)
        if y > 2400:
            y -= 543
        if y < 100:
            y += 2000
        try:
            parsed_date = date(y, m, d).isoformat()
            break
        except ValueError:
            continue
    candidates = []
    items = []
    for index, line in enumerate(lines):
        total_label = re.search(r'grand\s*total|net\s*total|amount\s*due|ยอดสุทธิ|ยอดรวม|รวมทั้งสิ้น|จำนวนเงิน|^total\b', line, re.I)
        excluded = re.search(r'sub\s*total|subtotal|change|cash|vat|tax|เงินทอน|รับเงิน|ภาษี', line, re.I)
        values = re.findall(MONEY + r'(?=\s*(?:บาท|THB|฿)?\s*$)', line, re.I)
        if total_label and not excluded:
            if not values and index + 1 < len(lines):
                values = re.findall(MONEY + r'\s*$', lines[index + 1])
            if values:
                candidates.append(float(Decimal(values[-1].replace(',', ''))))
        elif values and not excluded and not re.search(r'\d[/.\-]\d|tel|โทร|receipt|invoice', line, re.I):
            name = re.sub(MONEY + r'\s*$', '', line).strip()
            if name and len(items) < 200:
                items.append({'name': name[:200], 'amount': float(Decimal(values[-1].replace(',', '')))})
    return {'merchant': merchant, 'date': parsed_date, 'amount': candidates[-1] if candidates else None,
            'line_items': items, 'raw_text': text,
            'warning': 'Please review all extracted fields before saving.' if candidates else 'No reliable total found. Enter the total from your receipt.'}
