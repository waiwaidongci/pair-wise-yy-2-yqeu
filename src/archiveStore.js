// 档案保存：鸽只档案与证书的读写、旧数据迁移和档案变更
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "..", "data", "pigeons.json");

const seed = {
  pigeons: [
    { ringNo: "CHN-2026-001", owner: "北岸棚", fatherRing: "CHN-2022-188", motherRing: "CHN-2023-512", color: "灰", loft: "北岸A棚", vaccines: [{ date: "2026-04-01", name: "新城疫" }], transfers: [{ date: "2026-04-15", from: "育种棚", to: "北岸棚" }], races: [{ date: "2026-06-01", event: "120公里训放", distance: 120, returnTime: "10:42", rank: 18 }] },
    { ringNo: "CHN-2022-188", owner: "育种棚", fatherRing: "", motherRing: "", color: "雨点", loft: "种鸽棚", vaccines: [], transfers: [], races: [] },
    { ringNo: "CHN-2023-512", owner: "育种棚", fatherRing: "", motherRing: "", color: "红轮", loft: "种鸽棚", vaccines: [], transfers: [], races: [] }
  ],
  certificates: [],
  certSeq: 0
};

export async function loadDb() {
  if (!existsSync(dbPath)) {
    await mkdir(dirname(dbPath), { recursive: true });
    await writeFile(dbPath, JSON.stringify(seed, null, 2));
  }
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  // 旧档案迁移：补上证书集合
  if (!Array.isArray(db.certificates)) db.certificates = [];
  if (typeof db.certSeq !== "number") db.certSeq = 0;
  return db;
}

export async function saveDb(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function findPigeon(db, ringNo) {
  return db.pigeons.find(item => item.ringNo === ringNo) || null;
}

export function childrenOf(db, ringNo) {
  return db.pigeons.filter(item => item.fatherRing === ringNo || item.motherRing === ringNo);
}

export function relation(db, ringNo) {
  const pigeon = findPigeon(db, ringNo);
  if (!pigeon) return null;
  return {
    pigeon,
    father: findPigeon(db, pigeon.fatherRing),
    mother: findPigeon(db, pigeon.motherRing),
    children: childrenOf(db, ringNo)
  };
}

export function createPigeon(db, input) {
  if (!input.ringNo || !input.ringNo.trim()) return { error: "ring_required" };
  if (findPigeon(db, input.ringNo)) return { error: "ring_exists" };
  const pigeon = {
    ringNo: input.ringNo,
    owner: input.owner || "",
    fatherRing: input.fatherRing || "",
    motherRing: input.motherRing || "",
    color: input.color || "",
    loft: input.loft || "",
    vaccines: [],
    transfers: [],
    races: []
  };
  db.pigeons.unshift(pigeon);
  return { pigeon };
}

export function addTransfer(db, ringNo, input) {
  const pigeon = findPigeon(db, ringNo);
  if (!pigeon) return { error: "pigeon_not_found" };
  if (!input.to || !input.to.trim()) return { error: "transfer_to_required" };
  pigeon.transfers.push({ date: input.date || today(), from: pigeon.owner, to: input.to });
  pigeon.owner = input.to;
  return { pigeon };
}

export function addRace(db, ringNo, input) {
  const pigeon = findPigeon(db, ringNo);
  if (!pigeon) return { error: "pigeon_not_found" };
  pigeon.races.push({ date: input.date || today(), event: input.event, distance: Number(input.distance || 0), returnTime: input.returnTime || "", rank: Number(input.rank || 0) });
  return { pigeon };
}

export function addVaccine(db, ringNo, input) {
  const pigeon = findPigeon(db, ringNo);
  if (!pigeon) return { error: "pigeon_not_found" };
  if (!input.name || !input.name.trim()) return { error: "vaccine_name_required" };
  pigeon.vaccines.push({ date: input.date || today(), name: input.name });
  return { pigeon };
}

// 父母信息更正：只改档案值，证书换发由证书判定模块联动
export function correctParents(db, ringNo, input) {
  const pigeon = findPigeon(db, ringNo);
  if (!pigeon) return { error: "pigeon_not_found" };
  const fatherRing = (input.fatherRing || "").trim();
  const motherRing = (input.motherRing || "").trim();
  if (fatherRing === ringNo || motherRing === ringNo) return { error: "parent_is_self" };
  pigeon.fatherRing = fatherRing;
  pigeon.motherRing = motherRing;
  return { pigeon };
}
