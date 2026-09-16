"""Create a synthetic receipt fixture; contains no real financial information."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1] / 'tests' / 'fixtures'
root.mkdir(parents=True, exist_ok=True)
fonts = [Path('C:/Windows/Fonts/consola.ttf'), Path('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf')]
font_path = next((str(f) for f in fonts if f.exists()), None)
font = ImageFont.truetype(font_path, 36) if font_path else ImageFont.load_default(size=36)
image = Image.new('RGB', (850, 1050), 'white')
draw = ImageDraw.Draw(image)
lines = ['THE DAILY BREW', '', '17/09/2026', '', 'Oat milk latte       125.00', 'Butter croissant      85.00', '', 'TOTAL                210.00', '', 'Thank you!', '', 'SYNTHETIC TEST RECEIPT']
for i, line in enumerate(lines):
    draw.text((65, 65 + i * 70), line, fill='black', font=font)
image.save(root / 'receipt.png')
image.save(root / 'receipt.pdf', 'PDF', resolution=150)
print('Created synthetic PNG and PDF receipt fixtures.')
