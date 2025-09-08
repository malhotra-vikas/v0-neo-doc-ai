# parse_pdf.py
import sys, io, json
import fitz  # PyMuPDF
import pytesseract
from PIL import Image


def extract_text(path):
    results = []
    with fitz.open(path) as doc:
        for page in doc:
            text = page.get_text("text")
            if text.strip():
                results.append(text)
            else:
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # upscale for OCR
                img = Image.open(io.BytesIO(pix.tobytes("png")))
                ocr_text = pytesseract.image_to_string(img, lang="eng")
                results.append(ocr_text)
    return "\n\n".join(results)


if __name__ == "__main__":
    pdf_path = sys.argv[1]
    try:
        text = extract_text(pdf_path)
        print(json.dumps({"text": text}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
