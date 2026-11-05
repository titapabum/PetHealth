import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Heart,
  HeartPulse,
  LoaderCircle,
  LockKeyhole,
  Mail,
  PawPrint,
  ScanLine,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { startDemoSession } from "../auth-session";
import "./Auth.css";

function Field({ label, icon: Icon, password = false, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="auth-field">
      <span>{label}</span>
      <span className="auth-input-wrap">
        <Icon size={18} aria-hidden="true" />
        <input
          {...props}
          type={password ? (visible ? "text" : "password") : props.type}
        />
        {password && (
          <button
            type="button"
            className="auth-eye"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? `ซ่อน${label}` : `แสดง${label}`}
            aria-pressed={visible}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </span>
    </label>
  );
}

export default function Auth({ mode = "login" }) {
  const signup = mode === "signup";
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reset, setReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [email, setEmail] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const data = new FormData(event.currentTarget);
    if (signup && !String(data.get("name")).trim()) {
      setError("กรุณากรอกชื่อผู้ใช้งาน");
      return;
    }
    if (signup && password !== data.get("confirmPassword")) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน กรุณาลองอีกครั้ง");
      return;
    }
    setBusy(true);
    await new Promise((resolve) => setTimeout(resolve, 850));
    if (reset) {
      setResetSent(true);
    } else {
      startDemoSession({
        name: signup ? String(data.get("name")) : "",
        email: email.trim(),
        remember,
      });
      navigate("/", { replace: true });
      window.scrollTo(0, 0);
      return;
    }
    setBusy(false);
  }

  return (
    <section
      className={`auth-page ${signup ? "auth-signup" : ""}`}
      aria-label={signup ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
    >
      <div className="auth-shell">
        <aside className="auth-visual">
          <Link to="/" className="auth-visual-brand">
            <PawPrint size={24} />
            <span>Pet Health AI</span>
          </Link>
          <div className="auth-visual-orbit orbit-a" />
          <div className="auth-visual-orbit orbit-b" />
          <div className="auth-visual-heading">
            <span className="auth-eyebrow">
              <span /> A LITTLE CARE. A HEALTHIER LIFE.
            </span>
            <h1>
              เพราะทุกความสุข
              <br />
              ของเขา เริ่มที่<span>การดูแล</span>
            </h1>
            <p>
              ให้ AI ช่วยดูแลสุขภาพผิวหนังของน้องหมา
              <br />
              เพื่อให้ทุกวันเป็นวันที่ดีของคุณและเพื่อนซี้
            </p>
          </div>
          <div className="auth-dog-glow" />
          <img
            className="auth-dog"
            src="/dogs/Golden-Retriever-PNG-File-Download-Free.png"
            alt="น้องหมาโกลเด้นรีทรีฟเวอร์ เพื่อนซี้ของคุณ"
          />
          <span className="auth-photo-paw">
            <PawPrint size={34} />
          </span>
          <span className="auth-photo-heart">
            <Heart size={24} />
          </span>
          <div className="auth-health-tag">
            <span>
              <HeartPulse size={22} />
            </span>
            <div>
              <strong>ดูแลด้วยความรัก</strong>
              <small>ให้ทุกการดูแล ใกล้กันยิ่งขึ้น</small>
            </div>
            <CheckCircle2 size={18} />
          </div>
          <div className="auth-visual-bottom">
            <span>
              <ShieldCheck size={16} /> เพื่อนคู่ใจในการดูแลน้องหมา
            </span>
            <span>
              01 <i /> 02
            </span>
          </div>
        </aside>
        <div className="auth-content">
          <div className="auth-rings" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <Link to="/" className="auth-back">
            <ArrowLeft size={15} /> กลับหน้าหลัก
          </Link>
          <span className="auth-float float-care">
            <HeartPulse size={14} /> Healthy & happy
          </span>
          <span className="auth-float float-ai">
            <Sparkles size={14} /> AI powered care
          </span>
          <span className="auth-float float-paw">
            <PawPrint size={22} />
          </span>
          <div className="auth-center">
            <Link to="/" className="auth-logo">
              <span>
                <PawPrint size={29} />
              </span>
              Pet Health <b>AI</b>
            </Link>
            <p className="auth-tagline">
              พื้นที่เล็ก ๆ เพื่อสุขภาพที่ดีของเพื่อนซี้
            </p>
            <div className="auth-form-card" key={`${mode}-${reset}`}>
              {resetSent ? (
                <div className="auth-success" role="status">
                  <span className="auth-success-icon">
                    <Mail size={28} />
                  </span>
                  <h2>ทดลองรีเซ็ตรหัสผ่าน</h2>
                  <p>
                    รับคำขอสำหรับ {email} แล้ว
                    <br />
                    นี่คือโหมดจำลอง จึงยังไม่มีอีเมลถูกส่งออกไป
                  </p>
                  <button
                    className="auth-submit"
                    type="button"
                    onClick={() => {
                      setReset(false);
                      setResetSent(false);
                    }}
                  >
                    กลับไปเข้าสู่ระบบ <ArrowRight size={17} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="auth-card-top">
                    <h2>
                      {reset
                        ? "ลืมรหัสผ่าน?"
                        : signup
                          ? "สมัครสมาชิก"
                          : "เข้าสู่ระบบ"}
                    </h2>
                    {reset ? (
                      <button
                        type="button"
                        className="auth-text-link"
                        onClick={() => setReset(false)}
                      >
                        เข้าสู่ระบบ
                      </button>
                    ) : (
                      <Link
                        className="auth-text-link"
                        to={signup ? "/login" : "/signup"}
                      >
                        {signup ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}{" "}
                        <ArrowRight size={13} />
                      </Link>
                    )}
                  </div>
                  <p className="auth-form-intro">
                    {reset
                      ? "กรอกอีเมลเพื่อทดลองขั้นตอนกู้คืนบัญชี"
                      : signup
                        ? "เริ่มต้นดูแลเพื่อนซี้ไปด้วยกัน"
                        : "ยินดีต้อนรับกลับมา ดูแลเพื่อนซี้กันต่อเลย"}
                  </p>
                  <form onSubmit={submit}>
                    <fieldset disabled={busy}>
                      {signup && !reset && (
                        <Field
                          label="ชื่อผู้ใช้งาน"
                          icon={UserRound}
                          name="name"
                          placeholder="ชื่อของคุณ"
                          autoComplete="nickname"
                          required
                          maxLength={60}
                        />
                      )}
                      <Field
                        label="อีเมล"
                        icon={Mail}
                        name="email"
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        maxLength={254}
                      />
                      {!reset && (
                        <Field
                          label="รหัสผ่าน"
                          icon={LockKeyhole}
                          name="password"
                          password
                          placeholder={
                            signup
                              ? "อย่างน้อย 8 ตัวอักษร"
                              : "กรอกรหัสผ่านของคุณ"
                          }
                          autoComplete={
                            signup ? "new-password" : "current-password"
                          }
                          minLength={signup ? 8 : undefined}
                          maxLength={128}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      )}
                      {signup && !reset && (
                        <Field
                          label="ยืนยันรหัสผ่าน"
                          icon={LockKeyhole}
                          name="confirmPassword"
                          password
                          placeholder="กรอกรหัสผ่านอีกครั้ง"
                          autoComplete="new-password"
                          required
                          minLength={8}
                          maxLength={128}
                        />
                      )}
                      {!reset && (
                        <div className="auth-form-options">
                          <label className="auth-checkbox">
                            <input
                              type="checkbox"
                              checked={remember}
                              onChange={(e) => setRemember(e.target.checked)}
                            />
                            <span>จดจำฉันไว้</span>
                          </label>
                          {!signup && (
                            <button
                              type="button"
                              className="auth-text-link"
                              onClick={() => {
                                setReset(true);
                                setError("");
                              }}
                            >
                              ลืมรหัสผ่าน?
                            </button>
                          )}
                        </div>
                      )}
                      {error && (
                        <p className="auth-error" role="alert">
                          {error}
                        </p>
                      )}
                      <button className="auth-submit" type="submit">
                        {busy ? (
                          <>
                            <LoaderCircle className="auth-spinner" size={18} />{" "}
                            กำลังดำเนินการ...
                          </>
                        ) : (
                          <>
                            {reset
                              ? "ทดลองส่งลิงก์รีเซ็ต"
                              : signup
                                ? "สร้างบัญชี"
                                : "เข้าสู่ระบบ"}{" "}
                            <ArrowRight size={17} />
                          </>
                        )}
                      </button>
                    </fieldset>
                  </form>
                  <div className="auth-card-bottom">
                    {reset ? (
                      "กลับมาเริ่มต้นดูแลเพื่อนซี้ด้วยกัน"
                    ) : signup ? (
                      <>
                        มีบัญชีอยู่แล้ว? <Link to="/login">เข้าสู่ระบบ</Link>
                      </>
                    ) : (
                      <>
                        ยังไม่มีบัญชี? <Link to="/signup">สมัครสมาชิกฟรี</Link>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            {/* <div className="auth-mock-note">
              <span>
                <ScanLine size={15} /> โหมดทดลองใช้งาน
              </span>
              <p>
                ใช้ข้อมูลตัวอย่างเพื่อทดลองได้ ไม่เก็บรหัสผ่าน
                <br />
                ยังไม่ได้เชื่อมต่อระบบบัญชีผู้ใช้จริง
              </p>
            </div> */}
          </div>
          <footer className="auth-footer">
            <span>© {new Date().getFullYear()} Pet Health AI</span>
            <span>
              <PawPrint size={12} /> Made for our best friends
            </span>
          </footer>
        </div>
      </div>
    </section>
  );
}
