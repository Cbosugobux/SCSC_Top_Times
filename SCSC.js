/* ============================================================
   SCSC Top Times — Cleaned + Hardened JS (parsing-safe)
   - Robust parsing for Event / Gender / Age Group / Time
   - Builds dropdowns from data (events + age groups)
   - Filters + sorts + renders Top 10
   - Adds .show class for row animations (if your CSS uses it)
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // ---- DOM ----
  const courseSelect   = $("course");
  const eventSelect    = $("event");
  const genderSelect   = $("gender");
  const ageGroupSelect = $("age_group_desc");
  const form           = $("filter-form");
  const resultsBody    = $("results-table"); // NOTE: This is assumed to be <tbody id="results-table">

  if (!courseSelect || !eventSelect || !genderSelect || !ageGroupSelect || !form || !resultsBody) {
    console.error("❌ Missing DOM elements. Check element IDs.");
    return;
  }

  // ---- CONFIG ----
  const JSON_PATH = "Static/SCSCTop10_with_course.json"; // update if needed
  const COURSES = ["SCY", "LCM"];
  const GENDERS = { Male: "M", Female: "F" };

  // ---- Static dropdowns ----
  courseSelect.innerHTML = COURSES.map((c) => `<option value="${c}">${c}</option>`).join("");
  genderSelect.innerHTML = Object.entries(GENDERS)
    .map(([label, val]) => `<option value="${val}">${label}</option>`)
    .join("");

  // ---- Helpers: normalization ----
  const norm = (s) =>
    String(s ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");

  const safeTrim = (v) => (typeof v === "string" ? v.trim() : v);

  const normalizeGender = (v) => {
    const s = norm(v);
    if (s === "M" || s.includes("MALE") || s.includes("MEN") || s.includes("BOY") || s.includes("BOYS")) return "M";
    if (s === "F" || s.includes("FEMALE") || s.includes("WOMEN") || s.includes("GIRL") || s.includes("GIRLS")) return "F";
    return s; // fallback (won't match M/F unless user selects same)
  };

  const normalizeAgeGroup = (v) =>
    norm(v)
      .replace(/[–—]/g, "-")      // normalize fancy dashes
      .replace(/\s*&\s*/g, " & ") // normalize ampersands spacing
      .replace(/\bAND\b/g, "&");  // optional normalization

  const normalizeEventBase = (base) => {
    // If your input ever contains longer words, this keeps it stable.
    // You can add more mappings here if your sources vary.
    return norm(base)
      .replace(/\bFREESTYLE\b/g, "FR")
      .replace(/\bFREE\b/g, "FR")
      .replace(/\bBACKSTROKE\b/g, "BK")
      .replace(/\bBREASTSTROKE\b/g, "BR")
      .replace(/\bBUTTERFLY\b/g, "FL")
      .replace(/\bINDIVIDUAL\s+MEDLEY\b/g, "IM")
      .replace(/\s+/g, " ");
  };

  // "50 FR SCY" -> { base: "50 FR", course: "SCY" }
  // Also works if there is extra spacing/case differences.
  const parseEvent = (evt) => {
    const s = norm(evt);
    // Grab SCY/LCM at the end if present
    const m = s.match(/\b(SCY|LCM)\b\s*$/);
    const course = m ? m[1] : "";
    const baseRaw = course ? s.replace(/\s*\b(SCY|LCM)\b\s*$/, "").trim() : s;
    const base = normalizeEventBase(baseRaw);
    return { base, course };
  };

  const timeToSeconds = (t) => {
    const s = norm(t);
    if (!s) return Number.POSITIVE_INFINITY;
    if (["NT", "DQ", "NS", "SCR"].includes(s)) return Number.POSITIVE_INFINITY;

    // mm:ss.xx or hh:mm:ss.xx styles (reduce handles any colon count)
    if (s.includes(":")) {
      const parts = s.split(":").map((p) => parseFloat(p));
      if (parts.some((x) => Number.isNaN(x))) return Number.POSITIVE_INFINITY;
      return parts.reduce((acc, p) => acc * 60 + p, 0);
    }

    const num = parseFloat(s);
    return Number.isFinite(num) ? num : Number.POSITIVE_INFINITY;
  };

  const escapeHtml = (str) =>
    String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // ---- UI helpers ----
  const setStatusRow = (msg) => {
    resultsBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#666;padding:12px;">${escapeHtml(
      msg
    )}</td></tr>`;
  };

  const renderRows = (rows) => {
    if (!rows.length) {
      setStatusRow("No results found");
      return;
    }

    resultsBody.innerHTML = rows
      .map(
        (r) => `
        <tr>
          <td data-label="Rank">${escapeHtml(r.rank)}</td>
          <td data-label="Name">${escapeHtml(r.name)}</td>
          <td data-label="Swim Time">${escapeHtml(r.swim_time)}</td>
          <td data-label="Date">${escapeHtml(r.date)}</td>
        </tr>
      `
      )
      .join("");

    // Add .show for row animation if your CSS expects it
    requestAnimationFrame(() => {
      resultsBody.querySelectorAll("tr").forEach((tr) => tr.classList.add("show"));
    });
  };

  // ---- Data load ----
  const loadJSON = (url) => {
    if (window.d3 && typeof window.d3.json === "function") return window.d3.json(url);
    return fetch(url, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} while fetching ${url}`);
      return r.json();
    });
  };

  // ---- State ----
  let allRows = [];

  const eventMap = { SCY: new Set(), LCM: new Set() }; // course -> Set(event base)
  const ageGroupSet = new Set();

  const refreshEventsFromMap = () => {
    const selectedCourse = courseSelect.value;
    const events = Array.from(eventMap[selectedCourse] || []).sort((a, b) => a.localeCompare(b));
    const prev = eventSelect.value;

    eventSelect.innerHTML = events.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");

    if (prev && events.includes(prev)) eventSelect.value = prev;
    if (!eventSelect.value && events.length) eventSelect.value = events[0];
  };

  const refreshAgeGroups = () => {
    const ageGroups = Array.from(ageGroupSet).sort((a, b) => a.localeCompare(b));
    const prev = ageGroupSelect.value;

    ageGroupSelect.innerHTML = ageGroups
      .map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`)
      .join("");

    if (prev && ageGroups.includes(prev)) ageGroupSelect.value = prev;
    if (!ageGroupSelect.value && ageGroups.length) ageGroupSelect.value = ageGroups[0];
  };

  // ---- Filter + render ----
  const runFilter = () => {
    const payload = {
      course: norm(courseSelect.value),
      event_code: normalizeEventBase(eventSelect.value),
      gender: norm(genderSelect.value), // M/F
      age_group: normalizeAgeGroup(ageGroupSelect.value),
    };

    const filtered = allRows
      .filter((d) => {
        const { base, course } = parseEvent(d.Event);
        const g = normalizeGender(d["Competition Category"]);
        const ag = normalizeAgeGroup(d["Age Group"]);

        return (
          course === payload.course &&
          base === payload.event_code &&
          g === payload.gender &&
          ag === payload.age_group
        );
      })
      .sort((a, b) => timeToSeconds(a.Time) - timeToSeconds(b.Time))
      .slice(0, 10)
      .map((row, i) => {
        // Some relay rows have First with multiple names and Last blank — keep it readable.
        const first = safeTrim(row.First) ?? "";
        const last = safeTrim(row.Last) ?? "";
        const name = (first && last) ? `${first} ${last}`.trim() : (first || last || "").trim();

        return {
          rank: i + 1,
          name: name || "—",
          swim_time: safeTrim(row.Time) ?? "—",
          date: safeTrim(row["Swim Date"]) ?? "—",
        };
      });

    renderRows(filtered);
  };

  // ---- Wire up ----
  courseSelect.addEventListener("change", () => {
    refreshEventsFromMap();
    runFilter();
  });
  eventSelect.addEventListener("change", runFilter);
  genderSelect.addEventListener("change", runFilter);
  ageGroupSelect.addEventListener("change", runFilter);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runFilter();
  });

  // ---- Load + initialize ----
  setStatusRow("Loading…");

  loadJSON(JSON_PATH)
    .then((data) => {
      const rawRows = data?.Table2?.Detail_Collection || [];
      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        setStatusRow("No data available");
        return;
      }

      // Normalize rows (defensive)
      const rows = rawRows.map((r) => {
        const obj = { ...r };
        obj.Event = safeTrim(obj.Event);
        obj["Competition Category"] = safeTrim(obj["Competition Category"]);
        obj["Age Group"] = safeTrim(obj["Age Group"]);
        obj.Time = safeTrim(obj.Time);
        obj["Swim Date"] = safeTrim(obj["Swim Date"]);
        obj.First = safeTrim(obj.First);
        obj.Last = safeTrim(obj.Last);
        return obj;
      });

      allRows = rows;

      // Build dynamic lists from data
      rows.forEach((r) => {
        const { base, course } = parseEvent(r.Event);
        if (course && eventMap[course]) eventMap[course].add(base);

        const ag = normalizeAgeGroup(r["Age Group"]);
        if (ag) ageGroupSet.add(ag);
      });

      refreshAgeGroups();

      // Default to a known-good combo from the dataset
      const first = rows.find((r) => {
        const { base, course } = parseEvent(r.Event);
        return course && base && normalizeGender(r["Competition Category"]) && normalizeAgeGroup(r["Age Group"]);
      }) || rows[0];

      if (first) {
        const { base, course } = parseEvent(first.Event);

        if (COURSES.includes(course)) courseSelect.value = course;
        refreshEventsFromMap();

        // set event
        const events = Array.from(eventMap[norm(courseSelect.value)] || []);
        if (events.includes(base)) eventSelect.value = base;

        // set gender
        const g = normalizeGender(first["Competition Category"]);
        if (g === "M" || g === "F") genderSelect.value = g;

        // set age group
        const ag = normalizeAgeGroup(first["Age Group"]);
        const ageGroups = Array.from(ageGroupSet);
        if (ageGroups.includes(ag)) ageGroupSelect.value = ag;
      } else {
        refreshEventsFromMap();
      }

      // Initial render
      runFilter();
    })
    .catch((err) => {
      console.error("❌ Failed to load JSON:", err);
      setStatusRow("Error loading data");
    });
});
