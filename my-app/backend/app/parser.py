"""SCB transfer fields from local OCR and QR data; this does not verify a payment."""
import re
import unicodedata
from datetime import date
from decimal import Decimal

THAI_DIGITS = str.maketrans('๐๑๒๓๔๕๖๗๘๙', '0123456789')
MONTHS = {
    'มค': 1, 'มกราคม': 1, 'กพ': 2, 'กุมภาพันธ์': 2,
    'มีค': 3, 'มีนาคม': 3, 'เมย': 4, 'เมษายน': 4,
    'พค': 5, 'พฤษภาคม': 5, 'มิย': 6, 'มิถุนายน': 6,
    'กค': 7, 'กรกฎาคม': 7, 'สค': 8, 'สิงหาคม': 8,
    'กย': 9, 'กันยายน': 9, 'ตค': 10, 'ตุลาคม': 10,
    'พย': 11, 'พฤศจิกายน': 11, 'ธค': 12, 'ธันวาคม': 12,
    # Observed Tesseract rendering of the dots in ก.ย. over SCB's watermark.
    'กุย': 9, 'กุยข': 9,
}

def compact(text):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', text)).replace('ํา', 'ำ')

def iso_date(year, month, day):
    if year >= 2400: year -= 543
    elif year < 100: year += 1957  # Thai short year 69 -> 2569 -> 2026.
    try:
        return date(year, month, day).isoformat() if 1900 <= year <= 2200 else None
    except ValueError:
        return None

def read_date(text):
    dates = set()
    for line in text.splitlines():
        match = re.search(r'(?<!\d)(\d{1,2})\s+([ก-๙.\s,]+?)\s+(\d{2,4})(?!\d)', line)
        if match:
            day, month, year = match.groups()
            number = MONTHS.get(re.sub(r'[\s.,]', '', month))
            if number:
                value = iso_date(int(year), number, int(day))
                if value: dates.add(value)
        for a, b, c in re.findall(r'(?<!\d)(\d{1,4})[/-](\d{1,2})[/-](\d{2,4})(?!\d)', line):
            a, b, c = int(a), int(b), int(c)
            year, month, day = (a, b, c) if a > 31 else (c, b, a)
            if year < 100: year += 2000
            value = iso_date(year, month, day)
            if value: dates.add(value)
    return next(iter(dates)) if len(dates) == 1 else None

def tlv(payload):
    fields, offset = {}, 0
    while offset < len(payload):
        header = payload[offset:offset + 4]
        if len(header) != 4 or not header.isascii() or not header.isdigit(): return None
        tag, length = header[:2], int(header[2:])
        offset += 4
        if tag in fields or offset + length > len(payload): return None
        fields[tag] = payload[offset:offset + length]
        offset += length
    return fields

def scb_reference(payload):
    if len(payload) > 512: return None
    outer = tlv(payload)
    if not outer or outer.get('51') != 'TH': return None
    inner = tlv(outer.get('00', ''))
    if not inner or inner.get('00') != '000001' or inner.get('01') != '014': return None
    reference = inner.get('02', '')
    return reference if re.fullmatch(r'20\d{6}[A-Za-z0-9]{17}', reference) else None

def read_amount(lines):
    values = set()
    for index, line in enumerate(lines):
        clean = compact(line)
        label = re.search(r'จำนวนเงิน(?:ที่โอน)?|ยอดโอน|(?:transferamount|amountsent|amount)(?:\(THB\))?', clean, re.I)
        if not label or re.search(r'ค่าธรรมเนียม|fee', clean, re.I): continue
        tail = clean[label.end():].lstrip(':：')
        for candidate in [tail, *[compact(v) for v in lines[index + 1:index + 3]]]:
            match = re.fullmatch(r'(?:฿|THB)?(\d{1,12}|\d{1,3}(?:,\d{3})+)(\.\d{2})?(?:บาท|THB|฿)?', candidate, re.I)
            if match:
                amount = Decimal(match[1].replace(',', '') + (match[2] or '.00'))
                if 0 < amount < Decimal('1000000000000'): values.add(amount)
                break
            if candidate: break
    return next(iter(values)) if len(values) == 1 else None

def parse_receipt(text: str, qr_payloads: list[str] | None = None):
    """All newly scanned slips use the outgoing bank-transfer workflow."""
    normalized = unicodedata.normalize('NFKC', text).translate(THAI_DIGITS)
    lines = [line.strip() for line in normalized.splitlines() if line.strip()]
    references = {ref for payload in (qr_payloads or []) if (ref := scb_reference(payload))}
    reference = next(iter(references)) if len(references) == 1 else None
    reference_source = 'qr' if reference else None
    if not references:
        candidates = set()
        for index, line in enumerate(lines):
            label = re.search(r'รหัสอ้างอิง|เลข(?:ที่)?อ้างอิง|reference(?:number|no\.?)?', compact(line), re.I)
            if label:
                value = compact(line)[label.end():].lstrip(':：')
                if not value and index + 1 < len(lines): value = compact(lines[index + 1])
                if re.fullmatch(r'[A-Za-z0-9]{8,80}', value): candidates.add(value)
        if len(candidates) == 1:
            reference, reference_source = next(iter(candidates)), 'ocr'
    parsed_date, amount = read_date(normalized), read_amount(lines)
    warnings = []
    if len(references) > 1:
        reference, reference_source, parsed_date, amount = None, None, None, None
        warnings.append('พบหลายรายการในภาพ กรุณาอัปโหลดสลิปครั้งละหนึ่งรายการ')
    if not parsed_date: warnings.append('อ่านวันที่ไม่ได้ชัดเจน กรุณาระบุวันที่ตามสลิป')
    if amount is None: warnings.append('อ่านจำนวนเงินที่โอนออกไม่ได้ กรุณาตรวจยอดในสลิป')
    if reference_source == 'ocr': warnings.append('รหัสอ้างอิงอ่านจากข้อความ กรุณาตรวจตัวพิมพ์ใหญ่–เล็กและตัวเลขทุกตัว')
    if reference_source == 'qr' and parsed_date and reference[:8] != parsed_date.replace('-', ''):
        warnings.append('วันที่ในข้อความไม่ตรงกับส่วนวันที่ของรหัสอ้างอิง กรุณาตรวจสลิปอีกครั้ง')
    warnings.append('ตรวจข้อมูลก่อนบันทึก การอ่านข้อความหรือ QR ไม่ใช่การยืนยันการโอนจากธนาคาร')
    return {'merchant': 'Bank transfer',
            'date': parsed_date, 'amount': str(amount) if amount is not None else None,
            'reference_code': reference, 'reference_source': reference_source,
            'source': 'bank_transfer', 'kind': 'expense', 'line_items': [],
            'raw_text': text, 'warning': '\n'.join(warnings)}
