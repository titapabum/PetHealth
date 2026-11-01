import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PawPrint, UploadCloud, ImagePlus, Camera, Check as CheckIcon, HeartPulse, ClipboardList, CalendarDays, MapPin, ArrowRight, X, Sparkles, AlertCircle, Pencil } from "lucide-react";
import { PETS, HISTORY, ADVICE, fmtDate, Avatar, Risk, Disclaimer } from "../shared.jsx";

async function predict(file) {
  const base = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const fd = new FormData();
  fd.append("image", file);
  let response;
  try {
    response = await fetch(`${base}/predict`, { method: "POST", body: fd });
  } catch {
    throw new Error("เชื่อมต่อ AI ไม่ได้ กรุณาเปิด API โมเดลก่อนลองอีกครั้ง");
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.detail || "วิเคราะห์ภาพไม่สำเร็จ กรุณาลองภาพอื่นอีกครั้ง");
  if (!Array.isArray(payload)) throw new Error("รูปแบบผลลัพธ์จาก AI ไม่ถูกต้อง");
  const labels = {
    bacterial_dermatosis: "Bacterial Dermatosis",
    demodicosis: "Demodicosis",
    dermatitis: "Dermatitis",
    fungal_infection: "Fungal Infection",
    healthy: "Healthy",
    hypersensitivity: "Hypersensitivity",
  };
  return payload.map(({ label, score }) => ({ label: labels[label] || label, score: Number(score) }))
    .filter((item) => item.label && Number.isFinite(item.score))
    .sort((a, b) => b.score - a.score);
}

export default function Check() {
  const [petId, setPetId] = useState(PETS[1]?.id ?? PETS[0].id);
  const [file, setFile] = useState(null); const [preview, setPreview] = useState("");
  const [drag, setDrag] = useState(false); const [state, setState] = useState("idle");
  const [result, setResult] = useState([]); const [err, setErr] = useState("");
  const input = useRef(null);
  const resultHeading = useRef(null);
  const pet = PETS.find((item) => item.id === Number(petId)) || PETS[0];
  const latest = HISTORY.find((item) => item.pet === pet.id) || HISTORY[0];
  const top = result[0];
  const risk = !top || top.label === "Healthy" ? "low" : top.score >= .7 ? "high" : top.score >= .4 ? "mid" : "low";
  const stage = state === "done" ? 4 : state === "loading" ? 2 : 1;

  useEffect(() => {
    if (state === "done") resultHeading.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);

  const pick = (selected) => {
    if (!selected) return;
    if (!/^image\/(jpeg|png|webp)$/.test(selected.type)) { setErr("รองรับไฟล์ JPG, PNG หรือ WEBP เท่านั้น"); return; }
    if (selected.size > 10 * 1024 * 1024) { setErr("ไฟล์มีขนาดเกิน 10MB กรุณาเลือกไฟล์ใหม่"); return; }
    setErr(""); setFile(selected); setState("idle"); setResult([]);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(selected); });
  };
  const clear = () => { if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(""); setState("idle"); setResult([]); setErr(""); };
  const run = async () => {
    if (!file) return;
    setState("loading"); setErr("");
    try {
      const predictions = await predict(file);
      if (!predictions.length) throw new Error("โมเดลไม่ส่งผลการวิเคราะห์กลับมา");
      setResult(predictions); setState("done");
    } catch (error) {
      setState("error");
      setErr(error.message || "วิเคราะห์ภาพไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง");
    }
  };

  return <div className="check-page">
    <section className="check-hero" aria-label="ตรวจสุขภาพสัตว์เลี้ยงด้วย AI">
      <img className="check-banner-image" src="/dogs/ตรวจสุขภาพสัตว์เลี้ยงด้วย%20AI_banner.png" alt="แบนเนอร์ตรวจสุขภาพสัตว์เลี้ยงด้วย AI" />
    </section>

    <ol className="check-progress">{["อัปโหลดรูป", "วิเคราะห์ผล", "แสดงผลลัพธ์", "คำแนะนำ"].map((label, index) => <li key={label} className={index + 1 <= stage ? "active" : ""}><span>{index + 1}</span><b>{label}</b><i /></li>)}</ol>

    <div className="check-layout">
      <section className="check-left">
        <div className="upload-panel">
          <h2><Camera size={25} fill="currentColor" />อัปโหลดรูปภาพ</h2>
          <div className={`check-drop ${drag ? "dragging" : ""}`} role="button" tabIndex={0}
            onClick={() => input.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") input.current?.click(); }}
            onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(event) => { event.preventDefault(); setDrag(false); pick(event.dataTransfer.files[0]); }}>
            {preview ? <><img className="check-preview-image" src={preview} alt="ภาพที่เลือกสำหรับตรวจสุขภาพ" /><button className="check-clear" type="button" onClick={(event) => { event.stopPropagation(); clear(); }} aria-label="ลบรูปภาพ"><X size={18} /></button></> : <>
              <PawPrint className="drop-paw drop-paw-a" size={42} fill="currentColor" /><PawPrint className="drop-paw drop-paw-b" size={34} fill="currentColor" />
              <UploadCloud className="drop-cloud" size={70} strokeWidth={1.7} />
              <strong>ลากและวางรูปภาพที่นี่ หรือคลิกเพื่อเลือกไฟล์</strong><span>รองรับไฟล์ JPG, PNG, WEBP ขนาดไม่เกิน 10MB</span>
              <i className="or-divider"><span>หรือ</span></i>
              <button type="button" className="choose-image" onClick={(event) => { event.stopPropagation(); input.current?.click(); }}><ImagePlus size={19} />เลือกไฟล์จากเครื่อง</button>
            </>}
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => pick(event.target.files?.[0])} />
          </div>
          {err && <p className="check-error" role="alert"><AlertCircle size={17} />{err}</p>}
          <button type="button" className="check-run" disabled={!file || state === "loading"} onClick={run}>{state === "loading" ? <><Sparkles className="spin" size={18} />กำลังวิเคราะห์ภาพ...</> : <><Sparkles size={18} />เริ่มวิเคราะห์สุขภาพ</>}</button>
        </div>
        <aside className="check-tips"><div className="tip-copy"><h3><HeartPulse size={20} fill="currentColor" />คำแนะนำ</h3><p><CheckIcon />ควรเป็นรูปบริเวณที่เห็นอาการชัดเจน</p><p><CheckIcon />ถ่ายในที่สว่างและภาพคมชัด เพื่อผลลัพธ์ที่แม่นยำยิ่งขึ้น</p></div><img src="/dogs/choco.jpg" alt="สุนัขยิ้มอย่างมีความสุข" /></aside>
        {state === "done" && top && <section className="check-result" aria-live="polite"><h2 ref={resultHeading}><HeartPulse size={21} />ผลการวิเคราะห์เบื้องต้น</h2><div className="check-result-summary"><strong>{top.label}</strong><Risk level={risk} /></div>{result.map((item) => <div className="check-meter" key={item.label}><div><span>{item.label}</span><b>{Math.round(item.score * 100)}%</b></div><i><span style={{ width: `${item.score * 100}%` }} /></i></div>)}<h3>คำแนะนำเบื้องต้น</h3><ul>{(ADVICE[top.label] || ADVICE.default).map((advice) => <li key={advice}>{advice}</li>)}</ul><Disclaimer>ผลนี้เป็นการคัดกรองเบื้องต้นเท่านั้น หากสัตว์เลี้ยงมีอาการผิดปกติควรพบสัตวแพทย์</Disclaimer><Link to="/clinics" className="check-clinic-link"><MapPin size={17} />ค้นหาคลินิกใกล้ฉัน<ArrowRight size={17} /></Link></section>}
      </section>

      <aside className="check-sidebar">
        <section className="pet-info-card"><h2><PawPrint size={22} fill="currentColor" />ข้อมูลสัตว์เลี้ยงของคุณ</h2><div className="pet-info-content"><Avatar pet={pet} size={90} /><div className="pet-meta"><label>ชื่อ <span>:</span><select value={petId} onChange={(event) => setPetId(event.target.value)} aria-label="เลือกสัตว์เลี้ยง">{PETS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Pencil size={14} /></label><p><span className="pet-meta-icon">⌂</span>พันธุ์ : {pet.breed}</p><p><CalendarDays size={17} />อายุ : {pet.age} ปี</p></div></div></section>
        <section className="latest-card"><div className="latest-heading"><h2><ClipboardList size={22} />ประวัติการตรวจล่าสุด</h2><Link to="/history">ดูทั้งหมด <ArrowRight size={16} /></Link></div><Link className="latest-entry" to="/history"><img src={pet.img} alt={pet.name} /><div><small><CalendarDays size={13} />{fmtDate(latest.date).split(" เวลา")[0]}</small><strong>กลุ่มโรค : {latest.disease}</strong></div><Risk level={latest.risk} /></Link></section>
        <section className="check-care-card"><div><h2><ShieldIcon />ดูแลน้องหมาให้แข็งแรงยิ่งขึ้น</h2><p>หมั่นตรวจเช็กความผิดปกติ และพาสัตว์เลี้ยงไปพบสัตวแพทย์ หากอาการไม่ดีขึ้น หรือมีอาการรุนแรง</p><Link to="/about">เรียนรู้เพิ่มเติม <ArrowRight size={16} /></Link></div><img src="/dogs/Golden-Retriever-PNG-File-Download-Free.png" alt="สัตวแพทย์ดูแลสุนัข" /></section>
      </aside>
    </div>
  </div>;
}

function ShieldIcon() { return <span className="check-shield"><HeartPulse size={17} /></span>; }
