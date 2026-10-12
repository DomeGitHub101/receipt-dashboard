"""Thai bank-transfer and e-wallet slip fields from local OCR and QR data; this does not verify a payment."""
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
EN_MONTHS = {name: i for i, names in enumerate([
    ('jan', 'january'), ('feb', 'february'), ('mar', 'march'), ('apr', 'april'), ('may',), ('jun', 'june'),
    ('jul', 'july'), ('aug', 'august'), ('sep', 'sept', 'september'), ('oct', 'october'), ('nov', 'november'),
    ('dec', 'december')], 1) for name in names}

# Sending-bank codes carried in the Bank of Thailand slip QR, with names shown to the user.
BANK_CODES = {
    '002': 'Bangkok Bank', '004': 'KBank', '006': 'Krungthai', '011': 'ttb', '014': 'SCB', '022': 'CIMB Thai',
    '024': 'UOB', '025': 'Krungsri', '030': 'GSB', '033': 'GH Bank', '034': 'BAAC', '066': 'Islamic Bank',
    '067': 'Tisco', '069': 'KKP', '070': 'ICBC Thai', '071': 'Thai Credit', '073': 'LH Bank',
}
# Text cues. A slip usually names both the sender's and the receiver's bank, so the cue printed first
# (the sending app's header) wins; English cues match whole words in the spaced text.
BANK_KEYWORDS = [
    ('KBank (MAKE)', r'make\s*by\s*kbank|\bmake\b'), ('KKP (Dime)', r'\bdime\b|ime!'), ('TrueMoney', r'true\s*money|ทรูมันนี่'),
    ('ShopeePay', r'shopee\s*pay'), ('KBank', r'กสิกร|kasikorn|\bk\s?bank\b|\bk\s?plus\b'),
    ('SCB', r'ไทยพาณิชย์|\bscb\b'), ('Krungthai', r'กรุงไทย|krungthai|\bktb\b'),
    ('Bangkok Bank', r'ธนาคารกรุงเทพ|ธ\.\s?กรุงเทพ|bangkok\s*bank|bualuang|\bbbl\b'),
    ('Krungsri', r'กรุงศรี|krungsri|\bkma\b'), ('ttb', r'ทหารไทยธนชาต|\bttb\b'), ('GSB', r'ออมสิน|\bmymo\b|\bgsb\b'),
    ('KKP', r'เกียรตินาคิน|\bkkp\b'), ('UOB', r'\buob\b'), ('CIMB Thai', r'\bcimb\b'), ('BAAC', r'ธ\.\s?ก\.\s?ส|\bbaac\b'),
    ('GH Bank', r'อาคารสงเคราะห์|\bgh\s?bank\b'), ('LH Bank', r'แลนด์\s?แอนด์\s?เฮ้าส์|\blh\s?bank\b'),
]
APP_BANKS = {'KBank (MAKE)': '004', 'KKP (Dime)': '069'}
EXCLUDED_AMOUNT = r'ค่าธรรมเนียม|fee|คงเหลือ|balance|available|ยอดเงินในบัญชี|cashback|แต้ม|point'

def compact(text):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', text)).replace('ํา', 'ำ')

def iso_date(year, month, day, buddhist_short=True):
    if year >= 2400: year -= 543
    elif year < 100: year += 1957 if buddhist_short else 2000  # Thai 69 -> 2569 -> 2026; English 26 -> 2026.
    try:
        return date(year, month, day).isoformat() if 1900 <= year <= 2200 else None
    except ValueError:
        return None

def thai_month(text):
    key = re.sub(r'[\s.,]', '', text)
    # OCR slips: a stray below-vowel and ก read as ถ (Dime's "ก.ย." came out as "ถุ ย .").
    return MONTHS.get(key) or MONTHS.get(key.replace('ุ', '').replace('ถ', 'ก'))

def read_date(text):
    dates = set()
    for line in text.splitlines():
        match = re.search(r'(?<!\d)(\d{1,2})\s+([ก-๙.\s,]+?)\s*(\d{2,4})(?!\d)', line)
        if match:
            day, month, year = match.groups()
            number = thai_month(month)
            if number:
                value = iso_date(int(year), number, int(day))
                if value: dates.add(value)
        # English layouts (MAKE, Dime, some K PLUS and Krungsri slips): 13 Oct 2026, 13 Oct 26, Oct 13, 2026.
        for day, month, year in re.findall(r'(?<!\d)(\d{1,2})\s*([A-Za-z]{3,9})\.?,?\s*(\d{4}|\d{2})(?!\d)', line):
            if (number := EN_MONTHS.get(month.lower())) and (value := iso_date(int(year), number, int(day), False)):
                dates.add(value)
        for month, day, year in re.findall(r'\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})(?!\d)', line):
            if (number := EN_MONTHS.get(month.lower())) and (value := iso_date(int(year), number, int(day), False)):
                dates.add(value)
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

def slip_qr(payload):
    """The Bank of Thailand slip-verification QR: sending bank code and transaction reference."""
    if len(payload) > 512: return None
    outer = tlv(payload)
    if not outer or outer.get('51') != 'TH': return None
    inner = tlv(outer.get('00', ''))
    if not inner or inner.get('00') != '000001' or not re.fullmatch(r'\d{3}', inner.get('01', '')): return None
    bank, reference = inner['01'], inner.get('02', '')
    valid = r'20\d{6}[A-Za-z0-9]{17}' if bank == '014' else r'[A-Za-z0-9]{10,40}'
    return (bank, reference) if re.fullmatch(valid, reference) else None

def detect_bank(text, qr_bank):
    spaced, flat = re.sub(r'\s+', ' ', text).lower(), compact(text).lower()
    found = []
    for order, (name, pattern) in enumerate(BANK_KEYWORDS):
        # Compare positions as a fraction of each string, since the two strings differ in length.
        hits = [m.start() / max(len(source), 1) for source in (spaced, flat) if (m := re.search(pattern, source))]
        if hits: found.append((min(hits), order, name))
    named = min(found)[2] if found else None
    if qr_bank:
        # The QR names the sending bank; keep an app name only when it belongs to that bank.
        if named and APP_BANKS.get(named) == qr_bank: return named
        return BANK_CODES.get(qr_bank, 'Thai bank')
    return named

def money_value(candidate):
    # Tesseract often reads the baht sign as "B" (฿350.00 -> B350.00); accept it only before a decimal amount.
    match = (re.fullmatch(r'[-−]?(?:฿|THB)?[-−]?(\d{1,12}|\d{1,3}(?:,\d{3})+)(\.\d{2})?(?:บาท|THB|฿)?', candidate, re.I)
             or re.fullmatch(r'[-−]?B[-−]?(\d{1,12}|\d{1,3}(?:,\d{3})+)(\.\d{2})', candidate))
    if not match: return None
    amount = Decimal(match[1].replace(',', '') + (match[2] or '.00'))
    return amount if 0 < amount < Decimal('1000000000000') else None

def read_amount(lines):
    values = set()
    for index, line in enumerate(lines):
        clean = compact(line)
        label = re.search(r'^โอนเงิน$|จำนวนเงิน(?:ที่โอน)?|ยอดโอน|ยอดเงิน|จำนวน|(?:transferamount|amountsent|amount)(?:\(THB\))?', clean, re.I)
        if not label or re.search(EXCLUDED_AMOUNT, clean, re.I): continue
        tail = clean[label.end():].lstrip(':：')
        for candidate in [tail, *[compact(v) for v in lines[index + 1:index + 3]]]:
            if (amount := money_value(candidate)) is not None:
                values.add(amount)
                break
            if candidate: break
    return next(iter(values)) if len(values) == 1 else None

def read_currency_amount(lines):
    """Fallback for unlabelled layouts: the one money value printed next to a currency unit."""
    values = set()
    for line in lines:
        clean = compact(line)
        if re.search(EXCLUDED_AMOUNT, clean, re.I): continue
        for match in re.finditer(r'(?:฿|THB|(?<![A-Za-z0-9])B)[-−]?(\d{1,3}(?:,\d{3})+|\d{1,12})\.(\d{2})|(\d{1,3}(?:,\d{3})+|\d{1,12})\.(\d{2})(?:บาท|THB|฿)', clean, re.I):
            whole, cents = (match[1], match[2]) if match[1] else (match[3], match[4])
            amount = Decimal(whole.replace(',', '') + '.' + cents)
            if amount > 0: values.add(amount)
    return next(iter(values)) if len(values) == 1 else None

def repair_reference(value):
    # KBank references are 12 digits, 3 letters and 5 digits (015361044451BPP01900). OCR sometimes
    # turns a 0 into "0O" or "O" in the digit tail; only repair when that restores the exact format.
    match = re.fullmatch(r'(\d{12}[A-Z]{3})([0-9O]{5,6})', value)
    if match and 'O' in match[2]:
        for tail in (match[2].replace('O', '', 1), match[2].replace('O', '0')):
            if re.fullmatch(r'\d{5}', tail): return match[1] + tail
    return value

def read_reference(lines):
    candidates = set()
    for index, line in enumerate(lines):
        clean = compact(line)
        label = re.search(r'รหัสอ้างอิง|เลข(?:ที่)?อ้างอิง|หมายเลขอ้างอิง|เลขที่รายการ|รหัสรายการ|เลขที่สลิป|'
                          r'transactionid|transactionno\.?|transactionref(?:erence)?|reference(?:number|no\.?|id)?|ref\.?no\.?', clean, re.I)
        if label:
            value = clean[label.end():].lstrip(':：#')
            if not value and index + 1 < len(lines): value = compact(lines[index + 1])
            if re.fullmatch(r'[A-Za-z0-9]{8,80}', value): candidates.add(repair_reference(value))
    return next(iter(candidates)) if len(candidates) == 1 else None

def parse_receipt(text: str, qr_payloads: list[str] | None = None):
    """All newly scanned slips use the outgoing bank-transfer workflow."""
    normalized = unicodedata.normalize('NFKC', text).translate(THAI_DIGITS)
    lines = [line.strip() for line in normalized.splitlines() if line.strip()]
    slips = {found for payload in (qr_payloads or []) if (found := slip_qr(payload))}
    qr_bank, reference = next(iter(slips)) if len(slips) == 1 else (None, None)
    reference_source = 'qr' if reference else None
    if not slips and (reference := read_reference(lines)):
        reference_source = 'ocr'
    bank = detect_bank(normalized, qr_bank)
    parsed_date, amount = read_date(normalized), read_amount(lines)
    warnings = []
    if amount is None and (amount := read_currency_amount(lines)) is not None:
        warnings.append('อ่านยอดจากตัวเลขที่มีหน่วยเงินในสลิป กรุณาตรวจว่าเป็นยอดที่โอนออก')
    if len(slips) > 1:
        bank, reference, reference_source, parsed_date, amount = None, None, None, None, None
        warnings = ['พบหลายรายการในภาพ กรุณาอัปโหลดสลิปครั้งละหนึ่งรายการ']
    if not parsed_date: warnings.append('อ่านวันที่ไม่ได้ชัดเจน กรุณาระบุวันที่ตามสลิป')
    if amount is None: warnings.append('อ่านจำนวนเงินที่โอนออกไม่ได้ กรุณาตรวจยอดในสลิป')
    if reference_source == 'ocr': warnings.append('รหัสอ้างอิงอ่านจากข้อความ กรุณาตรวจตัวพิมพ์ใหญ่–เล็กและตัวเลขทุกตัว')
    if reference_source == 'qr' and qr_bank == '014' and parsed_date and reference[:8] != parsed_date.replace('-', ''):
        warnings.append('วันที่ในข้อความไม่ตรงกับส่วนวันที่ของรหัสอ้างอิง กรุณาตรวจสลิปอีกครั้ง')
    warnings.append('ตรวจข้อมูลก่อนบันทึก การอ่านข้อความหรือ QR ไม่ใช่การยืนยันการโอนจากธนาคาร')
    channel = ' · PromptPay' if re.search(r'พร้อมเพย์|promptpay', compact(normalized), re.I) else ''
    return {'merchant': f'Transfer via {bank}{channel}' if bank else 'Bank transfer',
            'bank': bank, 'date': parsed_date, 'amount': str(amount) if amount is not None else None,
            'reference_code': reference, 'reference_source': reference_source,
            'source': 'bank_transfer', 'kind': 'expense', 'line_items': [],
            'raw_text': text, 'warning': '\n'.join(warnings)}
