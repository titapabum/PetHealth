import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight, Clock3, LocateFixed, LoaderCircle, MapPin, Minus,
  Navigation, PawPrint, Phone, Plus, Search, Stethoscope,
} from "lucide-react";

const TILE_SIZE = 256;
const SEARCH_RADIUS_METERS = 20000;
const MAX_NEARBY_CLINICS = 5;
const START_LOCATION = { lat: 13.7563, lon: 100.5018 };
const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY?.trim() || "";

function toWorldPixel(lat, lon, zoom) {
  const latitude = Math.max(-85.0511, Math.min(85.0511, lat));
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function distanceKm(from, to) {
  const rad = (n) => (n * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLon = rad(to.lon - from.lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} ม.` : `${km.toFixed(1)} กม.`;
}

async function getNearbyClinics(location) {
  if (!GEOAPIFY_API_KEY) {
    throw new Error("ยังไม่ได้ตั้งค่า Geoapify API key: เพิ่ม VITE_GEOAPIFY_API_KEY ในไฟล์ .env.local แล้วเริ่มแอปใหม่");
  }
  const { lat, lon } = location;
  const params = new URLSearchParams({
    categories: "pet.veterinary",
    filter: `circle:${lon},${lat},${SEARCH_RADIUS_METERS}`,
    bias: `proximity:${lon},${lat}`,
    limit: "20",
    lang: "th",
    apiKey: GEOAPIFY_API_KEY,
  });
  let response;
  try {
    response = await fetch(`https://api.geoapify.com/v2/places?${params}`, { signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error("เชื่อมต่อ Geoapify ไม่ได้ ตรวจสอบอินเทอร์เน็ตและการตั้งค่าโดเมนของ API key");
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("Geoapify ปฏิเสธ API key กรุณาตรวจสอบ key และโดเมนที่อนุญาต");
    if (response.status === 429) throw new Error("ใช้โควตา Geoapify ถึงขีดจำกัดแล้ว กรุณาลองใหม่ภายหลัง");
    throw new Error(`Geoapify ค้นหาคลินิกไม่สำเร็จ (HTTP ${response.status}) กรุณาลองใหม่อีกครั้ง`);
  }
  const data = await response.json();
  const features = Array.isArray(data.features) ? data.features : [];
  const seen = new Set();
  return features.flatMap((feature) => {
    const properties = feature.properties || {};
    const raw = properties.datasource?.raw || {};
    const [featureLon, featureLat] = feature.geometry?.coordinates || [];
    const point = { lat: Number(properties.lat ?? featureLat), lon: Number(properties.lon ?? featureLon) };
    const name = properties.name || properties.address_line1 || raw.name;
    if (!name || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return [];
    const key = `${name}:${point.lat.toFixed(5)}:${point.lon.toFixed(5)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      id: properties.place_id || key,
      name,
      lat: point.lat,
      lon: point.lon,
      km: distanceKm(location, point),
      hours: properties.opening_hours || raw.opening_hours || "เวลาเปิด-ปิดไม่ได้ระบุ",
      phone: properties.phone || raw.phone || raw["contact:phone"] || "",
      address: properties.address_line2 || properties.formatted || "",
    }];
  }).sort((a, b) => a.km - b.km).slice(0, MAX_NEARBY_CLINICS);
}

function ClinicMap({ center, location, hasLocation, clinics, selectedId, zoom, onZoom, onSelect, onLocate, locating }) {
  const mapRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!mapRef.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setSize({
      width: entry.contentRect.width,
      height: entry.contentRect.height,
    }));
    observer.observe(mapRef.current);
    return () => observer.disconnect();
  }, []);

  const centerPoint = useMemo(() => toWorldPixel(center.lat, center.lon, zoom), [center, zoom]);
  const mapTiles = useMemo(() => {
    if (!size.width || !size.height) return [];
    const tileX = Math.floor(centerPoint.x / TILE_SIZE);
    const tileY = Math.floor(centerPoint.y / TILE_SIZE);
    const columns = Math.ceil(size.width / TILE_SIZE) + 2;
    const rows = Math.ceil(size.height / TILE_SIZE) + 2;
    const startX = -Math.floor(columns / 2);
    const startY = -Math.floor(rows / 2);
    const offsetX = size.width / 2 - (centerPoint.x - tileX * TILE_SIZE);
    const offsetY = size.height / 2 - (centerPoint.y - tileY * TILE_SIZE);
    const count = 2 ** zoom;
    const tiles = [];
    for (let dx = startX; dx < startX + columns; dx += 1) {
      for (let dy = startY; dy < startY + rows; dy += 1) {
        const y = tileY + dy;
        if (y < 0 || y >= count) continue;
        const x = ((tileX + dx) % count + count) % count;
        tiles.push({ key: `${zoom}/${x}/${y}`, x, y, left: offsetX + dx * TILE_SIZE, top: offsetY + dy * TILE_SIZE });
      }
    }
    return tiles;
  }, [centerPoint, size, zoom]);

  const markerPosition = (clinic) => {
    const point = toWorldPixel(clinic.lat, clinic.lon, zoom);
    const worldSize = TILE_SIZE * 2 ** zoom;
    let dx = point.x - centerPoint.x;
    if (dx > worldSize / 2) dx -= worldSize;
    if (dx < -worldSize / 2) dx += worldSize;
    return { left: size.width / 2 + dx, top: size.height / 2 + point.y - centerPoint.y };
  };
  const userPosition = markerPosition(location);

  return (
    <div className="clinic-map" ref={mapRef}>
      <div className="clinic-map-tiles" aria-hidden="true">
        {mapTiles.map((tile) => <img key={tile.key} src={GEOAPIFY_API_KEY ? `https://maps.geoapify.com/v1/tile/osm-carto/${tile.key}.png?apiKey=${encodeURIComponent(GEOAPIFY_API_KEY)}` : `https://tile.openstreetmap.org/${tile.key}.png`} alt="" draggable="false" style={{ left: tile.left, top: tile.top }} />)}
      </div>
      <div className="clinic-map-grid" aria-hidden="true" />
      {size.width > 0 && clinics.map((clinic) => {
        const position = markerPosition(clinic);
        if (position.left < -24 || position.left > size.width + 24 || position.top < -42 || position.top > size.height + 10) return null;
        return <button key={clinic.id} className={`clinic-map-marker ${clinic.id === selectedId ? "selected" : ""}`} style={position} onClick={() => onSelect(clinic)} aria-label={`เลือก ${clinic.name}`} title={clinic.name}><MapPin size={23} fill="currentColor" /><span><Stethoscope size={12} /></span></button>;
      })}
      {hasLocation && <div className="clinic-you-marker" style={userPosition} aria-label="ตำแหน่งของคุณ"><span /><b>คุณอยู่ที่นี่</b></div>}
      <div className="clinic-map-controls">
        <button onClick={() => onZoom(Math.min(18, zoom + 1))} aria-label="ซูมเข้า"><Plus size={19} /></button>
        <button onClick={() => onZoom(Math.max(3, zoom - 1))} aria-label="ซูมออก"><Minus size={19} /></button>
        <button className="locate-map-button" onClick={onLocate} disabled={locating} aria-label="ค้นหาตำแหน่งปัจจุบัน">{locating ? <LoaderCircle className="spin" size={18} /> : <LocateFixed size={19} />}</button>
      </div>
      <button className="clinic-locate-hint" onClick={onLocate} disabled={locating}>
        {locating ? <LoaderCircle className="spin" size={16} /> : <Navigation size={16} />}
        {locating ? "กำลังค้นหาคลินิกใกล้คุณ…" : "ค้นหาคลินิกใกล้ตำแหน่งปัจจุบัน"}
      </button>
      <span className="clinic-attribution">{GEOAPIFY_API_KEY ? <><a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a> · </> : null}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></span>
    </div>
  );
}

export default function Clinics() {
  const [location, setLocation] = useState(START_LOCATION);
  const [mapCenter, setMapCenter] = useState(START_LOCATION);
  const [hasLocation, setHasLocation] = useState(false);
  const [clinics, setClinics] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(14);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("distance");

  const locateAndSearch = () => {
    if (!navigator.geolocation) {
      setError("เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setLoading(true);
    setError("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const current = { lat: coords.latitude, lon: coords.longitude };
      setLocation(current);
      setMapCenter(current);
      setHasLocation(true);
      setZoom(14);
      try {
        const results = await getNearbyClinics(current);
        setClinics(results);
        setSelectedId(results[0]?.id ?? null);
        if (results.length === 0) setError("ยังไม่พบข้อมูลคลินิกสัตว์เลี้ยงใกล้ตำแหน่งของคุณ ลองค้นหาอีกครั้งภายหลัง");
      } catch (err) {
        setClinics([]);
        setError(err.message || "ค้นหาคลินิกไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่");
      } finally {
        setLoading(false);
      }
    }, (err) => {
      setLoading(false);
      setError(err.code === 1 ? "กรุณาอนุญาตการเข้าถึงตำแหน่ง เพื่อค้นหาคลินิกใกล้คุณ" : "ระบุตำแหน่งไม่สำเร็จ กรุณาลองอีกครั้ง");
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  };

  const shownClinics = useMemo(() => {
    const filtered = clinics.filter((clinic) => clinic.name.toLowerCase().includes(search.trim().toLowerCase()));
    return filtered.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "th") : a.km - b.km);
  }, [clinics, search, sort]);

  const selectClinic = (clinic) => {
    setSelectedId(clinic.id);
    setMapCenter({ lat: clinic.lat, lon: clinic.lon });
  };

  return (
    <div className="clinics-page">
      <section className="clinic-hero">
        <div className="clinic-hero-copy">
          <span className="clinic-hero-icon"><MapPin size={42} fill="currentColor" /></span>
          <div><p className="clinic-eyebrow">PET CARE NEAR YOU</p><h1>ค้นหาคลินิกสัตว์เลี้ยงใกล้ฉัน</h1><p>ดูคลินิกใกล้คุณ พร้อมข้อมูลติดต่อและเส้นทาง</p></div>
        </div>
        <div className="clinic-hero-paw"><PawPrint size={54} /></div>
        <div className="clinic-hero-note">สุขภาพดี<br />เริ่มได้…ที่นี่ <PawPrint size={19} /></div>
      </section>

      <section className="clinic-explorer">
        <article className="clinic-map-panel">
          <h2><MapPin size={20} fill="currentColor" /> แผนที่คลินิกใกล้คุณ</h2>
          <ClinicMap center={mapCenter} location={location} hasLocation={hasLocation} clinics={clinics} selectedId={selectedId} zoom={zoom} onZoom={setZoom} onSelect={selectClinic} onLocate={locateAndSearch} locating={loading} />
        </article>

        <aside className="clinic-results-panel">
          <div className="clinic-results-head">
            <div><h2><PawPrint size={22} /> คลินิกใกล้คุณ</h2><p>{hasLocation ? `แสดง ${clinics.length} แห่งที่ใกล้ที่สุดในรัศมี ${SEARCH_RADIUS_METERS / 1000} กม.` : "เปิดตำแหน่งเพื่อค้นหาคลินิกใกล้คุณ"}</p></div>
            <label className="clinic-sort">เรียงตาม
              <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="เรียงคลินิกตาม">
                <option value="distance">ระยะใกล้สุด</option><option value="name">ชื่อคลินิก</option>
              </select>
            </label>
          </div>
          <label className="clinic-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อคลินิก" aria-label="ค้นหาชื่อคลินิก" /></label>

          {loading && <div className="clinic-status"><LoaderCircle className="spin" size={22} /> กำลังค้นหาคลินิกจาก OpenStreetMap…</div>}
          {!loading && !hasLocation && <div className="clinic-empty"><span><LocateFixed size={26} /></span><b>ค้นหาคลินิกใกล้คุณ</b><p>แตะปุ่มด้านล่างเพื่อใช้ตำแหน่งปัจจุบัน และดูคลินิกสัตว์เลี้ยงที่อยู่ใกล้ที่สุด</p><button onClick={locateAndSearch}><Navigation size={16} /> ใช้ตำแหน่งปัจจุบัน</button></div>}
          {!loading && error && <p className="clinic-error" role="status">{error}</p>}
          {!loading && hasLocation && shownClinics.length > 0 && <div className="clinic-list">
            {shownClinics.map((clinic) => (
              <article key={clinic.id} className={`clinic-result-card ${clinic.id === selectedId ? "active" : ""}`} onClick={() => selectClinic(clinic)}>
                <div className="clinic-card-photo with-image"><img src="/dogs/clinic.png" alt="ภาพประกอบคลินิกสัตว์เลี้ยง" /><span>คลินิก</span></div>
                <div className="clinic-card-info">
                  <div className="clinic-card-title"><h3>{clinic.name}</h3><span className="clinic-distance"><MapPin size={13} /> {formatDistance(clinic.km)}</span></div>
                  {clinic.address && <p className="clinic-address">{clinic.address}</p>}
                  <p><Clock3 size={14} /> {clinic.hours}</p>
                  <div className="clinic-card-actions">
                    {clinic.phone ? <a href={`tel:${clinic.phone.replace(/[^\d+]/g, "")}`} onClick={(event) => event.stopPropagation()}><Phone size={14} /> โทร</a> : <span className="clinic-no-phone"><Phone size={14} /> ไม่ระบุเบอร์</span>}
                    <a className="clinic-directions" href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${location.lat}%2C${location.lon}%3B${clinic.lat}%2C${clinic.lon}`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><Navigation size={14} /> เส้นทาง <ArrowUpRight size={13} /></a>
                  </div>
                </div>
              </article>
            ))}
          </div>}
          <div className="clinic-data-note"><span><Stethoscope size={16} /></span><p>ข้อมูลคลินิกจาก Geoapify อาจมีรายละเอียดไม่ครบ ควรโทรสอบถามก่อนเดินทาง</p></div>
        </aside>
      </section>
      <footer className="clinic-footer"><span><PawPrint size={23} /></span><b>ดูแลสุขภาพสัตว์เลี้ยงด้วยเทคโนโลยี AI เพื่อเพื่อนสี่ขาในทุกวัน</b><HeartIcon /></footer>
    </div>
  );
}

function HeartIcon() {
  return <span className="clinic-footer-heart">♥</span>;
}
