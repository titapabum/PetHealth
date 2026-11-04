import os
import sys
from pathlib import Path
import random

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from torchvision import transforms, models

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("⚡ Retraining Device:", device)

CLASSES_LIST = [
    "bacterial_dermatosis",
    "demodicosis",
    "dermatitis",
    "fungal_infection",
    "healthy",
    "hypersensitivity",
]
CLASS_TO_IDX = {cls_name: i for i, cls_name in enumerate(CLASSES_LIST)}

MODEL_DIR = Path(__file__).parent
DATA_DIR = Path(r"C:\Users\titap\Downloads\dog image example\train")
LEARNED_DIR = MODEL_DIR / "learned_data"

# =========================================================
# 1. รวบรวมข้อมูลทุกคลาส (รวมทั้งภาพเทรนเดิมและภาพที่ผู้ใช้ส่งมา)
# =========================================================
def collect_dataset(max_per_class=40):
    samples = []
    by_class = {c: [] for c in CLASSES_LIST}

    # 1.1 ภาพจาก train dataset เดิม
    if DATA_DIR.exists():
        for f in DATA_DIR.rglob("*.jpg"):
            parent_cls = f.parent.name.lower()
            name_lower = f.name.lower()

            if parent_cls == "demodicosis":
                target = "demodicosis"
            elif parent_cls == "healthy":
                target = "healthy"
            elif parent_cls == "hypersensitivity":
                target = "hypersensitivity"
            elif parent_cls in ["fungal_infections", "ringworm"]:
                target = "fungal_infection"
            elif parent_cls == "dermatitis":
                if "bacterial" in name_lower:
                    target = "bacterial_dermatosis"
                else:
                    target = "dermatitis"
            else:
                continue
            by_class[target].append(f)

    # 1.2 ภาพที่เคยเรียนรู้ผ่าน /learn
    if LEARNED_DIR.exists():
        for c in CLASSES_LIST:
            sub = LEARNED_DIR / c
            if sub.exists():
                for f in sub.glob("*"):
                    if f.is_file() and f.suffix.lower() in [".jpg", ".png", ".jpeg"]:
                        by_class[c].append(f)

    # 1.3 สุ่มเลือกตัวอย่างให้สมดุล (Class Balance)
    random.seed(42)
    for c, files in by_class.items():
        if not files:
            continue
        # ถ้ามีน้อย (เช่น bacterial) ให้เก็บทั้งหมด ถ้ามีเยอะให้สุ่มตัวแทน
        chosen = files if len(files) <= max_per_class else random.sample(files, max_per_class)
        for p in chosen:
            samples.append((p, CLASS_TO_IDX[c]))
        print(f"  📁 คลาส {c:22s}: นำมาเทรน {len(chosen)} ภาพ (จากทั้งหมด {len(files)})")

    random.shuffle(samples)
    return samples

# =========================================================
# 2. Data Augmentation สำหรับจำลองสภาพแสงมืด แสงสะท้อน และเบลอ
# =========================================================
NORM_MEAN = [0.485, 0.456, 0.406]
NORM_STD = [0.229, 0.224, 0.225]

train_transforms = transforms.Compose([
    transforms.Resize((240, 240)),
    transforms.RandomResizedCrop((224, 224), scale=(0.7, 1.0)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomRotation(degrees=25),
    # สุ่มสภาพแสง (มืดลง 40% หรือสว่างขึ้น 40%, เพิ่มคอนทราสต์รอยโรค)
    transforms.ColorJitter(brightness=0.4, contrast=0.4, saturation=0.3, hue=0.08),
    # สุ่มภาพเบลอ (กล้องสั่น หรือหลุดโฟกัส)
    transforms.RandomApply([transforms.GaussianBlur(kernel_size=3, sigma=(0.1, 2.0))], p=0.35),
    transforms.ToTensor(),
    transforms.Normalize(mean=NORM_MEAN, std=NORM_STD),
])

class SkinDataset(Dataset):
    def __init__(self, samples, transform=None):
        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        try:
            img = Image.open(path).convert("RGB")
        except Exception:
            img = Image.new("RGB", (224, 224), (128, 128, 128))
        if self.transform:
            img = self.transform(img)
        return img, torch.tensor(label, dtype=torch.long)

# =========================================================
# 3. โหลดโมเดลเดิมมาทำ Fine-Tuning
# =========================================================
def load_models():
    # MobileNetV3-Small
    mob_path = MODEL_DIR / "mobilenet_model.pth"
    mob = models.mobilenet_v3_small()
    mob.classifier[3] = nn.Linear(1024, len(CLASSES_LIST))
    if mob_path.exists():
        mob.load_state_dict(torch.load(mob_path, map_location=device))
        print("✅ โหลด MobileNetV3-Small สำเร็จ")

    # EfficientNet-B0
    eff_path = MODEL_DIR / "efficientnet_model.pth"
    eff = models.efficientnet_b0()
    eff.classifier[1] = nn.Linear(eff.classifier[1].in_features, len(CLASSES_LIST))
    if eff_path.exists():
        sd = torch.load(eff_path, map_location=device)
        eff.load_state_dict(sd)
        print("✅ โหลด EfficientNet-B0 สำเร็จ")

    return (mob, mob_path), (eff, eff_path)

# =========================================================
# 4. กระบวนการเทรน (Batch Retraining Loop)
# =========================================================
def train_model(model, model_name, dataloader, epochs=5):
    print(f"\n🚀 เริ่ม Batch Retraining โมเดล {model_name} ({epochs} Epochs)...")
    model = model.to(device)
    model.train()

    # Freeze ส่วนหน้า ปลดล็อกเฉพาะชั้น Feature ท้ายสุด + Classifier
    for param in model.parameters():
        param.requires_grad = False

    if hasattr(model, "features") and len(model.features) > 0:
        for param in model.features[-2:].parameters():
            param.requires_grad = True

    if hasattr(model, "classifier"):
        for param in model.classifier.parameters():
            param.requires_grad = True

    trainable_params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(trainable_params, lr=1.5e-4, weight_decay=1e-3)
    criterion = nn.CrossEntropyLoss()

    for epoch in range(1, epochs + 1):
        running_loss = 0.0
        correct = 0
        total = 0

        for images, labels in dataloader:
            images = images.to(device)
            labels = labels.to(device)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * images.size(0)
            preds = outputs.argmax(dim=1)
            correct += (preds == labels).sum().item()
            total += labels.size(0)

        epoch_loss = running_loss / max(total, 1)
        epoch_acc = (correct / max(total, 1)) * 100
        print(f"   Epoch {epoch}/{epochs} | Loss: {epoch_loss:.4f} | Accuracy: {epoch_acc:.1f}%")

    model.eval()
    return model

def main():
    print("=" * 60)
    print("🐾 Pet Health AI — Batch Retraining Pipeline (แสง/เงา/เบลอ)")
    print("=" * 60)

    samples = collect_dataset(max_per_class=35)
    dataset = SkinDataset(samples, transform=train_transforms)
    dataloader = DataLoader(dataset, batch_size=16, shuffle=True, drop_last=False)

    (mob, mob_path), (eff, eff_path) = load_models()

    # ทำสำเนา Backup ก่อนบันทึกทับ
    if mob_path.exists():
        torch.save(mob.state_dict(), mob_path.with_name("mobilenet_model_backup.pth"))
    if eff_path.exists():
        torch.save(eff.state_dict(), eff_path.with_name("efficientnet_model_backup.pth"))

    # เทรนทั้ง 2 โมเดล
    mob = train_model(mob, "MobileNetV3-Small", dataloader, epochs=4)
    torch.save(mob.state_dict(), mob_path)
    print(f"💾 บันทึกโมเดล MobileNetV3-Small สำเร็จ: {mob_path.name}")

    eff = train_model(eff, "EfficientNet-B0", dataloader, epochs=4)
    torch.save(eff.state_dict(), eff_path)
    print(f"💾 บันทึกโมเดล EfficientNet-B0 สำเร็จ: {eff_path.name}")

    print("\n🎉 Batch Retraining เสร็จสมบูรณ์เรียบร้อยแล้ว!")

if __name__ == "__main__":
    main()
