import json
import shutil
import subprocess
from tempfile import TemporaryDirectory
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError
import pytesseract
import pypdfium2 as pdfium
import zxingcpp
from .config import settings
from .parser import read_date

Image.MAX_IMAGE_PIXELS = 25_000_000

def recognize(image, languages, psm):
    if settings.tesseract_cmd or shutil.which('tesseract'):
        if settings.tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
        return pytesseract.image_to_string(image, lang=languages, config=f'--psm {psm}', timeout=60)
    with TemporaryDirectory(prefix='ocr-', dir=settings.upload_dir) as temp_dir:
        temp = Path(temp_dir) / 'slip.png'
        image.save(temp)
        script = Path(__file__).resolve().parents[2] / 'scripts' / 'ocr.mjs'
        result = subprocess.run(['node', str(script), str(temp), languages, str(psm)], capture_output=True, text=True, encoding='utf-8', timeout=90)
        if result.returncode:
            raise RuntimeError('OCR engine is unavailable. Install Tesseract with eng/tha languages or npm dependencies.')
        return json.loads(result.stdout)['text']

def read_receipt(path: Path, is_pdf: bool):
    images = []
    try:
        if is_pdf:
            document = pdfium.PdfDocument(str(path))
            try:
                if len(document) != 1:
                    raise ValueError('Upload one bank slip at a time. PDFs must contain exactly one page.')
                for page in document:
                    try:
                        width, height = page.get_size()
                        if width * height * 4 > 25_000_000:
                            raise ValueError('PDF page dimensions are too large.')
                        images.append(page.render(scale=2).to_pil().copy())
                    finally:
                        page.close()
            finally:
                document.close()
        else:
            with Image.open(path) as image:
                if image.width * image.height > 25_000_000:
                    raise ValueError('Image dimensions are too large. Use an image under 25 megapixels.')
                if image.format not in {'JPEG', 'PNG'}:
                    raise ValueError('Please upload a valid JPG, PNG or PDF.')
                images.append(ImageOps.exif_transpose(image).convert('RGB'))
        texts, qr_payloads = [], []
        for image in images:
            qr_payloads.extend(code.text for code in zxingcpp.read_barcodes(image, formats=zxingcpp.BarcodeFormat.QRCode))
            image.thumbnail((1600, 1800))
            prepared = ImageOps.grayscale(image)
            prepared = prepared.point(lambda value: 255 if value > 180 else value)
            prepared = prepared.resize((prepared.width * 2, prepared.height * 2), Image.Resampling.LANCZOS)
            languages = '+'.join(sorted(settings.ocr_languages.split('+'), key=lambda lang: lang != 'tha'))
            try:
                text = recognize(prepared, languages, 11)
                if not read_date(text):
                    # A focused pass avoids header artwork and watermark noise in Thai slip dates.
                    with prepared.crop((0, int(prepared.height * .18), prepared.width, int(prepared.height * .38))) as header:
                        header_text = recognize(header, languages, 6)
                    if read_date(header_text):
                        text += '\n' + header_text
                texts.append(text)
            finally:
                prepared.close()
        return {'text': '\n'.join(texts), 'qr_payloads': qr_payloads}
    except (UnidentifiedImageError, pdfium.PdfiumError, Image.DecompressionBombError) as error:
        raise ValueError('This file could not be read. Upload a valid JPG, PNG or PDF.') from error
    finally:
        for image in images:
            image.close()
