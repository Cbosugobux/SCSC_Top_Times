document.addEventListener('DOMContentLoaded', function () {
  const $ = (id) => document.getElementById(id);
  const courseSelect = $('course');
  const eventSelect = $('event');
  const genderSelect = $('gender');
  const ageGroupSelect = $('age_group_desc');
  const form = $('filter-form');
  const resultsTable = $('results-table');

  // Sanity check (prevents silent failures)
  if (!courseSelect || !eventSelect || !genderSelect || !ageGroupSelect || !form || !resultsTable) {
    console.error('One or more required elements are missing. Check element IDs.');
    return;
  }

  // ---------------------------
  // Dropdown data (unchanged)
  // ---------------------------
  const dropdownOptions = {
    courses: ["SCY", "LCM"],
    events: {
      SCY: {
        "50 Free": "50 FR",
        "100 Free": "100 FR",
        "200 Free": "200 FR",
        "500 Free": "500 FR",
        "1000 Free": "1000 FR",
        "1650 Free": "1650 FR",
        "50 Back": "50 BK",
        "100 Back": "100 BK",
        "200 Back": "200 BK",
        "50 Breast": "50 BR",
        "100 Breast": "100 BR",
        "200 Breast": "200 BR",
        "50 Fly": "50 FL",
        "100 Fly": "100 FL",
        "200 Fly": "200 FL",
        "100 IM": "100 IM",
        "200 IM": "200 IM",
        "400 IM": "400 IM",
        "200 Free Relay": "200 FR-R",
        "400 Free Relay": "400 FR-R",
        "800 Free Relay": "800 FR-R",
        "200 Medley Relay": "200 MED-R",
        "400 Medley Relay": "400 MED-R"
      },
      LCM: {
        "50 Free": "50 FR",
        "100 Free": "100 FR",
        "200 Free": "200 FR",
        "500 Free": "500 FR", // ok if empty in LCM
        "800 Free": "800 FR",
        "1500 Free": "1500 FR",
        "50 Back": "50 BK",
        "100 Back": "100 BK",
        "200 Back": "200 BK",
        "50 Breast": "50 BR",
        "100 Breast": "100 BR",
        "200 Breast": "200 BR",
        "50 Fly": "50 FL",
        "100 Fly": "100 FL",
        "200 Fly": "200 FL",
        "200 IM": "200 IM",
        "400 IM": "400 IM",
        "200 Free Relay": "200 FR-R",
        "400 Free Relay": "400 FR-R",
        "800 Free Relay": "800 FR-R",
        "200 Medley Relay": "200 MED-R",
        "400 Medley Relay": "400 MED-R"
      }
    },
    genders: { "Male": "M", "Female": "F" },
    "Age Groups": {
      "8 & Under": "8 & Under",
      "9-10": "9-10",
      "10 & Under": "10 & Under",
      "11-12": "11-12",
      "13-14": "13-14",
      "15-16": "15-16",
      "17-18": "17-18",
      "15-18": "15-18",
      "Open": "Open"
    }
  };

  // ---------------------------
  // Populate selects
  // ---------------------------
  courseSelect.innerHTML = dropdownOptions.courses.map(c => `<option value="${c}">${c}</option>`).join('');
  genderSelect.innerHTML = Object.entries(dropdownOptions.genders)
    .map(([k,v]) => `<option value="${v}">${k}</option>`).join('');
  ageGroupSelect.innerHTML = Object.entries(dropdownOptions["Age Groups"])
    .map(([k,v]) => `<option value="${v}">${k}</option>`).join('');

  const refreshEvents = () => {
    const selectedCourse = courseSelect.value;
    const events = dropdownOptions.events[selectedCourse] || {};
    const prev = eventSelect.value;
    eventSelect.innerHTML = Object.entries(events)
      .map(([label, code]) => `<option value="${code}">${label}</option>`).join('');
    if (prev && Object.values(events).includes(prev)) {
      eventSelect.value = prev;
    }
  };
  courseSelect.addEventListener('change', refreshEvents);
  refreshEvents(); // initial

  // ---------------------------
  // Helpers
  // ---------------------------
  const trimStr = v => (typeof v === 'string' ? v.trim() : v);

  const timeToSeconds = (t) => {
    if (t == null) return Number.POSITIVE_INFINITY;
    const s = String(t).trim();
    if (!s) return Number.POSITIVE_INFINITY;
    if (s.includes(':')) {
      // supports m:s, mm:ss.hh, h:mm:ss, etc.
      return s.split(':').reduce((acc, p) => acc * 60 + parseFloat(p), 0);
    }
    const num = parseFloat(s);
    return Number.isNaN(num) ? Number.POSITIVE_INFINITY : num;
  };

  const setStatusRow = (msg) => {
    resultsTable.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#666;padding:12px;">${msg}</td></tr>`;
  };

  const renderRows = (rows) => {
    if (!rows.length) {
      setStatusRow('No results found');
      return;
    }
    resultsTable.innerHTML = rows.map(r => `
      <tr>
        <td data-label="Rank">${r.rank}</td>
        <td data-label="Name">${r.name}</td>
        <td data-label="Swim Time">${r.swim_time}</td>
        <td data-label="Date">${r.date}</td>
      </tr>
    `).join('');
    requestAnimationFrame(() => {
      Array.from(resultsTable.children).forEach(tr => tr.classList.add('show'));
    });
  };

  // ---------------------------
  // Data (NOTE: path case!)
  // ---------------------------
  const JSON_PATH = 'Static/SCSCTop10_with_course.json'; // make sure folder name matches disk exactly

  // Use d3.json (already loaded in your HTML). Fallback to fetch if needed.
  const loadJSON = (url) => {
    if (window.d3 && typeof d3.json === 'function') return d3.json(url);
    return fetch(url, { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
  };

  // ---------------------------
  // Submit
  // ---------------------------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    setStatusRow('Loading…');

    const payload = {
      course: trimStr(courseSelect.value),
      event_code: trimStr(eventSelect.value),
      type_code: trimStr(genderSelect.value),
      age_group_desc: trimStr(ageGroupSelect.value)
    };

    loadJSON(JSON_PATH).then(data => {
      const rows = (data?.Table2?.Detail_Collection || []).map(r => {
        const obj = { ...r };
        obj.course = trimStr(obj.course);
        obj.Event = trimStr(obj.Event);
        obj["Competition Category"] = trimStr(obj["Competition Category"]);
        obj["Age Group"] = trimStr(obj["Age Group"]);
        obj.Time = trimStr(obj.Time);
        obj["Swim Date"] = trimStr(obj["Swim Date"]);
        obj.First = trimStr(obj.First);
        obj.Last = trimStr(obj.Last);
        return obj;
      });

      // Event can be "50 FR" or "50 FR SCY"
      const evtWithCourse = `${payload.event_code} ${payload.course}`;

      const filtered = rows
        .filter(d =>
          d.course === payload.course &&
          (d.Event === payload.event_code || d.Event === evtWithCourse) &&
          d["Competition Category"] === payload.type_code &&
          d["Age Group"] === payload.age_group_desc
        )
        .sort((a, b) => timeToSeconds(a.Time) - timeToSeconds(b.Time))
        .slice(0, 10)
        .map((row, i) => ({
          rank: i + 1,
          name: `${row.First ?? ''} ${row.Last ?? ''}`.trim(),
          swim_time: row.Time,
          date: row["Swim Date"]
        }));

      renderRows(filtered);
    }).catch(err => {
      console.error('Failed to load JSON:', err);
      setStatusRow('Error loading data');
    });
  });

  // Optional: auto-submit on filter change to reduce taps on mobile
  // ;[courseSelect, eventSelect, genderSelect, ageGroupSelect].forEach(el =>
  //   el.addEventListener('change', () => form.requestSubmit(), { passive: true })
  // );
});
