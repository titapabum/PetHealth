import { useState, useRef, useMemo } from "react";
import { HashRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import {
  PawPrint, ImagePlus, ScanSearch, ClipboardList, HeartPulse, Search,
  MapPin, Phone, Clock, Star, X, ChevronRight, AlertCircle, UploadCloud,
  Cpu, Database, Server, Layout, ChevronLeft, CircleUserRound, Camera,
} from "lucide-react";
import "./App.css";

/* ---------- ข้อมูลตัวอย่าง (แทนที่ด้วยข้อมูลจาก API ภายหลัง) ---------- */
const PETS = [
  { id: 1, name: "Milo", breed: "Shih Tzu", age: 4, sex: "ผู้", img: "/dogs/milo.jpg" },
  { id: 2, name: "Buddy", breed: "Golden Retriever", age: 3, sex: "ผู้", img: "/dogs/buddy.jpg" },
  { id: 3, name: "Luna", breed: "Siberian Husky", age: 2, sex: "เมีย", img: "/dogs/luna.jpg" },
  { id: 4, name: "Choco", breed: "Corgi", age: 1, sex: "ผู้", img: "/dogs/choco.jpg" },
];
const HISTORY = [
  { id: 1, pet: 1, date: "2025-09-20T14:32", disease: "Skin Infection", risk: "mid" },
  { id: 2, pet: 2, date: "2025-09-15T10:21", disease: "Ear Infection", risk: "low" },
  { id: 3, pet: 3, date: "2025-09-05T16:45", disease: "Eye Irritation", risk: "high" },
  { id: 4, pet: 4, date: "2025-08-28T11:12", disease: "Healthy", risk: "low" },
];
const CLINICS = [
  { name: "Pet Care Animal Hospital", km: 0.8, rate: 4.8, n: 124, hours: "08:00 – 22:00", tel: "02-123-4567", x: 30, y: 28 },
  { name: "โรงพยาบาลสัตว์บางนอกเพ็ท", km: 1.2, rate: 4.6, n: 96, hours: "09:00 – 20:00", tel: "02-345-6789", x: 64, y: 44 },
  { name: "คลินิกรักษาสัตว์หมอโย", km: 1.8, rate: 4.5, n: 74, hours: "09:00 – 19:00", tel: "02-987-6543", x: 42, y: 68 },
];
const RISK = { low: "ต่ำ", mid: "ปานกลาง", high: "สูง" };
const DISEASE_NAMES = {
  bacterial_dermatosis: "โรคผิวหนังอักเสบจากการติดเชื้อแบคทีเรีย (Bacterial Dermatosis)",
  demodicosis: "โรคเรื้อนเปียก / ไรขี้เรื้อนขน (Demodicosis)",
  dermatitis: "โรคผิวหนังอักเสบทั่วไป (Dermatitis)",
  fungal_infection: "โรคกลาก / เชื้อราในผิวหนัง (Fungal Infection)",
  healthy: "ผิวหนังปกติ (Healthy Skin)",
  hypersensitivity: "โรคผิวหนังจากอาการแพ้ / ภูมิแพ้ (Hypersensitivity)",
};
const ADVICE = {
  bacterial_dermatosis: [
    "ควรพาไปพบสัตวแพทย์เพื่อรับยาปฏิชีวนะ (ยาฆ่าเชื้อ) ชนิดกินหรือยาทาภายนอก",
    "ทำความสะอาดแผลด้วยน้ำเกลือทางการแพทย์ (NSS) และเช็ดให้แห้งสนิท",
    "ใส่คอลล่าร์ (Elizabethan Collar) ป้องกันไม่ให้สุนัขเลียหรือเกาแผลซ้ำ",
  ],
  demodicosis: [
    "ต้องตรวจผิวหนังด้วยการขูดตรวจ (Skin Scrape) โดยสัตวแพทย์เพื่อยืนยันชนิดของไร",
    "รักษาด้วยยาเฉพาะทางสำหรับกำจัดไรตามแพทย์สั่ง",
    "เสริมสร้างภูมิคุ้มกันให้สุนัข เนื่องจากมักเกิดในตัวที่ภูมิคุ้มกันต่ำ",
  ],
  dermatitis: [
    "หลีกเลี่ยงสิ่งกระตุ้นหรือสารเคมีที่อาจทำให้เกิดการแพ้",
    "อาบน้ำด้วยแชมพูสูตรอ่อนโยนหรือสูตรยับยั้งอาการอักเสบ",
    "หากมีอาการคันมาก แพทย์อาจพิจารณาให้ยาลดอักเสบในปริมาณที่เหมาะสม",
  ],
  fungal_infection: [
    "พาไปพบแพทย์เพื่อส่องไฟตรวจเชื้อราหรือเพาะเชื้อ",
    "ใช้แชมพูยาฆ่าเชื้อราอาบน้ำสัปดาห์ละ 2 ครั้ง",
    "ทำความสะอาดสิ่งของ เครื่องนอน และบริเวณที่สุนัขอาศัยเพื่อป้องกันการแพร่กระจาย",
  ],
  healthy: [
    "รักษาสุขภาพผิวหนังและขนให้สะอาดอย่างสม่ำเสมอ",
    "แปรงขนเป็นประจำและตรวจเช็กผิวหนังช่วงเปลี่ยนฤดู",
    "ให้โภชนาการที่มีกรดไขมันจำเป็น (Omega 3 & 6) เพื่อบำรุงผิวหนังให้แข็งแรง",
  ],
  hypersensitivity: [
    "หาสาเหตุการแพ้ร่วมกับสัตวแพทย์",
    "ควบคุมและป้องกันเห็บหมัดอย่างสม่ำเสมอ",
    "ใช้ยาลดคันหรือแชมพูสูตรลดอาการแพ้เพื่อบรรเทาความทรมานของสุนัข",
  ],
  default: ["สังเกตอาการต่อเนื่อง 2–3 วัน", "ถ่ายรูปบริเวณที่สงสัยไว้เทียบ", "หากอาการแย่ลง ให้พบสัตวแพทย์"],
};

/* ---------- เรียกโมเดล: ตั้ง VITE_API_URL แล้วจะยิง POST /predict จริง ---------- */
async function predict(file) {
  const base = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
  if (base) {
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch(`${base}/predict`, { method: "POST", body: fd });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "วิเคราะห์ไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง");
    }
    return res.json();
  }
  await new Promise((r) => setTimeout(r, 1200));
  return [
    { label: "Skin Infection", score: 0.78 },
    { label: "Allergic Dermatitis", score: 0.14 },
    { label: "Healthy", score: 0.08 },
  ];
}

const fmtDate = (s) =>
  new Date(s).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/* ---------- ส่วนประกอบย่อย ---------- */
function Avatar({ pet, size = 64 }) {
  const [bad, setBad] = useState(false);
  return bad ? (
    <span className="avatar" style={{ width: size, height: size }}>{pet.name[0]}</span>
  ) : (
    <img className="avatar" style={{ width: size, height: size }} src={pet.img} alt={pet.name} onError={() => setBad(true)} />
  );
}
const Risk = ({ level }) => <span className={`risk risk-${level}`}>{RISK[level]}</span>;
const Disclaimer = ({ children }) => (
  <p className="notice"><AlertCircle size={18} />{children}</p>
);
const PageHead = ({ icon: Icon, title, sub }) => (
  <div className="page-head"><span className="badge"><Icon size={22} /></span><div><h1>{title}</h1><p>{sub}</p></div></div>
);

function Header() {
  const items = [["/", "หน้าหลัก"], ["/check", "ตรวจสุขภาพ"], ["/history", "ประวัติการตรวจ"], ["/clinics", "คลินิกใกล้ฉัน"], ["/about", "เกี่ยวกับระบบ"]];
  return (
    <header className="top">
      <Link to="/" className="brand"><PawPrint size={22} />Pet Health AI</Link>
      <nav>{items.map(([to, t]) => <NavLink key={to} to={to} end={to === "/"}>{t}</NavLink>)}</nav>
      <span className="account" aria-label="บัญชีผู้ใช้"><CircleUserRound size={20} /></span>
    </header>
  );
}

/* ---------- หน้าหลัก ---------- */
function Home() {
  const steps = [
    [ImagePlus, "อัปโหลดรูปภาพ", "ถ่ายรูปบริเวณที่สงสัยของน้อง แล้วอัปโหลดได้เลย"],
    [ScanSearch, "AI วิเคราะห์ภาพ", "โมเดล Machine Learning ตรวจหาความผิดปกติจากภาพ"],
    [ClipboardList, "ดูผลการตรวจ", "แสดงโรคที่เป็นไปได้ พร้อมระดับความเสี่ยง"],
    [HeartPulse, "คำแนะนำเบื้องต้น", "วิธีดูแลน้องและสัญญาณที่ควรรีบพบสัตวแพทย์"],
  ];
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>ตรวจสุขภาพสุนัขเบื้องต้น<br />จากรูปภาพ</h1>
          <p>อัปโหลดรูปน้องหมา ระบบจะวิเคราะห์ด้วย Machine Learning แล้วสรุปผลพร้อมคำแนะนำให้ภายในไม่กี่วินาที</p>
          <Link to="/check" className="btn hero-cta"><Camera size={19} />เริ่มตรวจสุขภาพ <ChevronRight size={18} /></Link>
        </div>
        <div className="hero-visual">
          <span className="hero-ring ring-one" /><span className="hero-ring ring-two" />
          <img className="hero-photo" src="/dogs/Golden-Retriever-PNG-File-Download-Free.png" alt="สุนัขโกลเด้นรีทรีฟเวอร์" />
          <span className="hero-paw"><PawPrint size={27} /></span>
          <span className="hero-note">สุขภาพดี<br />เริ่มได้จาก<br />การดูแล <HeartPulse size={23} /></span>
        </div>
      </section>
      <h2 className="sec">ทำงานอย่างไร</h2>
      <ol className="steps">
        {steps.map(([Icon, t, d], i) => (
          <li key={t}><span className="no">{i + 1}</span><Icon size={30} strokeWidth={1.5} /><b>{t}</b><small>{d}</small></li>
        ))}
      </ol>
      <Disclaimer>ระบบนี้เป็นเครื่องมือคัดกรองเบื้องต้นเท่านั้น ไม่สามารถใช้แทนการวินิจฉัยของสัตวแพทย์ได้</Disclaimer>
    </>
  );
}

/* ---------- หน้าตรวจสุขภาพ ---------- */
function Check() {
  const [petId, setPetId] = useState(PETS[0].id);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [drag, setDrag] = useState(false);
  const [state, setState] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState([]);
  const [err, setErr] = useState("");
  const input = useRef();

  const pick = (f) => {
    if (!f) return;
    if (!/^image\/(jpeg|png)$/.test(f.type)) return setErr("รองรับเฉพาะไฟล์ JPG หรือ PNG");
    if (f.size > 10 * 1024 * 1024) return setErr("ไฟล์ใหญ่เกิน 10MB ลองลดขนาดแล้วอัปโหลดใหม่");
    setErr(""); setFile(f); setState("idle"); setResult([]);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
  };
  const clear = () => { setFile(null); setPreview(""); setState("idle"); setResult([]); };
  const run = async () => {
    setState("loading"); setErr("");
    try { setResult(await predict(file)); setState("done"); }
    catch (e) { setState("error"); setErr(e?.message && e.message !== "Failed to fetch" ? e.message : "วิเคราะห์ไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง"); }
  };

  const top = result[0];
  const level = top ? (top.label === "healthy" || top.label === "Healthy" ? "low" : top.score >= 0.7 ? "high" : top.score >= 0.4 ? "mid" : "low") : "low";
  const stage = state === "done" ? 4 : state === "loading" ? 2 : 1;
  const pet = PETS.find((p) => p.id === Number(petId));

  return (
    <>
      <PageHead icon={PawPrint} title="ตรวจสุขภาพสัตว์เลี้ยง" sub="เลือกสัตว์เลี้ยง → อัปโหลดรูป → ระบบวิเคราะห์ → ดูผลและคำแนะนำ" />
      <ol className="progress">
        {["อัปโหลดรูป", "วิเคราะห์ผล", "ผลการตรวจ", "คำแนะนำ"].map((t, i) => (
          <li key={t} className={i + 1 <= stage ? "on" : ""}><span>{i + 1}</span>{t}</li>
        ))}
      </ol>

      <h2 className="sec">1. เลือกสัตว์เลี้ยง</h2>
      <div className="select-pet">
        <Avatar pet={pet} size={40} />
        <select value={petId} onChange={(e) => setPetId(e.target.value)} aria-label="เลือกสัตว์เลี้ยง">
          {PETS.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.breed} · อายุ {p.age} ปี · เพศ{p.sex}</option>)}
        </select>
      </div>

      <h2 className="sec">2. อัปโหลดรูปภาพ</h2>
      <div className="upload">
        <button type="button" className={`drop ${drag ? "drag" : ""}`} onClick={() => input.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}>
          <UploadCloud size={36} strokeWidth={1.5} />
          <b>ลากและวางรูปภาพที่นี่ หรือคลิกเพื่อเลือกไฟล์</b>
          <small>รองรับ JPG, PNG ขนาดไม่เกิน 10MB</small>
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png" hidden onChange={(e) => pick(e.target.files[0])} />
        <div className="preview">
          <small>ตัวอย่างภาพ</small>
          {preview ? (
            <div className="shot"><img src={preview} alt="ตัวอย่างภาพที่เลือก" /><button type="button" onClick={clear} aria-label="ลบรูป"><X size={14} /></button></div>
          ) : <div className="shot empty">ยังไม่ได้เลือกรูป</div>}
          {preview && <button type="button" className="btn ghost" onClick={() => input.current.click()}>เปลี่ยนรูปภาพ</button>}
        </div>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn wide" disabled={!file || state === "loading"} onClick={run}>
        {state === "loading" ? "กำลังวิเคราะห์ภาพ…" : "เริ่มวิเคราะห์"}
      </button>

      {state === "done" && (
        <section className="result" aria-live="polite">
          <h2 className="sec">3. ผลการวิเคราะห์จาก ML</h2>
          <div className="card">
            <div className="between"><b>{DISEASE_NAMES[top.label] || top.label}</b><Risk level={level} /></div>
            {result.map((r) => (
              <div key={r.label} className="meter">
                <div className="between"><span>{DISEASE_NAMES[r.label] || r.label}</span><span>{Math.round(r.score * 100)}%</span></div>
                <div className="track"><i style={{ width: `${r.score * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <h2 className="sec">4. คำแนะนำเบื้องต้น</h2>
          <ul className="advice">{(ADVICE[top.label] || ADVICE.default).map((a) => <li key={a}>{a}</li>)}</ul>
          <Disclaimer>ผลนี้ใช้คัดกรองเบื้องต้นเท่านั้น หากน้องมีอาการผิดปกติควรพบสัตวแพทย์</Disclaimer>
          <Link to="/clinics" className="btn ghost"><MapPin size={16} />ค้นหาคลินิกใกล้ฉัน</Link>
        </section>
      )}
    </>
  );
}

/* ---------- ประวัติการตรวจ ---------- */
function History() {
  const [q, setQ] = useState(""); const [pet, setPet] = useState(""); const [risk, setRisk] = useState("");
  const [sort, setSort] = useState("new"); const [page, setPage] = useState(1);
  const per = 4;
  const rows = useMemo(() => {
    const l = HISTORY.filter((h) => {
      const p = PETS.find((x) => x.id === h.pet);
      return (!pet || h.pet === Number(pet)) && (!risk || h.risk === risk) &&
        (!q || `${p.name} ${h.disease}`.toLowerCase().includes(q.toLowerCase()));
    });
    return l.sort((a, b) => sort === "new" ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date));
  }, [q, pet, risk, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const view = rows.slice((page - 1) * per, page * per);
  const reset = (fn) => (e) => { fn(e.target.value); setPage(1); };

  return (
    <>
      <PageHead icon={ClipboardList} title="ประวัติการตรวจ" sub="ดูผลการตรวจย้อนหลังของสัตว์เลี้ยงของคุณ" />
      <div className="filters">
        <label className="search"><Search size={16} /><input value={q} onChange={reset(setQ)} placeholder="ค้นหาชื่อสัตว์เลี้ยง หรือผลการตรวจ" /></label>
        <select value={pet} onChange={reset(setPet)}><option value="">ทุกสัตว์เลี้ยง</option>{PETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select value={risk} onChange={reset(setRisk)}><option value="">ทุกระดับความเสี่ยง</option>{Object.entries(RISK).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={sort} onChange={reset(setSort)}><option value="new">ล่าสุดก่อน</option><option value="old">เก่าสุดก่อน</option></select>
      </div>
      {view.length === 0 ? <p className="empty">ไม่พบประวัติที่ตรงกับตัวกรอง ลองล้างคำค้นหาหรือเลือก "ทุกสัตว์เลี้ยง"</p> : (
        <ul className="rows">
          {view.map((h) => {
            const p = PETS.find((x) => x.id === h.pet);
            return (
              <li key={h.id}>
                <Avatar pet={p} />
                <div><b>{p.name}</b><small>{p.breed} · อายุ {p.age} ปี</small></div>
                <div><small><Clock size={13} /> {fmtDate(h.date)}</small><span>{h.disease}</span></div>
                <Risk level={h.risk} />
                <button className="btn ghost sm">ดูรายละเอียด <ChevronRight size={14} /></button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="pager">
        <button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="ก่อนหน้า"><ChevronLeft size={16} /></button>
        {Array.from({ length: pages }, (_, i) => <button key={i} className={page === i + 1 ? "on" : ""} onClick={() => setPage(i + 1)}>{i + 1}</button>)}
        <button disabled={page === pages} onClick={() => setPage(page + 1)} aria-label="ถัดไป"><ChevronRight size={16} /></button>
      </div>
    </>
  );
}

/* ---------- คลินิกใกล้ฉัน (ต่อ Google Maps / Leaflet ภายหลัง) ---------- */
function Clinics() {
  const [sel, setSel] = useState(0);
  return (
    <>
      <PageHead icon={MapPin} title="ค้นหาคลินิกสัตว์เลี้ยงใกล้ฉัน" sub="ดูเวลาเปิด-ปิดและช่องทางติดต่อของคลินิกใกล้คุณ" />
      <div className="clinics">
        <div className="map" role="img" aria-label="แผนที่คลินิก (ตัวอย่าง)">
          {CLINICS.map((c, i) => (
            <button key={c.name} className={`pin ${sel === i ? "on" : ""}`} style={{ left: `${c.x}%`, top: `${c.y}%` }} onClick={() => setSel(i)} aria-label={c.name}><MapPin size={26} /></button>
          ))}
          <small>พื้นที่สำหรับแผนที่จริง</small>
        </div>
        <div>
          <b>คลินิกใกล้คุณ ({CLINICS.length} แห่ง)</b>
          {CLINICS.map((c, i) => (
            <article key={c.name} className={`clinic ${sel === i ? "on" : ""}`} onClick={() => setSel(i)}>
              <div className="between"><b>{c.name}</b><small>{c.km} กม.</small></div>
              <small><Star size={13} /> {c.rate} ({c.n} รีวิว)</small>
              <small><Clock size={13} /> {c.hours}</small>
              <small><Phone size={13} /> {c.tel}</small>
              <div className="acts"><a className="btn ghost sm" href={`tel:${c.tel.replace(/-/g, "")}`}>โทร</a><button className="btn sm">นำทาง</button></div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- เกี่ยวกับระบบ ---------- */
function About() {
  const tech = [[Layout, "Frontend", "React.js"], [Server, "Backend", "Node.js + Express"], [Cpu, "Machine Learning", "TensorFlow / PyTorch"], [Database, "Database", "MySQL"]];
  const flow = [[ImagePlus, "อัปโหลดรูปภาพ"], [ScanSearch, "ประมวลผลภาพ"], [Cpu, "Machine Learning"], [ClipboardList, "ผลการตรวจ"], [HeartPulse, "คำแนะนำ"]];
  return (
    <>
      <PageHead icon={PawPrint} title="เกี่ยวกับระบบ" sub="เรียนรู้เพิ่มเติมเกี่ยวกับโครงการ Pet Health AI" />
      <section className="about-panel">
        <div className="about-main">
          <div className="about-photo">
            <img src="/dogs/about-dog.jpg" alt="สุนัขโกลเด้นรีทรีฟเวอร์" />
          </div>
          <div className="about-detail">
            <section>
              <h2>รายละเอียดโครงการ</h2>
              <p>Pet Health AI เป็นระบบช่วยตรวจสุขภาพสุนัขเบื้องต้นจากรูปภาพ โดยใช้เทคโนโลยี Machine Learning เพื่อช่วยให้เจ้าของสัตว์เลี้ยงสามารถประเมินอาการเบื้องต้นก่อนตัดสินใจพาไปพบสัตวแพทย์</p>
            </section>
            <section className="about-process">
              <h2>วิธีการทำงานของระบบ</h2>
              <ol>
                {flow.map(([Icon, label], index) => <li key={label}><span><Icon size={27} strokeWidth={1.8} /></span><b>{label}</b>{index < flow.length - 1 && <ChevronRight className="flow-arrow" size={21} />}</li>)}
              </ol>
            </section>
          </div>
        </div>
        <div className="about-bottom">
          <section className="about-tech"><h2>เทคโนโลยีที่ใช้</h2><ul>{tech.map(([Icon, a, b]) => <li key={a}><span><Icon size={21} /></span><div><small>{a}</small><b>{b}</b></div></li>)}</ul></section>
          <aside className="about-warning"><AlertCircle size={22} /><div><b>ข้อจำกัดของระบบ</b><p>ผลลัพธ์ที่ได้เป็นเพียงการคัดกรองเบื้องต้นจาก AI ไม่สามารถใช้แทนการวินิจฉัยจากสัตวแพทย์ได้</p></div></aside>
        </div>
      </section>
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/check" element={<Check />} />
          <Route path="/history" element={<History />} />
          <Route path="/clinics" element={<Clinics />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </HashRouter>
  );
}
