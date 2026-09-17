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

Image.MAX_IMAGE_PIXELS = 25_000_000

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
        for index, image in enumerate(images):
            qr_payloads.extend(code.text for code in zxingcpp.read_barcodes(image, formats=zxingcpp.BarcodeFormat.QRCode))
            image.thumbnail((1600, 1800))
            prepared = ImageOps.grayscale(image)
            prepared = prepared.point(lambda value: 255 if value > 180 else value)
            prepared = prepared.resize((prepared.width * 2, prepared.height * 2), Image.Resampling.LANCZOS)
            languages = '+'.join(sorted(settings.ocr_languages.split('+'), key=lambda lang: lang != 'tha'))
            if settings.tesseract_cmd or shutil.which('tesseract'):
                if settings.tesseract_cmd:
                    pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
                texts.append(pytesseract.image_to_string(prepared, lang=languages, config='--psm 11', timeout=60))
            else:
                # The same Tesseract engine via WASM enables development on Windows without a system install.
                with TemporaryDirectory(prefix='ocr-', dir=settings.upload_dir) as temp_dir:
                    temp = Path(temp_dir) / 'slip.png'
                    prepared.save(temp)
                    script = Path(__file__).resolve().parents[2] / 'scripts' / 'ocr.mjs'
                    result = subprocess.run(['node', str(script), str(temp), languages, '11'], capture_output=True, text=True, encoding='utf-8', timeout=90)
                    if result.returncode:
                        raise RuntimeError('OCR engine is unavailable. Install Tesseract with eng/tha languages or npm dependencies.')
                    texts.append(json.loads(result.stdout)['text'])
            prepared.close()
        return {'text': '\n'.join(texts), 'qr_payloads': qr_payloads}
    except (UnidentifiedImageError, pdfium.PdfiumError, Image.DecompressionBombError) as error:
        raise ValueError('This file could not be read. Upload a valid JPG, PNG or PDF.') from error
    finally:
        for image in images:
            image.close()
