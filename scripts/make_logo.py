from PIL import Image, ImageFilter
from collections import deque, Counter

SRC = "/home/z/my-project/upload/Copilot_20260909_152914.png"
im = Image.open(SRC).convert("RGB")
W, H = im.size
px = im.load()

# 1) Black out the "Made with AI" watermark (top-right corner, pure background there)
wx0, wy1 = int(W * 0.80), int(H * 0.14)
for y in range(0, wy1):
    for x in range(wx0, W):
        px[x, y] = (0, 0, 0)

# 2) nonblack mask
TOL = 42
nonblack = bytearray(W * H)
for y in range(H):
    row = y * W
    for x in range(W):
        r, g, b = px[x, y]
        if r > TOL or g > TOL or b > TOL:
            nonblack[row + x] = 1

# 3) Connected components over nonblack; keep only big ones (kills speckles)
lbl = [0] * (W * H)
sizes = {}
cur = 0
for i in range(W * H):
    if nonblack[i] and lbl[i] == 0:
        cur += 1
        dq = deque([i]); lbl[i] = cur; n = 0
        while dq:
            j = dq.popleft(); n += 1
            x, y = j % W, j // W
            for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                if 0 <= nx < W and 0 <= ny < H:
                    k = ny * W + nx
                    if nonblack[k] and lbl[k] == 0:
                        lbl[k] = cur; dq.append(k)
        sizes[cur] = n
big = {c for c, n in sizes.items() if n >= 100}
print("components:", cur, "| big:", len(big), "| biggest sizes:", sorted(sizes.values(), reverse=True)[:6])

content = bytearray(W * H)
for i in range(W * H):
    if lbl[i] in big:
        content[i] = 1

# 4) Flood from borders over NON-content -> outside background (black + speckles)
outside = bytearray(W * H)
dq = deque()
for x in range(W):
    for y in (0, H - 1):
        if not content[y * W + x] and not outside[y * W + x]:
            outside[y * W + x] = 1; dq.append((x, y))
for y in range(H):
    for x in (0, W - 1):
        if not content[y * W + x] and not outside[y * W + x]:
            outside[y * W + x] = 1; dq.append((x, y))
while dq:
    x, y = dq.popleft()
    for nx, ny in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
        if 0 <= nx < W and 0 <= ny < H:
            k = ny * W + nx
            if not content[k] and not outside[k]:
                outside[k] = 1; dq.append((nx, ny))

# 5) Alpha: opaque = content + enclosed regions (interior blacks stay opaque)
mask = Image.new("L", (W, H), 255)
mp = mask.load()
kept = 0
for y in range(H):
    row = y * W
    for x in range(W):
        if outside[row + x]:
            mp[x, y] = 0
        else:
            kept += 1
print("opaque px:", kept)

# 6) Morphological opening (remove 1-2px appendages/speckles touching edge), then feather
mask = mask.filter(ImageFilter.GaussianBlur(0.7))

# 7) Crop to content with padding
bbox = mask.point(lambda a: 255 if a > 10 else 0).getbbox()
print("content bbox:", bbox)
PAD = 12
x0, y0, x1, y1 = bbox
x0 = max(0, x0 - PAD); y0 = max(0, y0 - PAD)
x1 = min(W, x1 + PAD); y1 = min(H, y1 + PAD)

logo = im.convert("RGBA")
logo.putalpha(mask)
logo = logo.crop((x0, y0, x1, y1))
lw, lh = logo.size

# count remaining stray dots outside main blob area (quality check)
if lh > 900:
    logo = logo.resize((round(lw * 900 / lh), 900), Image.LANCZOS)
logo.save("/home/z/my-project/public/knight-logo.png", optimize=True)
print("saved public/knight-logo.png", logo.size)

def square_icon(size, out):
    inner = int(size * 0.94)
    ratio = logo.width / logo.height
    if ratio >= 1:
        w2 = inner; h2 = round(inner / ratio)
    else:
        h2 = inner; w2 = round(inner * ratio)
    r = logo.resize((w2, h2), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(r, ((size - w2) // 2, (size - h2) // 2), r)
    canvas.save(out, optimize=True)
    print("saved", out, canvas.size)

square_icon(512, "/home/z/my-project/src/app/icon.png")
square_icon(180, "/home/z/my-project/src/app/apple-icon.png")
