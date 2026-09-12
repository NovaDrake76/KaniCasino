// builds data/haloStudents.json, the daily halo answer pool, from schaledb's student data.
// run it when a new student releases and commit the result; the day's pick is stored, so a
// pool that grows mid-day does not change today's answer.
//
//   node scripts/importHaloStudents.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SOURCE = "https://schaledb.com/data/en/students.min.json";
const OUT = path.join(__dirname, "..", "data", "haloStudents.json");
const CONCURRENCY = 8;

const SQUAD_TYPE = { Main: "Striker", Support: "Special" };
const ROLE = { DamageDealer: "Dealer", Tank: "Tank", Healer: "Healer", Support: "Support", Vehicle: "Tactical" };
const ATTACK = { Explosion: "Explosive", Pierce: "Piercing", Mystic: "Mystic", Sonic: "Sonic" };
const DEFENSE = { LightArmor: "Light", HeavyArmor: "Heavy", SpecialArmor: "Special", ElasticArmor: "Elastic" };
const ACADEMY = {
  Gehenna: "Gehenna",
  Millennium: "Millennium",
  Trinity: "Trinity",
  Abydos: "Abydos",
  Shanhaijing: "Shanhaijing",
  Hyakkiyako: "Hyakkiyako",
  RedWinter: "Red Winter",
  Valkyrie: "Valkyrie",
  Arius: "Arius",
  SRT: "SRT",
  Highlander: "Highlander",
  WildHunt: "Wild Hunt",
};

// an alt outfit is the same person as a base student already in the pool, so it would be a
// second right answer that looks wrong
const isAltUnit = (s, pathNames) => {
  if (typeof s.Name === "string" && s.Name.includes("(")) return true;
  const pathName = s.PathName || "";
  let cut = pathName.indexOf("_");
  while (cut > 0) {
    if (pathNames.has(pathName.slice(0, cut))) return true;
    cut = pathName.indexOf("_", cut + 1);
  }
  return false;
};

// the fandom wiki keeps halos at an md5-derived path of the file name
const wikiHalo = (name) => {
  const file = `${name.replace(/ /g, "_")}_Halo.png`;
  const hash = crypto.createHash("md5").update(file).digest("hex");
  return `https://static.wikia.nocookie.net/blue-archive/images/${hash[0]}/${hash.slice(0, 2)}/${file}`;
};

// the wiki answers 403 to anything that is not a browser, while a browser on our pages loads
// the same file fine. so only a definite not-found counts as missing; the page hides a halo
// that fails to load anyway.
const exists = async (url) => {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    return res.status !== 404 && res.status !== 410;
  } catch {
    return true;
  }
};

const parseHeight = (text) => {
  const match = String(text || "").match(/(\d+)/);
  return match ? Number(match[1]) : 0;
};

async function build(s) {
  const id = s.Id;
  const pathName = s.PathName;
  const devName = s.DevName ? String(s.DevName).toLowerCase() : "";

  const halo = wikiHalo(s.Name);
  let voiceline = `https://r2.schaledb.com/voice/jp_${pathName}/${pathName}_title.mp3`;
  const [haloOk, voiceOk] = await Promise.all([exists(halo), exists(voiceline)]);
  if (!voiceOk && devName) {
    const fallback = `https://r2.schaledb.com/voice/jp_${devName}/${devName}_title.mp3`;
    if (await exists(fallback)) voiceline = fallback;
  }

  return {
    name: s.Name,
    rarity: s.StarGrade,
    type: SQUAD_TYPE[s.SquadType] || "Striker",
    role: ROLE[s.TacticRole] || "Support",
    attackType: ATTACK[s.BulletType] || "Explosive",
    defenseType: DEFENSE[s.ArmorType] || "Light",
    academy: ACADEMY[s.School] || "Other",
    schoolYear: s.SchoolYear || "Unknown",
    age: s.CharacterAge || "Unknown",
    height: parseHeight(s.CharHeightMetric),
    birthday: s.Birthday || "Unknown",
    hobby: s.Hobby || "Unknown",
    club: s.Club || "Unknown",
    ssrDescription: s.CharacterSSRNew || "",
    haloImage: haloOk ? halo : "",
    studentImage: `https://schaledb.com/images/student/portrait/${id}.webp`,
    gunImage: `https://schaledb.com/images/weapon/weapon_icon_${id}.webp`,
    itemImage: `https://schaledb.com/images/gear/full/${id}.webp`,
    voiceline,
  };
}

(async () => {
  const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
  // a halo already in the file was checked in a real browser, which this script cannot do, so
  // a known student keeps it; only a new student gets the wiki url unchecked
  const knownHalo = new Map(previous.map((s) => [s.name, s.haloImage]));
  const raw = await (await fetch(SOURCE, { signal: AbortSignal.timeout(60000) })).json();
  const students = Object.values(raw);
  const pathNames = new Set(students.map((s) => s.PathName).filter(Boolean));
  const eligible = students.filter((s) => s.IsReleased && s.IsReleased[0] && !isAltUnit(s, pathNames));

  const out = [];
  for (let i = 0; i < eligible.length; i += CONCURRENCY) {
    const batch = await Promise.all(eligible.slice(i, i + CONCURRENCY).map(build));
    for (const s of batch) if (knownHalo.has(s.name)) s.haloImage = knownHalo.get(s.name);
    out.push(...batch);
    process.stdout.write(`\r${out.length}/${eligible.length}`);
  }
  out.sort((a, b) => a.name.localeCompare(b.name));

  // a partial download would shrink the pool and quietly retire real answers
  if (previous.length && out.length < previous.length * 0.8) {
    console.error(`\nrefusing to write ${out.length} students over ${previous.length}; the source looks incomplete`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  const before = new Set(previous.map((s) => s.name));
  const after = new Set(out.map((s) => s.name));
  const added = out.filter((s) => !before.has(s.name)).map((s) => s.name);
  const removed = previous.filter((s) => !after.has(s.name)).map((s) => s.name);
  console.log(`\n${out.length} students written`);
  console.log(`no halo: ${out.filter((s) => !s.haloImage).length}`);
  if (previous.length) console.log(`added: ${added.join(", ") || "none"}\nremoved: ${removed.join(", ") || "none"}`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
