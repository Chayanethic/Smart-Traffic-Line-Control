import base64
import io
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
MODEL_NAME = os.getenv("YOLO_MODEL", "yolo11n.pt")
VEHICLE_CLASSES = {"car", "motorcycle", "bus", "truck"}
MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", str(5 * 1024 * 1024)))
model = None
model_error = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global model, model_error
    try:
        from ultralytics import YOLO
        model = YOLO(MODEL_NAME)
    except Exception as exc:
        model_error = str(exc)
    yield


app = FastAPI(title="STCS Vehicle Detection", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": model is not None, "model": MODEL_NAME, "modelError": model_error, "vehicleClasses": sorted(VEHICLE_CLASSES)}


@app.post("/detect")
async def detect(image: UploadFile = File(...), confidence: float = Form(0.35)):
    if model is None:
        raise HTTPException(503, f"YOLO model is not available: {model_error or 'model is loading'}")
    if image.content_type not in {"image/jpeg", "image/png", "image/bmp", "image/webp"}:
        raise HTTPException(415, "Upload JPEG, PNG, BMP, or WebP.")
    data = await image.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Image exceeds the 5 MB limit.")
    try:
        source = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as exc:
        raise HTTPException(400, f"Invalid image: {exc}") from exc

    started = time.perf_counter()
    result = model.predict(source=source, conf=max(0.05, min(0.95, confidence)), verbose=False)[0]
    inference_ms = round((time.perf_counter() - started) * 1000)
    detections = []

    if result.boxes is not None:
        for box in result.boxes:
            class_id = int(box.cls.item())
            label = result.names[class_id]
            if label not in VEHICLE_CLASSES:
                continue
            x1, y1, x2, y2 = [round(value, 1) for value in box.xyxy[0].tolist()]
            detections.append({
                "class": label,
                "confidence": round(float(box.conf.item()), 4),
                "box": [x1, y1, x2, y2],
            })

    annotated = source.copy()
    from PIL import ImageDraw
    draw = ImageDraw.Draw(annotated)
    for detection in detections:
        x1, y1, x2, y2 = detection["box"]
        draw.rectangle((x1, y1, x2, y2), outline=(18, 143, 91), width=3)
        draw.rectangle((x1, max(0, y1 - 18), x1 + 105, y1), fill=(18, 143, 91))
        draw.text((x1 + 3, max(0, y1 - 16)), f'{detection["class"]} {detection["confidence"]:.0%}', fill="white")

    output = io.BytesIO()
    annotated.save(output, format="JPEG", quality=82, optimize=True)
    return {
        "vehicleCount": len(detections),
        "detections": detections,
        "inferenceMs": inference_ms,
        "imageWidth": source.width,
        "imageHeight": source.height,
        "annotatedImage": "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii"),
        "model": MODEL_NAME,
    }
