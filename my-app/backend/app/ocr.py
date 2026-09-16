import io
import shutil
import subprocess
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError
import pytesseract
import pypdfium2 as pdfium
from .config import settings

Image.MAX_IMAGE_PIXELS = 25_000_000

def read_receipt(path: Path, is_pdf: bool):
    images = []
    try:
        if is_pdf:
            document = pdfium.PdfDocument(str(path))
            try:
                if len(document) > 5:
                    raise ValueError('PDFs must contain at most 5 pages.')
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
        texts = []
        for index, image in enumerate(images):
            image.thumbnail((3000, 3000))
            if settings.tesseract_cmd or shutil.which('tesseract'):
                if settings.tesseract_cmd:
                    pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
                texts.append(pytesseract.image_to_string(image, lang=settings.ocr_languages, timeout=60))
            else:
                # The same Tesseract engine via WASM enables development on Windows without a system install.
                temp = path.with_suffix(f'.{index}.ocr.png')
                try:
                    image.save(temp)
                    script = Path(__file__).resolve().parents[2] / 'scripts' / 'ocr.mjs'
                    result = subprocess.run(['node', str(script), str(temp)], capture_output=True, text=True, encoding='utf-8', timeout=90)
                    if result.returncode:
                        raise RuntimeError('OCR engine is unavailable. Install Tesseract with eng/tha languages or npm dependencies.')
                    texts.append(result.stdout)
                finally:
                    temp.unlink(missing_ok=True)
        return '\n'.join(texts)
    except (UnidentifiedImageError, pdfium.PdfiumError, Image.DecompressionBombError) as error:
        raise ValueError('This file could not be read. Upload a valid JPG, PNG or PDF.') from error
    finally:
        for image in images:
            image.close()
