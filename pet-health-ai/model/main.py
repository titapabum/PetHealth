import os
import sys
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import io
from pathlib import Path
import torch
import torch.nn as nn
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
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

NORM_MEAN = [0.485, 0.456, 0.406]
NORM_STD = [0.229, 0.224, 0.225]

inference_transforms = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=NORM_MEAN, std=NORM_STD),
])

# Transforms สำหรับการเรียนรู้ (Data Augmentation รองรับมุมแสง ภาพมืด ภาพเบลอ มุมเอียง)
learn_augmentation_transforms = transforms.Compose([
    transforms.RandomResizedCrop((224, 224), scale=(0.65, 1.0)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomVerticalFlip(p=0.2),
    transforms.RandomRotation(degrees=30),
    transforms.ColorJitter(brightness=0.45, contrast=0.45, saturation=0.35, hue=0.08),
    transforms.RandomApply([transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 2.0))], p=0.4),
    transforms.ToTensor(),
    transforms.Normalize(mean=NORM_MEAN, std=NORM_STD),
])


def enhance_image_for_lighting_and_blur(pil_img: Image.Image) -> Image.Image:
    """
    ปรับปรุงคุณภาพภาพอัตโนมัติกรณีแสงมืด แสงจ้า คอนทราสต์ต่ำ หรือถ่ายไม่ชัด
    """
    img = pil_img.convert("RGB")
    gray = img.convert("L")
    pixels = list(gray.getdata())
    avg_brightness = sum(pixels) / max(len(pixels), 1)

    # ปรับ Autocontrast เพื่อดึงรายละเอียดของรอยโรคและเส้นขนที่จมอยู่ในเงามืดหรือแสงสะท้อน
    img = ImageOps.autocontrast(img, cutoff=1)

    # ชดเชยความสว่างหากภาพมืดเกินไป หรือลดแสงหากภาพสว่างจ้าเกินไป
    if avg_brightness < 90:
        factor = min(1.6, max(1.15, 115.0 / max(avg_brightness, 1.0)))
        img = ImageEnhance.Brightness(img).enhance(factor)
        img = ImageEnhance.Contrast(img).enhance(1.25)
    elif avg_brightness > 200:
        img = ImageEnhance.Brightness(img).enhance(0.82)
        img = ImageEnhance.Contrast(img).enhance(1.2)

    # เพิ่มความคมชัดให้ภาพที่เบลอหรือโฟกัสไม่ชัด
    img = ImageEnhance.Sharpness(img).enhance(1.5)
    return img


def build_tta_batch(pil_img: Image.Image) -> torch.Tensor:
    """
    สร้างชุดภาพ Test-Time Augmentation (TTA) หลายมุมแสง/ความคมชัด/ระยะซูม
    เพื่อให้โมเดลตอบได้แม่นยำแม้ภาพถ่ายจะมืด เบลอ มีขอบดำ หรือมุมแสงเพี้ยน
    """
    w, h = pil_img.size
    enhanced = enhance_image_for_lighting_and_blur(pil_img)

    # ตัดขอบภาพออก 12% สำหรับกรณีถ่ายติดขอบจอมือถือหรือเงาขอบภาพ
    crop_box = (int(w * 0.12), int(h * 0.12), int(w * 0.88), int(h * 0.88))
    center_cropped = enhanced.crop(crop_box) if (w > 64 and h > 64) else enhanced

    # ภาพเพิ่มความคมชัดสูงสำหรับกรณีถ่ายเบลอมาก
    sharpened = enhanced.filter(ImageFilter.SHARPEN)

    # ภาพจำลองแสงสว่างขึ้นและคอนทราสต์จัดขึ้น
    brighter = ImageEnhance.Contrast(ImageEnhance.Brightness(enhanced).enhance(1.2)).enhance(1.2)

    # ภาพกลับด้านแนวนอน
    flipped = ImageOps.mirror(enhanced)

    views = [
        pil_img,          # 1. ภาพต้นฉบับ
        enhanced,         # 2. ภาพปรับสมดุลแสงและเงาอัตโนมัติ
        center_cropped,   # 3. ภาพซูมตัดขอบดำ/เงารอบนอก
        sharpened,        # 4. ภาพแก้เบลอ/เพิ่มความคมชัด
        brighter,         # 5. ภาพดึงรายละเอียดในที่มืด
        flipped,          # 6. ภาพกลับด้านเพื่อลดอคติของมุมแสง
    ]
    tensors = [inference_transforms(v) for v in views]
    return torch.stack(tensors, dim=0).to(device)


def check_is_dog_or_lesion(pil_img: Image.Image) -> bool:
    """
    คัดกรองภาพด้วย CLIP โดยรองรับภาพสุนัข ภาพซูมผิวหนัง/เส้นขนระยะประชิด (Macro)
    รวมถึงภาพที่ถ่ายในมุมมืด แสงสะท้อน หรือเบลอไม่ชัดเจน
    """
    enhanced_img = enhance_image_for_lighting_and_blur(pil_img)

    candidate_labels = [
        # กลุ่มที่ 1 (Indices 0-3): ภาพสุนัข รอยโรคผิวหนัง เส้นขน หรือภาพซูมผิวระยะใกล้แม้ไม่ชัด/แสงน้อย
        "a photo of a dog, puppy, or canine",
        "a close-up macro photo of animal skin, fur, hair, rash, scab, wound, or dermatitis",
        "a blurry, dim, or low-light close-up texture of skin, hair, fur, or dermatology lesion",
        "a veterinary dermatoscope or microscope image of skin and hair",
        # กลุ่มที่ 2 (Indices 4-7): ภาพสัตว์อื่น (แมว นก) หรือสิ่งของ อาหาร วิว เอกสาร หน้าคน
        "a photo of a cat or kitten",
        "a photo of a bird, poultry, or wild animal",
        "a photo of delicious food, meal, drink, car, building, or everyday object",
        "a clear portrait photo of a human face or person standing",
    ]

    # ทดสอบทั้งภาพต้นฉบับและภาพที่ปรับแสงแล้ว (ใช้ค่าที่ดีที่สุด)
    inputs = clip_processor(
        text=candidate_labels,
        images=[pil_img, enhanced_img],
        return_tensors="pt",
        padding=True,
    ).to(device)

    with torch.no_grad():
        outputs = clip_model(**inputs)
        probs = outputs.logits_per_image.softmax(dim=1)

    # คำนวณคะแนนฝั่งภาพสุนัข/ผิวหนัง/เส้นขน เทียบกับภาพแมว/นก/สิ่งของ/วิว/คน
    pos_prob_orig = probs[0, :4].sum().item()
    pos_prob_enh = probs[1, :4].sum().item()
    best_pos_prob = max(pos_prob_orig, pos_prob_enh)

    return best_pos_prob >= 0.45


def predict_with_model(m: nn.Module, input_batch: torch.Tensor):
    """
    ทำนายผลด้วยชุดภาพ TTA (หลายสภาพแสง/ความชัด) แล้วเฉลี่ยความน่าจะเป็น
    """
    with torch.no_grad():
        outputs = m(input_batch)
        probabilities = torch.softmax(outputs, dim=1).mean(dim=0)
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

    # ด่านที่ 1: CLIP Guardrail (รองรับภาพซูมผิวหนัง ภาพมืด และภาพเบลอ)
    if not check_is_dog_or_lesion(pil_img):
        raise HTTPException(
            status_code=400,
            detail="ตรวจพบว่าภาพนี้ไม่ใช่สุนัข หรือไม่ใช่รอยโรคผิวหนังของสุนัข กรุณาอัปโหลดรูปใหม่",
        )

    # ด่านที่ 2: ทำนายด้วย TTA Batch (6 มุมมอง/สภาพแสง) เพื่อให้ตอบได้แม่นยำแม้ภาพไม่ชัด
    tta_batch = build_tta_batch(pil_img)

    res_mobilenet = predict_with_model(model_mobilenet, tta_batch) if model_mobilenet else None
    res_efficientnet = predict_with_model(model_efficientnet, tta_batch) if model_efficientnet else None

    # แสดงตารางเปรียบเทียบใน Terminal ทุกครั้งที่มีการอัปโหลดรูป
    print("\n" + "=" * 58)
    print(f"📊 เปรียบเทียบผลทำนาย 2 โมเดล [TTA Multi-Light/Blur] (ไฟล์: {image.filename})")
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

    save_dir = MODEL_DIR / "learned_data" / true_label
    save_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(image.filename or "image.jpg").name
    save_path = save_dir / f"{len(list(save_dir.glob('*'))) + 1}_{safe_name}"
    pil_img.save(save_path)

    target_idx = CLASSES_LIST.index(true_label)
    criterion = nn.CrossEntropyLoss()

    # เตรียมภาพทั้งต้นฉบับและภาพปรับแสง แล้วสุ่ม Augmentation 8 รูปแบบ (มุมแสง/เบลอ/หมุน/ซูม)
    enhanced_img = enhance_image_for_lighting_and_blur(pil_img)
    aug_tensors = [
        inference_transforms(pil_img),
        inference_transforms(enhanced_img),
    ]
    for _ in range(6):
        aug_tensors.append(learn_augmentation_transforms(pil_img))
        aug_tensors.append(learn_augmentation_transforms(enhanced_img))

    train_batch = torch.stack(aug_tensors, dim=0).to(device)
    target_batch = torch.full((train_batch.size(0),), target_idx, dtype=torch.long, device=device)

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
        # เปิดให้เรียนรู้ทั้งส่วน Classifier และ Feature สุดท้ายเพื่อจับลักษณะแสง/พื้นผิวที่ไม่ชัด
        if hasattr(m, "features") and len(m.features) > 0:
            for param in m.features[-1].parameters():
                param.requires_grad = True
        for param in m.classifier.parameters():
            param.requires_grad = True

        trainable_params = [p for p in m.parameters() if p.requires_grad]
        optimizer = torch.optim.AdamW(trainable_params, lr=2e-4, weight_decay=1e-2)

        step_loss = 0.0
        for _ in range(3):
            optimizer.zero_grad()
            outputs = m(train_batch)
            loss = criterion(outputs, target_batch)
            loss.backward()
            optimizer.step()
            step_loss = float(loss.item())

        m.eval()
        torch.save(m.state_dict(), pth)
        losses[name] = round(step_loss, 4)

    return {
        "message": f"สอนทั้ง 2 โมเดลสำหรับโรค '{true_label}' สำเร็จ (เรียนรู้มุมแสงและภาพเบลอ 14 รูปแบบ)",
        "losses": losses,
        "saved_image": str(save_path),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
