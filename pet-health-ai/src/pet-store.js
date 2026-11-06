import { useEffect, useState } from "react";
import { readDemoSession } from "./auth-session.js";
export const DEFAULT_PETS = [
  { id: 1, name: "Milo", breed: "Shih Tzu", age: 4, sex: "ผู้", img: "/dogs/Milpo.png" },
  { id: 2, name: "Buddy", breed: "Golden Retriever", age: 3, sex: "ผู้", img: "/dogs/Buddy.png" },
  { id: 3, name: "Luna", breed: "Siberian Husky", age: 2, sex: "เมีย", img: "/dogs/Luna.png" },
  { id: 4, name: "Choco", breed: "Corgi", age: 1, sex: "ผู้", img: "/dogs/Choco.png" },
];

const keyFor = () => `doo-pet-pets:${readDemoSession()?.id || 'guest'}`;
export function readPets() {
  try {
    const value = JSON.parse(localStorage.getItem(keyFor()) || 'null');
    if (Array.isArray(value) && value.length && value.every(p => p && Number.isFinite(p.id) && typeof p.name === 'string' && typeof p.breed === 'string' && Number.isFinite(p.age) && typeof p.img === 'string')) return value;
  } catch { /* Use starter pets if storage is unavailable. */ }
  return DEFAULT_PETS;
}
export function savePets(pets) {
  localStorage.setItem(keyFor(), JSON.stringify(pets));
  window.dispatchEvent(new Event('doo-pet-pets'));
}
export function usePets() {
  const [pets, setPets] = useState(readPets);
  useEffect(() => {
    const sync = () => setPets(readPets());
    for (const event of ['doo-pet-pets', 'storage', 'pet-health-session']) window.addEventListener(event, sync);
    return () => { for (const event of ['doo-pet-pets', 'storage', 'pet-health-session']) window.removeEventListener(event, sync); };
  }, []);
  return pets;
}
