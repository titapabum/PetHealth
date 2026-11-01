import { useState } from "react";
import { Link } from "react-router-dom";
import { PawPrint, ImagePlus, ScanSearch, ClipboardList, HeartPulse, Search, MapPin, Phone, Clock, Star, X, ChevronRight, AlertCircle, UploadCloud, Cpu, Database, Server, Layout, ChevronLeft, Camera } from "lucide-react";
import { PETS, HISTORY, CLINICS, RISK, ADVICE, fmtDate, Avatar, Risk, Disclaimer, PageHead } from "../shared.jsx";

export default function Home() {
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
