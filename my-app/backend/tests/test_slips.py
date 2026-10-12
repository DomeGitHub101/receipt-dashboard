"""Slip layouts from Thai banks and e-wallets, written as the OCR text each app's slip produces."""
import pytest
from app.parser import parse_receipt, slip_qr


def qr(bank, reference):
    inner = '0006000001' + f'01{len(bank):02d}{bank}' + f'02{len(reference):02d}{reference}'
    return f'00{len(inner):02d}{inner}5102TH91040000'


SLIPS = {
    'kbank': ('โอนเงินสำเร็จ\n13 ต.ค. 69 14:32 น.\nนาย สมชาย ใจดี\nธ.กสิกรไทย\nxxx-x-x1234-x\n'
              'นางสาว สมหญิง รักดี\nธ.ไทยพาณิชย์\nxxx-x-x5678-x\nเลขที่รายการ:\n016286143245BTF06419\n'
              'จำนวน:\n1,250.00 บาท\nค่าธรรมเนียม:\n0.00 บาท',
              'KBank', '2026-10-13', '1250.00', '016286143245BTF06419'),
    'make': ('MAKE by KBank\nTransfer successful\n13 Oct 2026 14:32\nFrom\nSomchai J.\nTo\nSomying R.\n'
             'Kasikornbank\nAmount\n฿350.00\nFee\n฿0.00\nTransaction ID\n016286143245BPM01234',
             'KBank (MAKE)', '2026-10-13', '350.00', '016286143245BPM01234'),
    'dime': ('Dime!\nTransfer complete\nAmount\n-฿89.50\nTo\nCafe Amazon\nPromptPay\nDate\nOct 13, 2026 09:15\n'
             'Ref. No.\nDM2610130915ABCD',
             'KKP (Dime)', '2026-10-13', '89.50', 'DM2610130915ABCD'),
    'krungthai': ('Krungthai NEXT\nโอนเงินสำเร็จ\nวันที่ทำรายการ 13 ต.ค. 2569 - 18:05\nจาก\nนาย สมชาย ใจดี\n'
                  'ไปยัง\nร้าน ข้าวมันไก่\nพร้อมเพย์\nจำนวนเงิน\n60.00 บาท\nรหัสอ้างอิง\n202610131805KTB12345',
                  'Krungthai', '2026-10-13', '60.00', '202610131805KTB12345'),
    'bangkok': ('Bangkok Bank Mobile Banking\nTransfer Successful\n13/10/2569 07:45\nFrom Account\nXXX-X-X1234-X\n'
                'Amount 2,000.00 THB\nFee 0.00 THB\nReference No. BBL261013074512',
                'Bangkok Bank', '2026-10-13', '2000.00', 'BBL261013074512'),
    'krungsri': ('Krungsri\nโอนเงินสำเร็จ\n13/10/2026 21:10:44\nยอดเงิน 499.00 บาท\nค่าธรรมเนียม 0.00 บาท\n'
                 'หมายเลขอ้างอิง 2026101321104477',
                 'Krungsri', '2026-10-13', '499.00', '2026101321104477'),
    'ttb': ('ttb touch\nโอนเงินสำเร็จ\n13 ตุลาคม 2569 12:00\nจำนวนเงิน 150.00 บาท\nเลขที่อ้างอิง TTB1310261200XY',
            'ttb', '2026-10-13', '150.00', 'TTB1310261200XY'),
    'gsb': ('MyMo by GSB\nโอนเงินสำเร็จ\n13 ต.ค. 2569 16:20\nจำนวนเงิน 75.00 บาท\nยอดเงินคงเหลือ 12,345.67 บาท',
            'GSB', '2026-10-13', '75.00', None),
    'truemoney': ('TrueMoney Wallet\nชำระเงินสำเร็จ\n13/10/2026 10:30\nจำนวนเงิน\n฿45.00\nเลขที่อ้างอิง\n50012345678901',
                  'TrueMoney', '2026-10-13', '45.00', '50012345678901'),
}


@pytest.mark.parametrize('name', SLIPS)
def test_thai_bank_and_wallet_slips(name):
    text, bank, expected_date, amount, reference = SLIPS[name]
    result = parse_receipt(text)
    assert result['bank'] == bank
    assert result['date'] == expected_date
    assert result['amount'] == amount
    assert result['reference_code'] == reference
    assert result['merchant'].startswith(f'Transfer via {bank}')


def test_promptpay_is_named_in_the_description():
    assert parse_receipt(SLIPS['krungthai'][0])['merchant'] == 'Transfer via Krungthai · PromptPay'
    assert parse_receipt(SLIPS['kbank'][0])['merchant'] == 'Transfer via KBank'


def test_receiver_bank_does_not_override_sender():
    # The KBank slip also prints the receiver's bank (SCB); the sender's name comes first.
    assert parse_receipt(SLIPS['kbank'][0])['bank'] == 'KBank'
    # Bangkok in an address is not Bangkok Bank.
    assert parse_receipt('SCB EASY\nกรุงเทพมหานคร 10500\n13/10/2026\nจำนวนเงิน 10.00')['bank'] == 'SCB'


def test_balance_and_fee_lines_are_not_amounts():
    result = parse_receipt('MyMo\n13/10/2026\nยอดเงินคงเหลือ 9,999.00 บาท\nค่าธรรมเนียม 5.00 บาท')
    assert result['amount'] is None


def test_unlabelled_amount_falls_back_to_currency_value():
    result = parse_receipt('Some Wallet\n13/10/2026\nPaid to Shop\n฿120.00\nFee ฿0.00')
    assert result['amount'] == '120.00'
    assert 'หน่วยเงิน' in result['warning']


@pytest.mark.parametrize('text,expected', [
    ('13 Oct 2026', '2026-10-13'), ('13 Oct 26', '2026-10-13'), ('Oct 13, 2026', '2026-10-13'),
    ('13 October 2026 08:00', '2026-10-13'), ('5 Sept 2026', '2026-09-05'), ('13 ต.ค. 69', '2026-10-13'),
])
def test_english_and_thai_dates(text, expected):
    assert parse_receipt(text)['date'] == expected


@pytest.mark.parametrize('code,bank,reference', [
    ('004', 'KBank', '016286143245BTF06419'), ('069', 'KKP', 'DM2610130915ABCD'),
    ('006', 'Krungthai', '202610131805KTB12345'), ('002', 'Bangkok Bank', 'BBL261013074512'),
    ('025', 'Krungsri', '2026101321104477'), ('099', 'Thai bank', 'X1234567890'),
])
def test_slip_qr_from_any_bank(code, bank, reference):
    assert slip_qr(qr(code, reference)) == (code, reference)
    result = parse_receipt('13/10/2026\nจำนวนเงิน 10.00', [qr(code, reference)])
    assert (result['bank'], result['reference_code'], result['reference_source']) == (bank, reference, 'qr')


def test_qr_bank_wins_but_keeps_its_own_app_name():
    # A Dime slip (KKP) keeps the app name; text mentioning another bank cannot override the QR.
    assert parse_receipt('Dime!\n13/10/2026\nAmount ฿5.00', [qr('069', 'DM2610130915ABCD')])['bank'] == 'KKP (Dime)'
    assert parse_receipt('K PLUS\n13/10/2026\nจำนวน 5.00', [qr('014', '20261013AbCdEfGh123456789')])['bank'] == 'SCB'


def test_scb_qr_still_requires_its_dated_reference_and_flags_date_mismatch():
    assert slip_qr(qr('014', 'NOTADATE12345')) is None
    result = parse_receipt('12/10/2026\nจำนวนเงิน 10.00', [qr('014', '20261013AbCdEfGh123456789')])
    assert 'ไม่ตรงกับส่วนวันที่' in result['warning']


def test_two_different_slips_in_one_image_are_rejected():
    result = parse_receipt('13/10/2026\nจำนวนเงิน 10.00', [qr('004', '016286143245BTF06419'), qr('006', '202610131805KTB12345')])
    assert result['amount'] is None and result['bank'] is None


@pytest.mark.parametrize('line,amount', [('B350.00', '350.00'), ('-B89.50', '89.50'), ('B1,250.00', '1250.00')])
def test_baht_sign_read_as_letter_b(line, amount):
    # Tesseract renders "฿" as "B"; the amount after the label must still be read.
    assert parse_receipt(f'13 Oct 2026\nAmount\n{line}\nFee\n80.00')['amount'] == amount


def test_letter_b_needs_a_decimal_amount():
    assert parse_receipt('13 Oct 2026\nAmount\nBTF06419')['amount'] is None


# OCR output shaped like the real K PLUS and Dime slips (names and numbers replaced): Tesseract spaces
# Thai letters apart, drops the space before the year, misreads ก as ถ and adds a stray "O" to references.
KPLUS_OCR = ('โอ น เง ิ น ส ํ า เร ็ จ\n27 ธ . ค . 68 04:44 น .\nน า ย ท ด ส อ บ ก\nธ . ก ส ิ ก ร ไท ย\nXXX-X-X1234-X\n'
             'น . ส . ต ั ว อ ย ่ า ง\nร ห ั ส พ ร ้ อ ม เพ ย ์\nXXX-XXX-5678\nเล ข ท ี ่ ร า ย ก า ร :\n'
             '012345678901BPP0O1234\nจ ํ า น ว น :\n50,000.00 บ า ท\nค ่ า ธร ร ม เน ี ย ม :\n0.00 บ า ท')
DIME_OCR = ('โอ น เง ิ น\n72.50 บ า ท\nค ่ า ธร ร ม เน ี ย ม 0.00 บ า ท\nไป ย ั ง\nว ั น ท ี ่\n'
            '24 ถุ ย .2569 -12:32 u.\n0 ime!\nlaufiaad 123456789012\nโด ย ธ . เก ี ย ร ต ิ น า ค ิ น ภั ท ร')


def test_real_kplus_layout():
    result = parse_receipt(KPLUS_OCR)
    assert (result['bank'], result['date'], result['amount']) == ('KBank', '2025-12-27', '50000.00')
    assert result['reference_code'] == '012345678901BPP01234'
    assert result['merchant'] == 'Transfer via KBank · PromptPay'


def test_real_dime_layout():
    result = parse_receipt(DIME_OCR, [qr('069', 'DM260924053216000abcdef')])
    assert (result['bank'], result['date'], result['amount']) == ('KKP (Dime)', '2026-09-24', '72.50')
    assert result['reference_code'] == 'DM260924053216000abcdef'
    assert 'หน่วยเงิน' not in result['warning']  # the bare "โอนเงิน" heading labels the amount


@pytest.mark.parametrize('ocr,expected', [
    ('012345678901BPP0O1234', '012345678901BPP01234'), ('012345678901BTFO1234', '012345678901BTF01234'),
    ('012345678901BPP01234', '012345678901BPP01234'), ('ABCDEFGHO123', 'ABCDEFGHO123'),
])
def test_kbank_reference_repair(ocr, expected):
    assert parse_receipt(f'เลขที่รายการ: {ocr}')['reference_code'] == expected
