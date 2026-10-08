#!/usr/bin/env python3
"""Post-proceso de footers para el docx de Knight FM (WPS-safe):
- Elimina <w:pgNumType/> vacíos de la sección de portada.
- Añade el switch de formato explícito al campo PAGE de cada footer:
  sección romana -> PAGE \\* ROMAN \\* MERGEFORMAT, sección arábiga -> PAGE \\* arabic \\* MERGEFORMAT.
"""
import re
import sys
import zipfile

path = sys.argv[1]
zin = zipfile.ZipFile(path)
items = {n: zin.read(n) for n in zin.namelist()}
zin.close()

doc = items["word/document.xml"].decode("utf-8")
doc = doc.replace("<w:pgNumType/>", "")

# Mapa: footer rId -> formato de la sección que lo referencia
rid_fmt = {}
for blk in re.findall(r"<w:sectPr[ >].*?</w:sectPr>", doc, re.S):
    fmt = "upperRoman" if "upperRoman" in blk else ("decimal" if 'w:fmt="decimal"' in blk else None)
    if fmt:
        for rid in re.findall(r'<w:footerReference[^>]*r:id="(rId\d+)"', blk):
            rid_fmt[rid] = fmt

rels = items["word/_rels/document.xml.rels"].decode("utf-8")
rid_to_file = dict(re.findall(r'Id="(rId\d+)"[^>]*Target="(footer\d+\.xml)"', rels))

patched = []
for rid, fmt in rid_fmt.items():
    fname = rid_to_file.get(rid)
    if not fname:
        continue
    key = "word/" + fname
    xml = items[key].decode("utf-8")
    switch = "ROMAN" if fmt == "upperRoman" else "arabic"
    new_xml, n = re.subn(
        r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
        r"\1 PAGE \\* " + switch + r" \\* MERGEFORMAT \2",
        xml,
    )
    if n:
        items[key] = new_xml.encode("utf-8")
        patched.append((fname, switch, n))

items["word/document.xml"] = doc.encode("utf-8")
zout = zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED)
for name, data in items.items():
    zout.writestr(name, data)
zout.close()
print("pgNumType vacíos eliminados; footers parcheados:", patched)
