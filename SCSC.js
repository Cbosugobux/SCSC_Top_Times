document.addEventListener('DOMContentLoaded', function () {
  const $ = (id) => document.getElementById(id);
  const courseSelect = $('course');
  const eventSelect = $('event');
  const genderSelect = $('gender');
  const ageGroupSelect = $('age_group_desc');
  const form = $('filter-form');
  const resultsTable = $('results-table');

  if (!courseSelect || !eventSelect || !genderSelect || !ageGroupSelect || !form || !resultsTable) {
    console.error('❌ Missing DOM elements. Check element IDs in the HTML.');
    return;
  }

  // ---------------------------
  // Static dropdowns
  // ---------------------------
  const dropdownOptions = {
    courses: ["SCY", "LCM"],
    genders: { "Male": "M", "Female": "F" }
  };

  courseSelect.innerHTML = dropdownOptions.courses.map(c => `<option value="${c}">${c}</option>`).join('');
  genderSelect.innerHTML = Object.entries(dropdownOptions.genders)
    .map(([k,v]) => `<option value="${v}">${k}</option>`).join('');

  // ---------------------------
  // Helpers
  // ---------------------------
  const trimStr = v => (typeof v === 'string' ? v.trim() : v);

  const timeToSeconds = (t) => {
    if (t == null) return Number.POSITIVE_INFINITY;
    const s = String(t).trim();
    if (!s) return Number.POSITIVE_INFINITY;
    if (s.includes(':')) {
      return s.split(':').reduce((acc, p) => acc * 60 + parseFloat(p), 0);
    }
    const num = parseFloat(s);
    return Number.isNaN(num) ? Number.POSITIVE_INFINITY : num;
  };

  // "50 FR SCY" -> { base: "50 FR", course: "SCY" }
  const parseEvent = (evt) => {
    const s = (evt || '').trim();
    const m = s.match(/\b(SCY|LCM)\b$/);
    const course = m ? m[1] : '';
    const base = course ? s.replace(/\s+\b(SCY|LCM)\b$/, '').trim() : s;
    return { base, course };
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
  };

  // ---------------------------
  // Data (NOTE: path and case must match your server)
  // ---------------------------
  const JSON_PATH = 'Static/SCSCTop10_with_course.json';

  const loadJSON = (url) => {
    if (window.d3 && typeof d3.json === 'function') return d3.json(url);
    return fetch(url, { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} while fetching ${url}`);
      return r.json();
    });
  };

  // ---------------------------
  // Build dynamic dropdowns from JSON
  // ---------------------------
  let allRows = [];
  let eventMap = { SCY: new Set(), LCM: new Set() };
  let ageGroups = new Set();

  const refreshEventsFromMap = () => {
    const selectedCourse = courseSelect.value;
    const events = Array.from(eventMap[selectedCourse] || []).sort();
    const prev = eventSelect.value;
    eventSelect.innerHTML = events.map(e => `<option value="${e}">${e}</option>`).join('');
    if (prev && events.includes(prev)) eventSelect.value = prev;
  };

  loadJSON(JSON_PATH).then(data => {
    const rows = (data?.Table2?.Detail_Collection || []).map(r => {
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
      console.error('⚠️ JSON loaded but contains 0 rows at Table2.Detail_Collection.');
      setStatusRow('No data available');
      return;
    }

    allRows = rows;

    // Derive unique events and age groups
    rows.forEach(r => {
      const { base, course } = parseEvent(r.Event);
      if (course && eventMap[course]) eventMap[course].add(base);
      if (r["Age Group"]) ageGroups.add(r["Age Group"]);
    });

    // Populate Age Group dropdown once
    ageGroupSelect.innerHTML = Array.from(ageGroups)
      .sort((a,b) => String(a).localeCompare(String(b)))
      .map(v => `<option value="${v}">${v}</option>`).join('');

    // Populate events based on the default course
    refreshEventsFromMap();

    // Optional: auto-submit once loaded so you see immediate results
    if (eventSelect.value && genderSelect.value && ageGroupSelect.value) {
      form.requestSubmit();
    } else {
      console.warn('⚠️ Some selects are empty after JSON load:', {
        course: courseSelect.value,
        eventCount: eventSelect.options.length,
        gender: genderSelect.value,
        ageGroupCount: ageGroupSelect.options.length
      });
    }
  }).catch(err => {
    console.error('❌ Failed to load JSON:', err);
    setStatusRow('Error loading data');
  });

  // When course changes, rebuild events list from the precomputed map
  courseSelect.addEventListener('change', refreshEventsFromMap);

  // ---------------------------
  // Submit
  // ---------------------------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    setStatusRow('Loading…');

    if (!allRows.length) {
      console.warn('⚠️ Submit clicked before data loaded.');
      setStatusRow('Data not loaded yet');
      return;
    }

    const payload = {
      course: trimStr(courseSelect.value),
      event_code: trimStr(eventSelect.value),
      type_code: trimStr(genderSelect.value),
      age_group_desc: trimStr(ageGroupSelect.value)
    };

    console.log('ℹ️ Filtering with payload:', payload);

    const filtered = allRows
      .filter(d => {
        const { base, course } = parseEvent(d.Event);
        return course === payload.course &&
               base === payload.event_code &&
               d["Competition Category"] === payload.type_code &&
               d["Age Group"] === payload.age_group_desc;
      })
      .sort((a, b) => timeToSeconds(a.Time) - timeToSeconds(b.Time))
      .slice(0, 10)
      .map((row, i) => ({
        rank: i + 1,
        name: `${row.First ?? ''} ${row.Last ?? ''}`.trim(),
        swim_time: row.Time,
        date: row["Swim Date"]
      }));

    if (!filtered.length) {
      console.warn('⚠️ No matches. Here are some quick diagnostics:');
      // Show a couple of available options for current course/event/age/gender
      const sampleForCourse = allRows.filter(r => parseEvent(r.Event).course === payload.course);
      console.warn('course sample count:', sampleForCourse.length);

      const sampleForEvent = sampleForCourse.filter(r => parseEvent(r.Event).base === payload.event_code);
      console.warn('event sample count (within course):', sampleForEvent.length);

      const sampleForGender = sampleForEvent.filter(r => r["Competition Category"] === payload.type_code);
      console.warn('gender sample count (within event):', sampleForGender.length);

      const sampleForAge = sampleForGender.filter(r => r["Age Group"] === payload.age_group_desc);
      console.warn('age-group sample count (final):', sampleForAge.length);

      setStatusRow('No results found');
    } else {
      console.log(`✅ Found ${filtered.length} rows`);
    }

    renderRows(filtered);
  });
});

