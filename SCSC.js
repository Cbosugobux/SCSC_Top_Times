/* ============================================================
   SCSC Top Times — Cleaned + Hardened JS (swim-correct order)
   - Robust parsing for Event / Gender / Age Group / Time
   - Swim-program event ordering (your exact list)
   - Course-aware distance mapping:
       SCY: 500 / 1000 / 1650
       LCM: 400 / 800 / 1500
   - Relay normalization (FR-R -> Free Relay, MED-R -> Medley Relay)
   - Age group ordering (young -> old, Open last)
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // ---- DOM ----
  const courseSelect   = $("course");
  const eventSelect    = $("event");
  const genderSelect   = $("gender");
  const ageGroupSelect = $("age_group_desc");
  const form           = $("filter-form");
  const resultsTable   = $("results-table"); // <tbody id="results-table">

  if (!courseSelect || !eventSelect || !genderSelect || !ageGroupSelect || !form || !resultsTable) {
    console.error("❌ Missing DOM elements. Check element IDs.");
    return;
  }

  // ---- Static dropdowns ----
  const dropdownOptions = {
    courses: ["SCY", "LCM"],
    genders: { Male: "M", Female: "F" },
  };

  courseSelect.innerHTML = dropdownOptions.courses
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");

  genderSelect.innerHTML = Object.entries(dropdownOptions.genders)
    .map(([k, v]) => `<option value="${v}">${k}</option>`)
    .join("");

  // ============================================================
  // Swim-correct event program order (DISPLAY labels)
  // Values are course-aware (SCY vs LCM) for 400/500, 800/1000, 1500/1650
  // ============================================================
  const EVENT_PROGRAM = [
    // Free
    { label: "50 Free",  scy: "50 Free",  lcm: "50 Free" },
    { label: "100 Free", scy: "100 Free", lcm: "100 Free" },
    { label: "200 Free", scy: "200 Free", lcm: "200 Free" },

    { label: "400/500 Free",   scy: "500 Free",  lcm: "400 Free" },
    { label: "800/1000 Free",  scy: "1000 Free", lcm: "800 Free" },
    { label: "1500/1650 Free", scy: "1650 Free", lcm: "1500 Free" },

    // Back
    { label: "50 Back",  scy: "50 Back",  lcm: "50 Back" },
    { label: "100 Back", scy: "100 Back", lcm: "100 Back" },
    { label: "200 Back", scy: "200 Back", lcm: "200 Back" },

    // Breast
    { label: "50 Breast",  scy: "50 Breast",  lcm: "50 Breast" },
    { label: "100 Breast", scy: "100 Breast", lcm: "100 Breast" },
    { label: "200 Breast", scy: "200 Breast", lcm: "200 Breast" },

    // Fly
    { label: "50 Butterfly",  scy: "50 Butterfly",  lcm: "50 Butterfly" },
    { label: "100 Butterfly", scy: "100 Butterfly", lcm: "100 Butterfly" },
    { label: "200 Butterfly", scy: "200 Butterfly", lcm: "200 Butterfly" },

    // IM
    { label: "100 IM", scy: "100 IM", lcm: "100 IM" },
    { label: "200 IM", scy: "200 IM", lcm: "200 IM" },
    { label: "400 IM", scy: "400 IM", lcm: "400 IM" },

    // Relays
    { label: "100 Free Relay",   scy: "100 Free Relay",   lcm: "100 Free Relay" },
    { label: "200 Free Relay",   scy: "200 Free Relay",   lcm: "200 Free Relay" },
    { label: "400 Free Relay",   scy: "400 Free Relay",   lcm: "400 Free Relay" },
    { label: "800 Free Relay",   scy: "800 Free Relay",   lcm: "800 Free Relay" },
    { label: "200 Medley Relay", scy: "200 Medley Relay", lcm: "200 Medley Relay" },
    { label: "400 Medley Relay", scy: "400 Medley Relay", lcm: "400 Medley Relay" },
  ];

  // ============================================================
  // Helpers
  // ============================================================
  const trimStr = (v) => (typeof v === "string" ? v.trim() : v);

  const timeToSeconds = (t) => {
    if (t == null) return Number.POSITIVE_INFINITY;
    const s = String(t).trim();
    if (!s) return Number.POSITIVE_INFINITY;
    if (s.includes(":")) {
      return s.split(":").reduce((acc, p) => acc * 60 + parseFloat(p), 0);
    }
    const num = parseFloat(s);
    return Number.isNaN(num) ? Number.POSITIVE_INFINITY : num;
  };

  // "50 FR SCY" -> { base: "50 FR", course: "SCY" }
  const parseEvent = (evt) => {
    const s = (evt || "").trim();
    const m = s.match(/\b(SCY|LCM)\b$/);
    const course = m ? m[1] : "";
    const base = course ? s.replace(/\s+\b(SCY|LCM)\b$/, "").trim() : s;
    return { base, course };
  };

  // Convert base event codes from JSON into canonical names
  // Examples:
  //   "50 FR"      -> "50 Free"
  //   "200 FR-R"   -> "200 Free Relay"
  //   "200 MED-R"  -> "200 Medley Relay"
  //   "100 BK"     -> "100 Back"
  //   "100 BR"     -> "100 Breast"
  //   "50 FL"      -> "50 Butterfly"
  //   "200 IM"     -> "200 IM"
  const normalizeBaseEvent = (base) => {
    if (!base) return "";

    let s = String(base).trim().replace(/\s+/g, " ");

    // Relays first: "200 FR-R", "200 MED-R"
    const relay = s.match(/^(\d+)\s+(FR|MED)-R$/i);
    if (relay) {
      const dist = relay[1];
      const type = relay[2].toUpperCase();
      if (type === "FR") return `${dist} Free Relay`;
      if (type === "MED") return `${dist} Medley Relay`;
    }

    // Standard: "50 FR", "100 BK", etc.
    const m = s.match(/^(\d+)\s+(FR|BK|BR|FL|IM)$/i);
    if (!m) return s; // fallback for unexpected strings

    const dist = m[1];
    const code = m[2].toUpperCase();

    const strokeMap = {
      FR: "Free",
      BK: "Back",
      BR: "Breast",
      FL: "Butterfly",
      IM: "IM",
    };

    return `${dist} ${strokeMap[code] || code}`;
  };

  // Age group sort: youngest -> oldest, Open last
  const parseAgeGroupSortKey = (label) => {
    if (!label) return 9999;
    const s = String(label).trim().toLowerCase();
    if (s === "open") return 9999;

    const nums = String(label).match(/\d+/g);
    if (!nums) return 9998;
    return Math.min(...nums.map(Number));
  };

  const setStatusRow = (msg) => {
    resultsTable.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center;color:#666;padding:12px;">
          ${msg}
        </td>
      </tr>
    `;
  };

  const renderRows = (rows) => {
    if (!rows.length) {
      setStatusRow("No results found");
      return;
    }

    resultsTable.innerHTML = rows
      .map(
        (r) => `
        <tr>
          <td data-label="Rank">${r.rank}</td>
          <td data-label="Name">${r.name}</td>
          <td data-label="Swim Time">${r.swim_time}</td>
          <td data-label="Date">${r.date}</td>
        </tr>
      `
      )
      .join("");

    // optional row animation (.show in your CSS)
    requestAnimationFrame(() => {
      resultsTable.querySelectorAll("tr").forEach((tr) => tr.classList.add("show"));
    });
  };

  // ============================================================
  // Data loading
  // ============================================================
  const JSON_PATH = "Static/SCSCTop10_with_course.json";

  const loadJSON = (url) => {
    if (window.d3 && typeof d3.json === "function") return d3.json(url);
    return fetch(url, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status} while fetching ${url}`);
      return r.json();
    });
  };

  // ============================================================
  // State
  // ============================================================
  let allRows = [];

  // canonical normalized event names present per course (e.g. "500 Free", "200 Free Relay")
  const eventMap = { SCY: new Set(), LCM: new Set() };
  const ageGroupSet = new Set();

  // ============================================================
  // Build Event dropdown (program order + course-aware mapping)
  // - option text:  slot.label (e.g. "400/500 Free")
  // - option value: slot.scy or slot.lcm (e.g. "500 Free" for SCY, "400 Free" for LCM)
  // ============================================================
  const refreshEventsFromMap = () => {
    const selectedCourse = courseSelect.value; // "SCY" | "LCM"
    const available = eventMap[selectedCourse] || new Set();

    const prevValue = eventSelect.value;

    const options = [];

    EVENT_PROGRAM.forEach((slot) => {
      const desiredKey = selectedCourse === "SCY" ? slot.scy : slot.lcm;
      if (available.has(desiredKey)) {
        options.push({ label: slot.label, value: desiredKey });
      }
    });

    // Extras not in program list (keeps you from "losing" unexpected events)
    const programKeys = new Set(EVENT_PROGRAM.flatMap((s) => [s.scy, s.lcm]));
    const extras = Array.from(available)
      .filter((k) => !programKeys.has(k))
      .sort((a, b) => a.localeCompare(b))
      .map((k) => ({ label: k, value: k }));

    const finalOptions = options.concat(extras);

    eventSelect.innerHTML = finalOptions
      .map((o) => `<option value="${o.value}">${o.label}</option>`)
      .join("");

    if (prevValue && finalOptions.some((o) => o.value === prevValue)) {
      eventSelect.value = prevValue;
    }
  };

  // ============================================================
  // Filter + render
  // ============================================================
  const runFilter = () => {
    const payload = {
      course: trimStr(courseSelect.value),
      event_key: trimStr(eventSelect.value), // REAL underlying key (e.g. "500 Free")
      type_code: trimStr(genderSelect.value),
      age_group_desc: trimStr(ageGroupSelect.value),
    };

    const filtered = allRows
      .filter((d) => {
        const { base, course } = parseEvent(d.Event);
        const canonical = normalizeBaseEvent(base);

        return (
          course === payload.course &&
          canonical === payload.event_key &&
          d["Competition Category"] === payload.type_code &&
          d["Age Group"] === payload.age_group_desc
        );
      })
      .sort((a, b) => timeToSeconds(a.Time) - timeToSeconds(b.Time))
      .slice(0, 10)
      .map((row, i) => ({
        rank: i + 1,
        name: `${row.First ?? ""} ${row.Last ?? ""}`.trim(),
        swim_time: row.Time,
        date: row["Swim Date"],
      }));

    renderRows(filtered);
  };

  // ============================================================
  // Load & wire up
  // ============================================================
  loadJSON(JSON_PATH)
    .then((data) => {
      const rows = (data?.Table2?.Detail_Collection || []).map((r) => {
        const obj = { ...r };
        obj.Event = trimStr(obj.Event);
        obj["Competition Category"] = trimStr(obj["Competition Category"]);
        obj["Age Group"] = trimStr(obj["Age Group"]);
        obj.Time = trimStr(obj.Time);
        obj["Swim Date"] = trimStr(obj["Swim Date"]);
        obj.First = trimStr(obj.First);
        obj.Last = trimStr(obj.Last);
        return obj;
      });

      if (!rows.length) {
        setStatusRow("No data available");
        return;
      }

      allRows = rows;

      // Build dynamic lists
      rows.forEach((r) => {
        const { base, course } = parseEvent(r.Event);
        const canonical = normalizeBaseEvent(base);

        if (course && eventMap[course] && canonical) eventMap[course].add(canonical);
        if (r["Age Group"]) ageGroupSet.add(r["Age Group"]);
      });

      // Populate Age Group dropdown (young -> old, Open last)
      const ageGroups = Array.from(ageGroupSet).sort((a, b) => {
        const ka = parseAgeGroupSortKey(a);
        const kb = parseAgeGroupSortKey(b);
        if (ka !== kb) return ka - kb;
        return String(a).localeCompare(String(b));
      });

      ageGroupSelect.innerHTML = ageGroups.map((v) => `<option value="${v}">${v}</option>`).join("");

      // Populate events for default course
      refreshEventsFromMap();

      // Default selections (safe)
      const first = rows[0];
      if (first) {
        const { base, course } = parseEvent(first.Event);
        const canonical = normalizeBaseEvent(base);

        if (dropdownOptions.courses.includes(course)) courseSelect.value = course;

        refreshEventsFromMap();

        if (eventMap[courseSelect.value] && eventMap[courseSelect.value].has(canonical)) {
          eventSelect.value = canonical;
        }

        if (first["Competition Category"] === "M" || first["Competition Category"] === "F") {
          genderSelect.value = first["Competition Category"];
        }

        if (ageGroups.includes(first["Age Group"])) {
          ageGroupSelect.value = first["Age Group"];
        }
      }

      // Initial render
      runFilter();
    })
    .catch((err) => {
      console.error("❌ Failed to load JSON:", err);
      setStatusRow("Error loading data");
    });

  // ---- Handlers ----
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
});
