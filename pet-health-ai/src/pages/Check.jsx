import { usePets } from "../pet-store.js";
import { diseaseName } from "../disease-labels.js";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PawPrint, UploadCloud, ImagePlus, Camera, Check as CheckIcon, HeartPulse, ClipboardList, CalendarDays, MapPin, ArrowRight, X, Sparkles, AlertCircle, Pencil, Bone } from "lucide-react";
import {  HISTORY, ADVICE, fmtDate, Avatar, Risk, Disclaimer } from "../shared.jsx";

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
  const PETS = usePets();
  const [petId, setPetId] = useState(PETS[1]?.id ?? PETS[0].id);
  const [file, setFile] = useState(null); const [preview, setPreview] = useState("");
  const [drag, setDrag] = useState(false); const [state, setState] = useState("idle");
  const [result, setResult] = useState([]); const [err, setErr] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideSeen, setGuideSeen] = useState(() => {
    try { return localStorage.getItem('doo-pet-guide-seen') === '1'; }
    catch { return false; }
  });
  const guideDialog = useRef(null);
  const guideButton = useRef(null);
  const input = useRef(null);
  const resultHeading = useRef(null);
  const uploadHeading = useRef(null);
  const pet = PETS.find((item) => item.id === Number(petId)) || PETS[0];
  const latest = HISTORY.find((item) => item.pet === pet.id) || HISTORY[0];
  const top = result[0];
  const risk = !top || top.label === "Healthy" ? "low" : top.score >= .7 ? "high" : top.score >= .4 ? "mid" : "low";
  const stage = state === "done" ? 4 : state === "loading" ? 2 : 1;

  useEffect(() => {
    if (state === "done") {
      resultHeading.current?.focus({ preventScroll: true });
      resultHeading.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }
  }, [state]);

  useEffect(() => {
    const dialog = guideDialog.current;
    if (!guideOpen) { if (dialog?.open) dialog.close(); return; }
    dialog.showModal();
    const trigger = guideButton.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      trigger?.focus({ preventScroll: true });
    };
  }, [guideOpen]);

  const openGuide = () => {
    setGuideSeen(true);
    try { localStorage.setItem('doo-pet-guide-seen', '1'); } catch { /* Reading is still available without storage. */ }
    setGuideOpen(true);
  };

  const pick = (selected) => {
    if (!selected || state === "loading") return;
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
    <section className="check-hero check-mascot-banner" aria-labelledby="check-banner-title">
      <img className="check-banner-image check-banner-default" src="/dogs/health-banner-dog-gang-clean.png" alt="" />
      <img className="check-banner-image check-banner-set-two" src="/dogs/check-banner-set-2.png" alt="ตรวจสุขภาพสัตว์เลี้ยง วิเคราะห์โรคผิวหนัง แผล และภาวะเสี่ยงของสุนัข ด้วย ML" />
      <div className="check-banner-paws" aria-hidden="true">
        {Array.from({ length: 22 }, (_, index) => <PawPrint key={index} className="check-banner-paw" style={{ '--paw-x': `${[5, 20, 38, 53, 62, 91, 8, 32, 57, 94, 14, 27, 44, 66, 86, 3, 22, 47, 60, 96, 35, 69][index]}%`, '--paw-y': `${[12, 18, 8, 24, 48, 16, 57, 44, 68, 74, 36, 7, 53, 13, 7, 79, 65, 31, 84, 42, 82, 61][index]}%`, '--paw-size': `${22 + index % 4 * 9}px`, '--paw-angle': `${index % 2 ? 24 : -25}deg`, '--paw-duration': `${8 + index % 4}s`, '--paw-delay': `${-index * 1.5}s` }} />)}
      </div>
      <div className="check-banner-copy">
        <h1 id="check-banner-title"><span className="banner-wordmark">Doo Pet</span> ตรวจสุขภาพสัตว์เลี้ยง <Bone className="banner-bone" size={36} aria-hidden="true" /></h1>
        <p>วิเคราะห์โรคผิวหนัง แผล และภาวะเสี่ยงของสุนัข <span>ด้วยระบบ ML</span></p>
      </div>
      <button ref={guideButton} type="button" className={`check-guide-trigger${guideSeen ? '' : ' is-unread'}`} onClick={openGuide} aria-haspopup="dialog" aria-controls="check-guide-dialog"><AlertCircle size={19} aria-hidden="true" /><span>คลิกเพื่อดูคำแนะนำ</span></button>
    </section>

    <ol className="check-progress">{["อัปโหลดรูป", "วิเคราะห์ผล", "แสดงผลลัพธ์", "คำแนะนำ"].map((label, index) => <li key={label} className={index + 1 <= stage ? "active" : ""}><span>{index + 1}</span><b>{label}</b><i /></li>)}</ol>

    <div className="check-layout">
      <section className="check-left">
        {state === "done" && top ? (
          <section className="check-result check-result-inline" aria-labelledby="check-result-heading">
            <h2 id="check-result-heading" ref={resultHeading} tabIndex={-1}><HeartPulse size={23} />ผลการวิเคราะห์เบื้องต้น</h2>
            <div className="check-result-pet">
              <img src={preview} alt={`รูปที่ใช้วิเคราะห์ของ ${pet.name}`} />
              <div><small>ผลตรวจของ</small><strong>{pet.name}</strong><span>{file?.name}</span></div>
              <span className="check-result-complete"><CheckIcon size={16} />วิเคราะห์เสร็จแล้ว</span>
            </div>
            <div className="check-primary-result"><small>ผลวิเคราะห์หลัก</small><div className="check-result-summary"><strong>{diseaseName(top.label)}</strong><Risk level={risk} /></div></div>
            <h3>คำแนะนำเบื้องต้น</h3>
            <ul>{(ADVICE[top.label] || ADVICE.default).map((advice) => <li key={advice}>{advice}</li>)}</ul>
            <details className="check-result-details">
              <summary>ดูผลวิเคราะห์เพิ่มเติม</summary>
              <p>3 อันดับที่โมเดลประเมินได้คะแนนสูงสุด</p>
              {result.slice(0, 3).map((item) => <div className="check-meter" key={item.label}><div><span>{diseaseName(item.label)}</span><b>{Math.round(item.score * 100)}%</b></div><i><span style={{ width: `${item.score * 100}%` }} /></i></div>)}
            </details>
            <Disclaimer>ผลนี้เป็นการคัดกรองเบื้องต้นเท่านั้น หากสุนัขมีอาการผิดปกติควรพบสัตวแพทย์</Disclaimer>
            <div className="check-result-actions">
              <button type="button" className="btn" onClick={() => { clear(); requestAnimationFrame(() => uploadHeading.current?.focus()); }}><ImagePlus size={18} />ตรวจรูปใหม่</button>
              <Link to="/clinics" className="check-clinic-link"><MapPin size={17} />ค้นหาคลินิกใกล้ฉัน<ArrowRight size={17} /></Link>
            </div>
          </section>
        ) : <div className="upload-panel" aria-busy={state === "loading"}>
          <h2 ref={uploadHeading} tabIndex={-1}><Camera size={25} fill="currentColor" />อัปโหลดรูปภาพ</h2>
          <div className={`check-drop ${drag ? "dragging" : ""}`} role="button" aria-disabled={state === "loading"} tabIndex={state === "loading" ? -1 : 0}
            onClick={() => { if (state !== "loading") input.current?.click(); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (state !== "loading") input.current?.click(); } }}
            onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(event) => { event.preventDefault(); setDrag(false); pick(event.dataTransfer.files[0]); }}>
            {preview ? <><img className="check-preview-image" src={preview} alt="ภาพที่เลือกสำหรับตรวจสุขภาพ" /><button className="check-clear" type="button" disabled={state === "loading"} onClick={(event) => { event.stopPropagation(); clear(); }} aria-label="ลบรูปภาพ"><X size={18} /></button></> : <>
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
        </div>}
      </section>

      <aside className="check-sidebar">
        <section className="pet-info-card"><h2><PawPrint size={22} fill="currentColor" />ข้อมูลสัตว์เลี้ยงของคุณ</h2><div className="pet-info-content"><Avatar pet={pet} size={90} /><div className="pet-meta"><label>ชื่อ <span>:</span><select disabled={state === "loading" || state === "done"} value={petId} onChange={(event) => setPetId(event.target.value)} aria-label="เลือกสัตว์เลี้ยง">{PETS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Pencil size={14} /></label><p><span className="pet-meta-icon">⌂</span>พันธุ์ : {pet.breed}</p><p><CalendarDays size={17} />อายุ : {pet.age} ปี</p></div></div></section>
        <section className="latest-card"><div className="latest-heading"><h2><ClipboardList size={22} />ประวัติการตรวจล่าสุด</h2><Link to="/history">ดูทั้งหมด <ArrowRight size={16} /></Link></div><Link className="latest-entry" to="/history"><img src={pet.img} alt={pet.name} /><div><small><CalendarDays size={13} />{fmtDate(latest.date).split(" เวลา")[0]}</small><strong>กลุ่มโรค : {diseaseName(latest.disease)}</strong></div><Risk level={latest.risk} /></Link></section>
        <section className="check-tips" aria-labelledby="check-tips-heading">
          <div className="tip-copy">
            <h3 id="check-tips-heading"><HeartPulse size={20} fill="currentColor" />คำแนะนำ</h3>
            <p className="tip-dog-only"><AlertCircle size={18} /><strong>ระบบรองรับสุนัขเท่านั้น กรุณาแนบรูปสุนัข ไม่ควรใช้รูปคนหรือสัตว์ชนิดอื่น</strong></p>
            <p><CheckIcon />ควรเป็นรูปบริเวณที่เห็นอาการชัดเจน</p>
            <p><CheckIcon />ถ่ายในที่สว่างและภาพคมชัด เพื่อผลลัพธ์ที่แม่นยำยิ่งขึ้น</p>
          </div>
        </section>
      </aside>
    </div>
    <dialog ref={guideDialog} id="check-guide-dialog" className="check-guide-dialog" aria-labelledby="check-guide-title" aria-describedby="check-guide-description" onCancel={() => setGuideOpen(false)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setGuideOpen(false); } }}>
      <button type="button" className="check-guide-close" aria-label="ปิดคำแนะนำ" onClick={() => setGuideOpen(false)}><X size={21} /></button>
      <div className="check-guide-icon"><AlertCircle size={29} /></div>
      <span className="check-guide-eyebrow">ก่อนเริ่มใช้งาน DOO PET</span>
      <h2 id="check-guide-title">รู้จักระบบก่อนตรวจให้น้อง</h2>
      <p id="check-guide-description" className="check-guide-intro">ผู้ช่วยคัดกรองจากรูปภาพ เพื่อให้คุณดูแลสุนัขได้อย่างเข้าใจมากขึ้น</p>
      <div className="check-guide-highlight"><strong>เป็นการคัดกรองเบื้องต้นเท่านั้น</strong><p>ผลจาก Machine Learning เป็นเพียงการตรวจสอบเบื้องต้นเท่านั้น ไม่ใช่การวินิจฉัยโรค และไม่สามารถใช้แทนการตรวจจากสัตวแพทย์ได้</p></div>
      <ul className="check-guide-list">
        <li><PawPrint size={21} /><div><strong>รองรับรูปสุนัขเท่านั้น</strong><p>แนบรูปสุนัขของคุณ ไม่ใช้รูปคน สัตว์ชนิดอื่น หรือภาพการ์ตูน</p></div></li>
        <li><Camera size={21} /><div><strong>ภาพชัด ช่วยให้ประเมินได้ดีขึ้น</strong><p>ถ่ายบริเวณผิวหนังหรือแผลให้เห็นชัด ในที่สว่าง ไม่เบลอ ไม่ใส่ฟิลเตอร์ รองรับ JPG, PNG และ WEBP ไม่เกิน 10MB</p></div></li>
        <li><ClipboardList size={21} /><div><strong>ขอบเขตการตรวจของระบบ</strong><p>ระบบไม่ได้ตรวจได้ทุกโรค เน้นความผิดปกติที่สังเกตได้จากภาพ โดยเฉพาะโรคทางผิวหนังเป็นหลัก และจำกัดเฉพาะกลุ่มที่โมเดลเรียนรู้ คะแนนเปอร์เซ็นต์เป็นคะแนนที่โมเดลประเมิน ไม่ใช่ระดับความรุนแรงหรือการยืนยันว่าเป็นโรคนั้น</p></div></li>
        <li><HeartPulse size={21} /><div><strong>ดูผลควบคู่กับอาการจริงเสมอ</strong><p>หากมีอาการผิดปกติหรืออาการแย่ลง ควรปรึกษาสัตวแพทย์ แม้ระบบจะแสดงผลว่าผิวหนังปกติ</p></div></li>
      </ul>
      <button type="button" className="check-guide-confirm" onClick={() => setGuideOpen(false)}><CheckIcon size={18} />เข้าใจแล้ว เริ่มดูแลน้องกัน</button>
    </dialog>
  </div>;
}

