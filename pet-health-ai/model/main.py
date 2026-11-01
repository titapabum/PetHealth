import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import io
from pathlib import Path
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms, models
from transformers import CLIPProcessor, CLIPModel
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
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

# 1. โหลดโมเดลจำแนกโรคผิวหนังสุนัข (รองรับ EfficientNet-B0 และ MobileNetV3-Small)
MODEL_PATH = Path(__file__).parent / "best_dog_model.pth"
state_dict = torch.load(MODEL_PATH, map_location=device)

if "classifier.1.weight" in state_dict:
    # โครงสร้างของ EfficientNet-B0
    print("✅ ตรวจพบโมเดล EfficientNet-B0")
    disease_model = models.efficientnet_b0()
    in_features = disease_model.classifier[1].in_features
    disease_model.classifier[1] = nn.Linear(in_features, len(CLASSES_LIST))
else:
    # โครงสร้างเดิมของ MobileNetV3-Small (ใช้ชั่วคราวหากยังไม่ได้วางไฟล์ .pth ใหม่)
    print("ℹ️ ตรวจพบไฟล์น้ำหนักเดิม (MobileNetV3-Small) — หากเทรน EfficientNet-B0 เสร็จให้นำมาวางทับ best_dog_model.pth ได้เลย")
    disease_model = models.mobilenet_v3_small()
    in_features = disease_model.classifier[3].in_features
    disease_model.classifier[3] = nn.Linear(in_features, len(CLASSES_LIST))

disease_model.load_state_dict(state_dict)
disease_model = disease_model.to(device)
disease_model.eval()

# 2. โหลดโมเดล CLIP Guardrail คัดกรองรูปสุนัข/แผลสุนัข
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


@app.post("/predict")
async def predict_endpoint(image: UploadFile = File(...)):
    image_bytes = await image.read()
    try:
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="ไม่สามารถอ่านไฟล์รูปภาพได้")

    # ด่านที่ 1: CLIP Guardrail (รับเฉพาะสุนัขและรอยโรคผิวหนังสุนัขเท่านั้น)
    is_valid = check_is_dog_or_lesion(pil_img)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="ตรวจพบว่าภาพนี้ไม่ใช่สุนัข หรือไม่ใช่รอยโรคผิวหนังของสุนัข กรุณาอัปโหลดรูปใหม่",
        )

    # ด่านที่ 2: ทำนายโรคผิวหนัง 6 คลาส
    input_tensor = inference_transforms(pil_img).unsqueeze(0).to(device)
    with torch.no_grad():
        outputs = disease_model(input_tensor)
        probabilities = torch.softmax(outputs, dim=1)[0]

    # จัดเรียงผลลัพธ์จากโอกาสมากสุดไปน้อยสุด ส่งกลับตามรูปแบบที่ App.jsx ต้องการ
    results = [
        {"label": IDX_TO_CLASS[i], "score": round(float(prob.item()), 4)}
        for i, prob in enumerate(probabilities)
    ]
    results.sort(key=lambda x: x["score"], reverse=True)
    return results


@app.post("/learn")
async def learn_from_feedback(
    image: UploadFile = File(...),
    true_label: str = Form(...),
):
    """
    ให้โมเดลเรียนรู้เพิ่มเติมจากรูปภาพและคลาสโรคที่ถูกต้องโดยตรงใน main.py (ไม่ต้องผ่าน Colab)
    """
    if true_label not in CLASSES_LIST:
        raise HTTPException(status_code=400, detail=f"ไม่พบคลาส {true_label} ในระบบ")

    image_bytes = await image.read()
    try:
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="ไม่สามารถอ่านไฟล์รูปภาพได้")

    # ตรวจสอบด้วย CLIP Guardrail ก่อนนำไปสอนโมเดล
    if not check_is_dog_or_lesion(pil_img):
        raise HTTPException(
            status_code=400,
            detail="ตรวจพบว่าภาพนี้ไม่ใช่สุนัข หรือไม่ใช่รอยโรคผิวหนังของสุนัข กรุณาอัปโหลดรูปใหม่",
        )

    # บันทึกรูปภาพเก็บไว้ในโฟลเดอร์ learned_data แยกตามคลาส
    save_dir = Path(__file__).parent / "learned_data" / true_label
    save_dir.mkdir(parents=True, exist_ok=True)
    save_path = save_dir / f"{len(list(save_dir.glob('*.jpg'))) + 1}_{image.filename}"
    pil_img.save(save_path)

    # ทำ Incremental Fine-Tuning เฉพาะส่วน Classifier ด้วย Learning Rate ต่ำ
    target_idx = CLASSES_LIST.index(true_label)
    target_tensor = torch.tensor([target_idx], dtype=torch.long, device=device)
    input_tensor = inference_transforms(pil_img).unsqueeze(0).to(device)

    disease_model.train()
    for param in disease_model.parameters():
        param.requires_grad = False
    for param in disease_model.classifier.parameters():
        param.requires_grad = True

    optimizer = torch.optim.AdamW(disease_model.classifier.parameters(), lr=1e-4, weight_decay=1e-2)
    criterion = nn.CrossEntropyLoss()

    optimizer.zero_grad()
    outputs = disease_model(input_tensor)
    loss = criterion(outputs, target_tensor)
    loss.backward()
    optimizer.step()

    disease_model.eval()
    torch.save(disease_model.state_dict(), MODEL_PATH)

    return {
        "message": f"โมเดลเรียนรู้รูปภาพสำหรับโรค '{true_label}' และอัปเดตไฟล์ best_dog_model.pth สำเร็จ",
        "loss": round(float(loss.item()), 4),
        "saved_image": str(save_path),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
