import { HashRouter, Routes, Route, useLocation } from "react-router-dom";
import { Header } from "./shared.jsx";
import Home from "./pages/Home.jsx";
import Check from "./pages/Check.jsx";
import History from "./pages/History.jsx";
import Clinics from "./pages/Clinics.jsx";
import About from "./pages/About.jsx";
import Auth from "./pages/Auth.jsx";
import "./App.css";

function AppLayout() {
 const { pathname } = useLocation();
 const isAuthPage = pathname === '/login' || pathname === '/signup';
 return <>{!isAuthPage && <Header />}<main className={isAuthPage ? 'auth-layout' : undefined}><Routes><Route path="/" element={<Home />} /><Route path="/check" element={<Check />} /><Route path="/history" element={<History />} /><Route path="/clinics" element={<Clinics />} /><Route path="/about" element={<About />} /><Route path="/login" element={<Auth key="login" />} /><Route path="/signup" element={<Auth key="signup" mode="signup" />} /></Routes></main></>;
}

export default function App() {
 return <HashRouter><AppLayout /></HashRouter>;
}
