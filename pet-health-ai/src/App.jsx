import { HashRouter, Routes, Route } from "react-router-dom";
import { Header } from "./shared.jsx";
import Home from "./pages/Home.jsx";
import Check from "./pages/Check.jsx";
import History from "./pages/History.jsx";
import Clinics from "./pages/Clinics.jsx";
import About from "./pages/About.jsx";
import "./App.css";

export default function App() {
 return <HashRouter><Header /><main><Routes><Route path="/" element={<Home />} /><Route path="/check" element={<Check />} /><Route path="/history" element={<History />} /><Route path="/clinics" element={<Clinics />} /><Route path="/about" element={<About />} /></Routes></main></HashRouter>;
}
