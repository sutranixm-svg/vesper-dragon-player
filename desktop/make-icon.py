"""Build the app's original vector-like vinyl emblem in PNG and Windows ICO sizes."""
from pathlib import Path
from PIL import Image, ImageDraw
import math

base = Path(__file__).resolve().parent
size = 1024
icon = Image.new('RGBA', (size, size))
draw = ImageDraw.Draw(icon)
draw.rounded_rectangle((24, 24, 1000, 1000), radius=210, fill='#17150f', outline='#bfa16b', width=10)
draw.ellipse((115, 115, 909, 909), fill='#090b0a', outline='#736d57', width=4)
for r in range(182, 388, 9):
    draw.ellipse((512-r, 512-r, 512+r, 512+r), outline='#34352c', width=2)
for r in range(172, 0, -1):
    t = r/172
    draw.ellipse((512-r, 512-r, 512+r, 512+r), fill=(int(211-50*t), int(177-54*t), int(96-44*t)))
draw.line([(422, 420), (508, 609), (604, 420)], fill='#fff0c4', width=26, joint='curve')
draw.ellipse((498, 498, 526, 526), fill='#14150f', outline='#efe8c9', width=4)
(base/'assets').mkdir(exist_ok=True)
icon.save(base/'assets/icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
icon.resize((512,512), Image.Resampling.LANCZOS).save(base/'app/icon.png')
