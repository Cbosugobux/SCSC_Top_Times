/* ============================================================
   SCSC Top Times — Cleaned + Hardened JS (FINAL)
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  /* ---------------- DOM ---------------- */
  const courseSelect   = $("course");
  const eventSelect    = $("event");
  const genderSelect   = $("gender");
  const ageGroupSelect = $("age_group_desc");
  const form           = $("filter-form");
  const resultsBody    = $("results-table");

  if (!courseSelect || !eventSelect || !genderSelect || !ageGroupSelect || !form || !resultsBody) {
    console.error("❌ Missing DOM elements");
    return;
  }

  /* ---------------- CONFIG ---------------- */
  const JSON_PATH = "Static/SCSCTop10_with_course.json";
  const COURSES = ["SCY", "LCM"];
  const GENDERS = { Male: "M", Female: "F" };

  /* ---------------- STATIC DROPDOWNS ---------------- */
  courseSelect.innerHTML = COURSES.map(c => `<option value="${c}">${c}</option>`).join("");
  genderSelect.innerHTML = Object.entries(GENDERS)
    .map(([k, v]) => `<option value="${v}">${k}</option>`)
    .join("");

  /* ---------------- NORMALIZATION HELPERS ---------------- */
  const norm = (v) =>
    String(v ?? "").trim().toUpperCase().replace(/\s+/g, " ");

  const normalizeGender = (v) => {
    const s = norm(v);
    if (["M","MALE","MEN","BOYS","BOY"].some(x => s.includes(x))) return "M";
    if (["F","FEMALE","WOMEN","GIRLS","GIRL"].some(x => s.includes(x))) return "F";
    return s;
  };

  const normalizeAgeGroup = (v) =>
    norm(v)
      .replace(/[–—]/g, "-")
      .replace(/\s*&\s*/g, " & ")
      .replace(/\bAND\b/g, "&");

  const normalizeEventBase = (v) =>
    norm(v)
      .replace(/\bFREESTYLE\b/g, "FR")
      .replace(/\bFREE\b/g, "FR")
      .replace(/\bBACKSTROKE\b/g, "BK")
      .replace(/\bBREASTSTROKE\b/g, "BR")
      .replace(/\bBUTTERFLY\b/g, "FL")
      .replace(/\bINDIVIDUAL\s+MEDLEY\b/g, "IM");

  const parseEvent = (evt) => {
    const s = norm(evt);
    const m = s.match(/\b(SCY|LCM)\b$/);
    const course = m ? m[1] : "";
    const base = normalizeEventBase(
      course ? s.replace(/\s*\b(SCY|LCM)\b$/, "") : s
    );
    return { base, course };
  };

  const timeToSeconds = (t) => {
    const s = norm(t);
    if (!s || ["NT","DQ","NS","SCR"].includes(s)) return Infinity;
    if (s.includes(":")) {
      const parts = s.split(":").map(Number);
      return parts.some(isNaN) ? Infinity : parts.reduce((a,b)=>a*60+b,0);
    }
    const n = Number(s);
    return isNaN(n) ? Infinity : n;
  };

  /* ---------------- UI HELPERS ---------------- */
  const setStatus = (msg) => {
    resultsBody.innerHTML =
      `<tr><td colspan="4" style="text-align:center;padding:12px;color:#666;">${msg}</td></tr>`;
  };

  const renderRows = (rows) => {
    if (!rows.length) return setStatus("No results found");

    resultsBody.innerHTML = rows.map(r => `
      <tr>
        <td data-label="Rank">${r.rank}</td>
        <td data-label="Name">${r.name}</td>
        <td data-label="Swim Time">${r.time}</td>
        <td data-label="Date">${r.date}</td>
      </tr>
    `).join("");

    requestAnimationFrame(() =>
      resultsBody.querySelectorAll("tr").forEach(tr => tr.classList.add("show"))
    );
  };

  /* ---------------- LOAD DATA ---------------- */
  let allRows = [];
  const eventMap = { SCY: new Set(), LCM: new Set() };
  const ageGroups = new Set();

  setStatus("Loading…");

  fetch(JSON_PATH)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      const rawRows =
        data?.Table2?.Detail_Collection ??
        data?.Table1?.Detail_Collection ??
        data?.Detail_Collection ??
        data?.rows ??
        [];

      if (!rawRows.length) {
        console.error("❌ No rows found. JSON keys:", Object.keys(data));
        setStatus("No data available");
        return;
      }

      allRows = rawRows.map(r => ({
        ...r,
        Event: norm(r.Event),
        Gender: normalizeGender(r["Competition Category"]),
        Age: normalizeAgeGroup(r["Age Group"]),
        Time: r.Time,
        Date: r["Swim Date"],
        First: r.First ?? "",
        Last: r.Last ?? ""
      }));

      allRows.forEach(r => {
        const { base, course } = parseEvent(r.Event);
        if (course) eventMap[course].add(base);
        if (r.Age) ageGroups.add(r.Age);
      });

      ageGroupSelect.innerHTML = [...ageGroups].sort()
        .map(a => `<option value="${a}">${a}</option>`).join("");

      const refreshEvents = () => {
        const c = courseSelect.value;
        eventSelect.innerHTML = [...eventMap[c]].sort()
          .map(e => `<option value="${e}">${e}</option>`).join("");
      };

      const runFilter = () => {
        const payload = {
          course: courseSelect.value,
          event: normalizeEventBase(eventSelect.value),
          gender: genderSelect.value,
          age: normalizeAgeGroup(ageGroupSelect.value)
        };

        const rows = allRows
          .filter(r => {
            const { base, course } = parseEvent(r.Event);
            return (
              course === payload.course &&
              base === payload.event &&
              r.Gender === payload.gender &&
              r.Age === payload.age
            );
          })
          .sort((a,b)=>timeToSeconds(a.Time)-timeToSeconds(b.Time))
          .slice(0,10)
          .map((r,i)=>({
            rank: i+1,
            name: `${r.First} ${r.Last}`.trim() || "—",
            time: r.Time || "—",
            date: r.Date || "—"
          }));

        renderRows(rows);
      };

      refreshEvents();
      runFilter();

      courseSelect.addEventListener("change", () => { refreshEvents(); runFilter(); });
      eventSelect.addEventListener("change", runFilter);
      genderSelect.addEventListener("change", runFilter);
      ageGroupSelect.addEventListener("change", runFilter);
      form.addEventListener("submit", e => { e.preventDefault(); runFilter(); });
    })
    .catch(err => {
      console.error("❌ JSON load failed:", err);
      setStatus("Error loading data");
    });
});
