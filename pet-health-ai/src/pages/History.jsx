import { usePets } from "../pet-store.js";
import { diseaseName } from "../disease-labels.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardCheck,
  Clock3, PawPrint, RotateCcw, Search, ShieldCheck, Stethoscope, X,
} from "lucide-react";
import {  HISTORY, fmtDate, Avatar } from "../shared.jsx";

const riskText = { low: "ความเสี่ยงต่ำ", mid: "ความเสี่ยงปานกลาง", high: "ความเสี่ยงสูง" };

function ResultBadge({ record }) {
  if (record.disease.toLowerCase() === "healthy") {
    return <span className="history-result healthy"><Check size={15} />ปกติ (สุขภาพดี)</span>;
  }
  return <span className={`history-result ${record.risk}`}>
    {record.risk === "low" ? <ShieldCheck size={15} /> : <AlertTriangle size={15} />}
    {riskText[record.risk] || "ไม่ระบุระดับ"}
  </span>;
}

export default function History() {
  const PETS = usePets();
  const [query, setQuery] = useState("");
  const [pet, setPet] = useState("");
  const [risk, setRisk] = useState("");
  const [sort, setSort] = useState("new");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const openerRef = useRef(null);
  const modalRef = useRef(null);
  const closeRef = useRef(null);
  const perPage = 5;

  const stats = useMemo(() => ({
    total: HISTORY.length,
    low: HISTORY.filter((item) => item.risk === "low" && item.disease.toLowerCase() !== "healthy").length,
    mid: HISTORY.filter((item) => item.risk === "mid" && item.disease.toLowerCase() !== "healthy").length,
    high: HISTORY.filter((item) => item.risk === "high" && item.disease.toLowerCase() !== "healthy").length,
  }), []);

  const records = useMemo(() => {
    const filtered = HISTORY.filter((item) => {
      const animal = PETS.find((entry) => entry.id === item.pet);
      const matchesSearch = !query || `${animal?.name ?? ""} ${animal?.breed ?? ""} ${item.disease} ${diseaseName(item.disease)}`.toLowerCase().includes(query.toLowerCase());
      return matchesSearch && (!pet || item.pet === Number(pet)) && (!risk || item.risk === risk);
    });
    return filtered.sort((a, b) => sort === "new"
      ? new Date(b.date) - new Date(a.date)
      : new Date(a.date) - new Date(b.date));
  }, [query, pet, risk, sort, PETS]);

  const pages = Math.max(1, Math.ceil(records.length / perPage));
  const visible = records.slice((page - 1) * perPage, page * perPage);
  const clearFilters = () => { setQuery(""); setPet(""); setRisk(""); setSort("new"); setPage(1); };
  const setFilter = (setter) => (event) => { setter(event.target.value); setPage(1); };
  const closeDetails = () => setSelected(null);

  useEffect(() => {
    if (!selected) return undefined;
    const returnFocusTo = openerRef.current;
    const frame = requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDetails();
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = [...modalRef.current.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) {
        event.preventDefault();
        modalRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      returnFocusTo?.focus();
    };
  }, [selected]);

  return (
    <div className="history-page">
      <section className="history-hero">
        <div className="history-hero-icon"><ClipboardCheck size={46} strokeWidth={1.8} /><PawPrint size={24} /></div>
        <div className="history-hero-copy">
          <span className="history-eyebrow">PET HEALTH RECORD</span>
          <h1>ประวัติการตรวจสุขภาพ</h1>
          <p>ติดตามผลการตรวจและประวัติสุขภาพสัตว์เลี้ยงของคุณ</p>
        </div>
        <PawPrint className="history-hero-paw" size={58} />
        <div className="history-hero-pets" aria-hidden="true">
          <img src="/dogs/Buddy.png" alt="" />
          <img src="/dogs/Luna.png" alt="" />
        </div>
        <span className="history-heart">♡</span>
      </section>

      <section className="history-stats" aria-label="สรุปประวัติการตรวจ">
        <article className="history-stat total"><span className="history-stat-icon"><Stethoscope size={30} /></span><div><small>การตรวจทั้งหมด</small><strong>{stats.total} ครั้ง</strong><p>จากการตรวจทั้งหมดของคุณ</p></div></article>
        <article className="history-stat low"><span className="history-stat-icon"><ShieldCheck size={30} /></span><div><small>ความเสี่ยงต่ำ</small><strong>{stats.low} ครั้ง</strong><p>ผลตรวจระดับความเสี่ยงต่ำ</p></div></article>
        <article className="history-stat mid"><span className="history-stat-icon"><AlertTriangle size={30} /></span><div><small>ความเสี่ยงปานกลาง</small><strong>{stats.mid} ครั้ง</strong><p>ควรติดตามอาการ</p></div></article>
        <article className="history-stat high"><span className="history-stat-icon"><AlertTriangle size={30} /></span><div><small>ความเสี่ยงสูง</small><strong>{stats.high} ครั้ง</strong><p>ควรปรึกษาสัตวแพทย์</p></div></article>
      </section>

      <section className="history-toolbar" aria-label="ตัวกรองประวัติ">
        <label className="history-search"><Search size={19} /><input value={query} onChange={setFilter(setQuery)} placeholder="ค้นหาชื่อสัตว์เลี้ยง หรือผลการตรวจ..." /></label>
        <label className="history-select"><PawPrint size={18} /><select value={pet} onChange={setFilter(setPet)}><option value="">ทุกสัตว์เลี้ยง</option>{PETS.map((animal) => <option key={animal.id} value={animal.id}>{animal.name}</option>)}</select></label>
        <label className="history-select"><ShieldCheck size={18} /><select value={risk} onChange={setFilter(setRisk)}><option value="">ทุกระดับความเสี่ยง</option><option value="low">ความเสี่ยงต่ำ</option><option value="mid">ความเสี่ยงปานกลาง</option><option value="high">ความเสี่ยงสูง</option></select></label>
        <label className="history-select date"><CalendarDays size={18} /><select value={sort} onChange={setFilter(setSort)}><option value="new">เรียงตามวันที่ (ล่าสุดก่อน)</option><option value="old">เรียงตามวันที่ (เก่าสุดก่อน)</option></select></label>
        <button className="history-reset" onClick={clearFilters}><RotateCcw size={17} />ล้างตัวกรอง</button>
      </section>

      {visible.length ? <>
        <ul className="history-records">
          {visible.map((record, index) => {
            const animal = PETS.find((entry) => entry.id === record.pet);
            return <li className="history-record" key={record.id} style={{ "--row-index": index }}>
              <div className="history-pet"><Avatar pet={animal} size={66} /><div><strong>{animal.name}</strong><span>{animal.breed} <i>·</i> อายุ {animal.age} ปี</span></div></div>
              <div className="history-diagnosis"><small><CalendarDays size={15} />{fmtDate(record.date)}</small><strong>{diseaseName(record.disease)}</strong></div>
              <div className="history-risk-cell"><ResultBadge record={record} /></div>
              <button className="history-detail" onClick={(event) => { openerRef.current = event.currentTarget; setSelected({ ...record, animal }); }}>ดูรายละเอียด<ChevronRight size={17} /></button>
            </li>;
          })}
        </ul>
        {pages > 1 && <nav className="history-pagination" aria-label="เปลี่ยนหน้าประวัติ">
          <button aria-label="หน้าก่อน" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={18} /></button>
          {Array.from({ length: pages }, (_, index) => <button key={index} className={page === index + 1 ? "active" : ""} onClick={() => setPage(index + 1)}>{index + 1}</button>)}
          <button aria-label="หน้าถัดไป" disabled={page === pages} onClick={() => setPage(page + 1)}><ChevronRight size={18} /></button>
        </nav>}
      </> : <section className="history-empty">
        <div className="history-empty-paw"><PawPrint size={34} /></div><h2>{HISTORY.length ? "ไม่พบประวัติที่ตรงกับตัวกรอง" : "ยังไม่มีประวัติการตรวจ"}</h2>
        <p>{HISTORY.length ? "ลองค้นหาด้วยคำอื่น หรือล้างตัวกรองเพื่อดูประวัติทั้งหมด" : "เริ่มตรวจสุขภาพสัตว์เลี้ยงของคุณเพื่อบันทึกประวัติ"}</p>
        {HISTORY.length ? <button className="history-empty-cta secondary" onClick={clearFilters}>ล้างตัวกรอง</button> : <Link className="history-empty-cta" to="/check"><PawPrint size={18} />เริ่มตรวจสุขภาพ</Link>}
      </section>}

      {selected && <div className="history-modal-backdrop" onClick={closeDetails} role="presentation">
        <section ref={modalRef} className="history-modal" role="dialog" aria-modal="true" aria-labelledby="history-detail-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
          <button ref={closeRef} className="history-modal-close" onClick={closeDetails} aria-label="ปิด"><X size={20} /></button>
          <div className="history-modal-pet"><Avatar pet={selected.animal} size={72} /><div><h2 id="history-detail-title">ผลการตรวจของ {selected.animal.name}</h2><span>{selected.animal.breed} · อายุ {selected.animal.age} ปี</span></div></div>
          <div className="history-modal-result"><small><Clock3 size={15} />{fmtDate(selected.date)}</small><strong>{diseaseName(selected.disease)}</strong><ResultBadge record={selected} /></div>
          <p className="history-modal-note">ระบบบันทึกผลการตรวจเบื้องต้นนี้เพื่อใช้อ้างอิง หากสัตว์เลี้ยงมีอาการผิดปกติ ควรปรึกษาสัตวแพทย์</p>
        </section>
      </div>}
    </div>
  );
}
