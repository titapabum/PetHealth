import { useEffect, useLayoutEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Header } from "./shared.jsx";
import Check from "./pages/Check.jsx";
import History from "./pages/History.jsx";
import Clinics from "./pages/Clinics.jsx";
import About from "./pages/About.jsx";
import Settings from "./pages/Settings.jsx";
import Auth from "./pages/Auth.jsx";
import "./App.css";
import "./Themes.css";

function AppLayout() {
 const { pathname } = useLocation();
 const [theme, setTheme] = useState(() => {
   try { const saved = Number(localStorage.getItem('pet-health-theme')); return [1, 2, 3, 4, 5].includes(saved) ? saved : 1; }
   catch { return 1; }
 });
 useEffect(() => {
   try { localStorage.setItem('pet-health-theme', String(theme)); } catch { /* Keep switching available without storage. */ }
 }, [theme]);
 useLayoutEffect(() => {
   document.documentElement.dataset.theme = String(pathname === '/login' ? 1 : theme);
 }, [pathname, theme]);
 const isAuthPage = pathname === '/login' || pathname === '/signup';
 const layoutClass = isAuthPage ? 'auth-layout' : `page-layout page-layout-${pathname === '/' ? 'home' : pathname.slice(1)}`;
 return <>{!isAuthPage && <Header theme={theme} onCycleTheme={() => setTheme(value => value % 5 + 1)} />}<main className={layoutClass}><Routes><Route path="/" element={<Navigate to="/check" replace />} /><Route path="/check" element={<Check />} /><Route path="/history" element={<History />} /><Route path="/clinics" element={<Clinics />} /><Route path="/settings" element={<Settings />} /><Route path="/about" element={<About />} /><Route path="/login" element={<Auth key="login" />} /><Route path="/signup" element={<Auth key="signup" mode="signup" />} /></Routes></main></>;
}

export default function App() {
 return <HashRouter><AppLayout /></HashRouter>;
}

