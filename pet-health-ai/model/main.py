import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import io
from pathlib import Path
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms, models
from transformers import CLIPProcessor, CLIPModel
from fastapi import FastAPI, File, Form, Query, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Pet Health AI API")

# เปิด CORS ให้ React (Vite) เรียกใช้งานได้
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
CLASSES_LIST = [
    "bacterial_dermatosis",
    "demodicosis",
    "dermatitis",
    "fungal_infection",
    "healthy",
    "hypersensitivity",
]
IDX_TO_CLASS = {idx: cls_name for idx, cls_name in enumerate(CLASSES_LIST)}

# =========================================================
# 1. โหลดทั้ง 2 โมเดล (MobileNetV3-Small และ EfficientNet-B0)
# =========================================================
MODEL_DIR = Path(__file__).parent

# 1.1 โหลด MobileNetV3-Small (เช็คทั้งชื่อ mobilenet_model.pth และ best_dog_model.pth)
mobilenet_path = MODEL_DIR / "mobilenet_model.pth"
if not mobilenet_path.exists():
    mobilenet_path = MODEL_DIR / "best_dog_model.pth"

model_mobilenet = None
if mobilenet_path.exists():
    model_mobilenet = models.mobilenet_v3_small()
    model_mobilenet.classifier[3] = nn.Linear(1024, len(CLASSES_LIST))
    model_mobilenet.load_state_dict(torch.load(mobilenet_path, map_location=device))
    model_mobilenet = model_mobilenet.to(device).eval()
    print(f"✅ โหลด MobileNetV3-Small สำเร็จ ({mobilenet_path.name})")

# 1.2 โหลด EfficientNet-B0
efficientnet_path = MODEL_DIR / "efficientnet_model.pth"
model_efficientnet = None
efficientnet_is_finetuned = False

if efficientnet_path.exists():
    sd_eff = torch.load(efficientnet_path, map_location=device)
    model_efficientnet = models.efficientnet_b0()
    in_features = model_efficientnet.classifier[1].in_features
    out_classes = sd_eff["classifier.1.weight"].shape[0]

    if out_classes == len(CLASSES_LIST):
        # กรณีเทรน 6 คลาสแล้ว
        model_efficientnet.classifier[1] = nn.Linear(in_features, len(CLASSES_LIST))
        model_efficientnet.load_state_dict(sd_eff)
        efficientnet_is_finetuned = True
        print(f"✅ โหลด EfficientNet-B0 (เทรน 6 โรคแล้ว) สำเร็จ ({efficientnet_path.name})")
    else:
        # กรณีเป็น Pretrained 1000 คลาส ให้โหลด Backbone ก่อนแล้วปรับหัวเป็น 6 คลาส
        model_efficientnet.load_state_dict(sd_eff, strict=False)
        model_efficientnet.classifier[1] = nn.Linear(in_features, len(CLASSES_LIST))
        print(f"ℹ️ โหลด EfficientNet-B0 (Pretrained ตั้งต้น) สำเร็จ ({efficientnet_path.name})")

    model_efficientnet = model_efficientnet.to(device).eval()

# =========================================================
# 2. โหลดโมเดล CLIP Guardrail คัดกรองรูปสุนัข/แผลสุนัข
# =========================================================
clip_model_name = "openai/clip-vit-base-patch32"
clip_model = CLIPModel.from_pretrained(clip_model_name).to(device)
clip_processor = CLIPProcessor.from_pretrained(clip_model_name)
clip_model.eval()

inference_transforms = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


def check_is_dog_or_lesion(pil_img: Image.Image) -> bool:
    candidate_labels = [
        "a photo of a dog",
        "a close-up photo of dog skin lesion, rash, fur, or wound",
        "a photo of a cat, kitten, or other pet",
        "a photo of a bird, human, or other animal",
        "a photo of an everyday object, landscape, or food",
    ]
    inputs = clip_processor(text=candidate_labels, images=pil_img, return_tensors="pt", padding=True).to(device)
    with torch.no_grad():
        outputs = clip_model(**inputs)
        probs = outputs.logits_per_image.softmax(dim=1)[0]

    dog_and_lesion_prob = probs[0].item() + probs[1].item()
    other_prob = probs[2:].sum().item()
    return (dog_and_lesion_prob > 0.50) and (dog_and_lesion_prob > other_prob)


def predict_with_model(m: nn.Module, input_tensor: torch.Tensor):
    with torch.no_grad():
        outputs = m(input_tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]
    results = [
        {"label": IDX_TO_CLASS[i], "score": round(float(prob.item()), 4)}
        for i, prob in enumerate(probabilities)
    ]
    results.sort(key=lambda x: x["score"], reverse=True)
    return results


@app.post("/predict")
async def predict_endpoint(
    image: UploadFile = File(...),
    model_type: str = Query("auto", description="เลือกโมเดล: auto | mobilenet | efficientnet | both"),
):
    image_bytes = await image.read()
    try:
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="ไม่สามารถอ่านไฟล์รูปภาพได้")

    # ด่านที่ 1: CLIP Guardrail (รับเฉพาะสุนัขและรอยโรคผิวหนังสุนัขเท่านั้น)
    if not check_is_dog_or_lesion(pil_img):
        raise HTTPException(
            status_code=400,
            detail="ตรวจพบว่าภาพนี้ไม่ใช่สุนัข หรือไม่ใช่รอยโรคผิวหนังของสุนัข กรุณาอัปโหลดรูปใหม่",
        )

    # ด่านที่ 2: ทำนายด้วยทั้ง 2 โมเดลเพื่อเทียบผลกัน
    input_tensor = inference_transforms(pil_img).unsqueeze(0).to(device)

    res_mobilenet = predict_with_model(model_mobilenet, input_tensor) if model_mobilenet else None
    res_efficientnet = predict_with_model(model_efficientnet, input_tensor) if model_efficientnet else None

    # แสดงตารางเปรียบเทียบใน Terminal ทุกครั้งที่มีการอัปโหลดรูป
    print("\n" + "=" * 58)
    print(f"📊 เปรียบเทียบผลทำนาย 2 โมเดล (ไฟล์: {image.filename})")
    if res_mobilenet:
        top_m = res_mobilenet[0]
        print(f"  🔹 MobileNetV3-Small : {top_m['label']} ({top_m['score']*100:.2f}%)")
    if res_efficientnet:
        top_e = res_efficientnet[0]
        status = "เทรน 6 โรคแล้ว" if efficientnet_is_finetuned else "ยังไม่เทรน 6 โรค"
        print(f"  🔸 EfficientNet-B0   : {top_e['label']} ({top_e['score']*100:.2f}%) [{status}]")
    print("=" * 58 + "\n")

    if model_type == "both":
        return {
            "mobilenet": res_mobilenet,
            "efficientnet": res_efficientnet,
        }
    if model_type == "efficientnet" and res_efficientnet:
        return res_efficientnet
    if model_type == "mobilenet" and res_mobilenet:
        return res_mobilenet

    if efficientnet_is_finetuned and res_efficientnet:
        return res_efficientnet
    if res_mobilenet:
        return res_mobilenet
    if res_efficientnet:
        return res_efficientnet

    raise HTTPException(status_code=500, detail="ไม่พบโมเดลที่พร้อมใช้งานในโฟลเดอร์ model")


@app.post("/compare")
async def compare_models_endpoint(image: UploadFile = File(...)):
    return await predict_endpoint(image=image, model_type="both")


@app.post("/learn")
async def learn_from_feedback(
    image: UploadFile = File(...),
    true_label: str = Form(...),
):
    if true_label not in CLASSES_LIST:
        raise HTTPException(status_code=400, detail=f"ไม่พบคลาส {true_label} ในระบบ")

    image_bytes = await image.read()
    try:
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="ไม่สามารถอ่านไฟล์รูปภาพได้")

    if not check_is_dog_or_lesion(pil_img):
        raise HTTPException(
            status_code=400,
            detail="ตรวจพบว่าภาพนี้ไม่ใช่สุนัข หรือไม่ใช่รอยโรคผิวหนังของสุนัข กรุณาอัปโหลดรูปใหม่",
        )

    save_dir = MODEL_DIR / "learned_data" / true_label
    save_dir.mkdir(parents=True, exist_ok=True)
    save_path = save_dir / f"{len(list(save_dir.glob('*.jpg'))) + 1}_{image.filename}"
    pil_img.save(save_path)

    target_idx = CLASSES_LIST.index(true_label)
    target_tensor = torch.tensor([target_idx], dtype=torch.long, device=device)
    input_tensor = inference_transforms(pil_img).unsqueeze(0).to(device)
    criterion = nn.CrossEntropyLoss()

    losses = {}
    for name, m, pth in [
        ("mobilenet", model_mobilenet, mobilenet_path),
        ("efficientnet", model_efficientnet, efficientnet_path),
    ]:
        if m is None or pth is None:
            continue
        m.train()
        for param in m.parameters():
            param.requires_grad = False
        for param in m.classifier.parameters():
            param.requires_grad = True

        optimizer = torch.optim.AdamW(m.classifier.parameters(), lr=1e-4, weight_decay=1e-2)
        optimizer.zero_grad()
        outputs = m(input_tensor)
        loss = criterion(outputs, target_tensor)
        loss.backward()
        optimizer.step()
        m.eval()

        torch.save(m.state_dict(), pth)
        losses[name] = round(float(loss.item()), 4)

    return {
        "message": f"สอนทั้ง 2 โมเดลสำหรับโรค '{true_label}' สำเร็จ",
        "losses": losses,
        "saved_image": str(save_path),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)