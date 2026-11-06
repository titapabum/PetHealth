import { useState } from "react";
import { Link } from "react-router-dom";
import { PawPrint, ImagePlus, ScanSearch, ClipboardList, HeartPulse, Search, MapPin, Phone, Clock, Star, X, ChevronRight, AlertCircle, UploadCloud, Cpu, Database, Server, Layout, ChevronLeft, Camera } from "lucide-react";
import { PETS, HISTORY, CLINICS, RISK, ADVICE, fmtDate, Avatar, Risk, Disclaimer, PageHead } from "../shared.jsx";

export default function About() {
  const tech = [[Layout, "Frontend", "React.js"], [Server, "Backend", "Node.js + Express"], [Cpu, "Machine Learning", "TensorFlow / PyTorch"], [Database, "Database", "MySQL"]];
  const flow = [[ImagePlus, "อัปโหลดรูปภาพ"], [ScanSearch, "ประมวลผลภาพ"], [Cpu, "Machine Learning"], [ClipboardList, "ผลการตรวจ"], [HeartPulse, "คำแนะนำ"]];
  return (
    <>
      <PageHead icon={PawPrint} title="เกี่ยวกับระบบ" sub="เรียนรู้เพิ่มเติมเกี่ยวกับโครงการ Doo Pet × Machine Learning" />
      <section className="about-panel">
        <div className="about-main">
          <div className="about-photo">
            <img src="/dogs/about-dog.jpg" alt="สุนัขโกลเด้นรีทรีฟเวอร์" />
          </div>
          <div className="about-detail">
            <section>
              <h2>รายละเอียดโครงการ</h2>
              <p>Doo Pet × Machine Learning เป็นระบบช่วยตรวจสุขภาพสุนัขเบื้องต้นจากรูปภาพ โดยใช้เทคโนโลยี Machine Learning เพื่อช่วยให้เจ้าของสัตว์เลี้ยงสามารถประเมินอาการเบื้องต้นก่อนตัดสินใจพาไปพบสัตวแพทย์</p>
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

