# scripts/parse_pdf.py
import sys, io, json, os
import fitz  # PyMuPDF
import pytesseract
from PIL import Image, ImageOps, ImageFilter

# Tune these
MIN_CHARS_BEFORE_OCR = 25       # if extracted text shorter than this, try OCR
OCR_SCALE = 4                   # 4 => ~384 DPI on typical 96 DPI baseline
TESS_LANG = os.getenv("TESS_LANG", "eng")
TESS_CONFIG = os.getenv("TESS_CONFIG", "--psm 6")  # psm 6 = blocks of text

def cleaned_text(s: str) -> str:
    if not s:
        return ""
    # Normalize whitespace
    return " ".join(s.split())

def extract_text_from_page(page) -> str:
    # Try multiple MuPDF modes before OCR
    txt = page.get_text("text")
    txt = cleaned_text(txt)
    if len(txt) >= MIN_CHARS_BEFORE_OCR:
        return txt

    # Some PDFs have better luck with "blocks" or "raw"
    for mode in ("blocks", "raw"):
        try:
            t = page.get_text(mode)
            t = cleaned_text(t)
            if len(t) >= MIN_CHARS_BEFORE_OCR:
                return t
        except Exception:
            pass

    # Still not enough: we'll OCR
    return ""

def ocr_page(page) -> str:
    # Render high-res bitmap
    mat = fitz.Matrix(OCR_SCALE, OCR_SCALE)  # scale up
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("L")  # grayscale

    # Light denoise/normalize baseline; tweak as needed
    img = ImageOps.autocontrast(img)
    img = img.filter(ImageFilter.MedianFilter(size=3))

    txt = pytesseract.image_to_string(img, lang=TESS_LANG, config=TESS_CONFIG)
    return cleaned_text(txt)

def extract_text(path):
    pages = []
    full_text_parts = []

    with fitz.open(path) as doc:
        # Try to open encrypted docs with empty password
        if doc.is_encrypted:
            try:
                doc.authenticate("")  # empty password often works
            except Exception:
                pass

        for idx, page in enumerate(doc, start=1):
            method = "mupdf"
            txt = ""
            try:
                txt = extract_text_from_page(page)
                if len(txt) < MIN_CHARS_BEFORE_OCR:
                    # OCR fallback
                    method = "ocr"
                    txt = ocr_page(page)
            except Exception as e:
                method = "error"
                txt = f""  # keep going

            pages.append({
                "page": idx,
                "method": method,
                "chars": len(txt)
            })
            full_text_parts.append(txt)

    return {
        "text": "\n\n".join([t for t in full_text_parts if t]),
        "pages": pages
    }

if __name__ == "__main__":
    pdf_path = sys.argv[1]
    try:
        result = extract_text(pdf_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
