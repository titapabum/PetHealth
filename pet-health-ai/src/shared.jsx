import { useState, useRef, useMemo, useEffect } from "react";
import { readDemoSession, endDemoSession } from "./auth-session.js";
import { NavLink, Link, useNavigate } from "react-router-dom";
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
const ADVICE = {
  "Skin Infection": [
    "แยกน้องออกจากสัตว์เลี้ยงตัวอื่นชั่วคราว เพื่อลดการแพร่เชื้อ",
    "อย่าทายาหรือใช้แชมพูยาเองก่อนปรึกษาสัตวแพทย์",
    "ซักและตากผ้าปูที่นอนให้แห้งสนิท",
    "ถ้ารอยโรคลามหรือน้องเกาไม่หยุด ควรพบสัตวแพทย์ภายใน 1–2 วัน",
  ],
  default: ["สังเกตอาการต่อเนื่อง 2–3 วัน", "ถ่ายรูปบริเวณที่สงสัยไว้เทียบ", "หากอาการแย่ลง ให้พบสัตวแพทย์"],
};

/* ---------- เรียกโมเดล: ตั้ง VITE_API_URL แล้วจะยิง POST /predict จริง ---------- */
async function predict(file) {
  const base = import.meta.env.VITE_API_URL;
  if (base) {
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch(`${base}/predict`, { method: "POST", body: fd });
    if (!res.ok) throw new Error("predict failed");
    return res.json(); // [{ label: "Skin Infection", score: 0.78 }, ...]
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
  const navigate = useNavigate();
  function logout() {
    endDemoSession();
    navigate('/login', { replace: true });
    window.scrollTo(0, 0);
  }
  const [user, setUser] = useState(readDemoSession);
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => {
    const update = event => { setUser(event.detail); setAccountOpen(false); };
    const sync = () => setUser(readDemoSession());
    window.addEventListener('pet-health-session', update);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('pet-health-session', update); window.removeEventListener('storage', sync); };
  }, []);
  const items = [["/", "หน้าหลัก"], ["/check", "ตรวจสุขภาพ"], ["/history", "ประวัติการตรวจ"], ["/clinics", "คลินิกใกล้ฉัน"], ["/about", "เกี่ยวกับระบบ"]];
  return (
    <header className="top">
      <Link to="/" className="brand"><PawPrint size={22} />Pet Health AI</Link>
      <nav>{items.map(([to, t]) => <NavLink key={to} to={to} end={to === "/"}>{t}</NavLink>)}</nav>
      <div className="account-wrap">{user ? <><button className="account" aria-label="บัญชีผู้ใช้" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}><CircleUserRound size={20} /><span className="account-indicator" /></button>{accountOpen && <div className="account-panel"><strong>{user.name}</strong><small>{user.email}</small><small>บัญชีทดลอง · Mockup</small><Link to="/check" onClick={() => setAccountOpen(false)}>ตรวจสุขภาพน้องหมา</Link><button onClick={logout}>ออกจากระบบ</button></div>}</> : <Link to="/login" className="account-login">Login</Link>}</div>
    </header>
  );
}

/* ---------- หน้าหลัก ---------- */

export { PETS, HISTORY, CLINICS, RISK, ADVICE, fmtDate, Avatar, Risk, Disclaimer, PageHead, Header };
