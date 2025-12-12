document.addEventListener('DOMContentLoaded', function () {
  const $ = (id) => document.getElementById(id);
  // DOM
  const courseSelect = $('course');
  const eventSelect = $('event');
  const genderSelect = $('gender');
  const ageGroupSelect = $('age_group_desc');
  const form = $('filter-form');
  const resultsTable = $('results-table');
  if (!courseSelect || !eventSelect || !genderSelect || !ageGroupSelect || !form || !resultsTable) {
    console.error('❌ Missing DOM elements. Check element IDs.');
    return;
  }
  // Static dropdowns
  const dropdownOptions = {
    courses: ['SCY', 'LCM'],
    genders: { Male: 'M', Female: 'F' },
  };
  courseSelect.innerHTML = dropdownOptions.courses.map(c => `<option value="${c}">${c}</option>`).join('');
  genderSelect.innerHTML = Object.entries(dropdownOptions.genders).map(([k, v]) => `<option value="${v}">${k}</option>`).join('');
  // Helpers
  const trimStr = v => (typeof v === 'string' ? v.trim() : v);
  const timeToSeconds = (t) => {
    if (t == null) return Number.POSITIVE_INFINITY;
    const s = String(t).trim();
    if (!s) return Number.POSITIVE_INFINITY;
    if (s.includes(':')) return s.split(':').reduce((acc, p) => acc * 60 + parseFloat(p), 0);
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
  // Custom sort key for age groups
  const getAgeSortKey = (ag) => {
    if (ag === 'Open') return 100;
    if (ag.includes('& Under')) {
      return parseInt(ag.split(' ')[0], 10);
    }
    if (ag.includes('-')) {
      return parseInt(ag.split('-')[0], 10);
    }
    return 99;
  };
  // Data
  const JSON_PATH = 'Static/SCSCTop10_with_course.json';
  const loadJSON = (url) => {
    if (window.d3 && typeof d3.json === 'function') return d3.json(url);
    return fetch(url, { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} while fetching ${url}`);
      return r.json();
    });
  };
  // State
  let allRows = [];
  const eventMap = { SCY: new Set(), LCM: new Set() };
  const ageGroupSet = new Set();
  // Populate events for selected course
  const refreshEventsFromMap = () => {
    const selectedCourse = courseSelect.value;
    const events = Array.from(eventMap[selectedCourse] || []).sort();
    const prev = eventSelect.value;
    eventSelect.innerHTML = events.map(e => `<option value="${e}">${e}</option>`).join('');
    if (prev && events.includes(prev)) eventSelect.value = prev;
  };
  // Filter + render
  const runFilter = () => {
    const payload = {
      course: trimStr(courseSelect.value),
      event_code: trimStr(eventSelect.value),
      type_code: trimStr(genderSelect.value),
      age_group_desc: trimStr(ageGroupSelect.value),
    };
    const filtered = allRows
      .filter(d => {
        const { base, course } = parseEvent(d.Event);
        return course === payload.course &&
               base === payload.event_code &&
               d['Competition Category'] === payload.type_code &&
               d['Age Group'] === payload.age_group_desc;
      })
      .sort((a, b) => timeToSeconds(a.Time) - timeToSeconds(b.Time))
      .slice(0, 10)
      .map((row, i) => ({
        rank: i + 1,
        name: `${row.First ?? ''} ${row.Last ?? ''}`.trim(),
        swim_time: row.Time,
        date: row['Swim Date'],
      }));
    renderRows(filtered);
  };
  // Load & wire up
  loadJSON(JSON_PATH).then(data => {
    const rows = (data?.Table2?.Detail_Collection || []).map(r => {
      const obj = { ...r };
      obj.Event = trimStr(obj.Event);
      obj['Competition Category'] = trimStr(obj['Competition Category']);
      obj['Age Group'] = trimStr(obj['Age Group']);
      obj.Time = trimStr(obj.Time);
      obj['Swim Date'] = trimStr(obj['Swim Date']);
      obj.First = trimStr(obj.First);
      obj.Last = trimStr(obj.Last);
      return obj;
    });
    if (!rows.length) {
      setStatusRow('No data available');
      return;
    }
    allRows = rows;
    // Build dynamic lists
    rows.forEach(r => {
      const { base, course } = parseEvent(r.Event);
      if (course && eventMap[course]) eventMap[course].add(base);
      if (r['Age Group']) ageGroupSet.add(r['Age Group']);
    });
    // Populate Age Group dropdown
    // If you want to HIDE single ages, add .filter(v => !/^\d+$/.test(v))
    const ageGroups = Array.from(ageGroupSet).sort((a, b) => {
      const keyA = getAgeSortKey(a);
      const keyB = getAgeSortKey(b);
      return keyA - keyB || a.localeCompare(b);
    });
    ageGroupSelect.innerHTML = ageGroups.map(v => `<option value="${v}">${v}</option>`).join('');
    // Populate events for default course
    refreshEventsFromMap();
    // Pick a known-good default combo from the data to avoid an empty first render:
    const first = rows[0];
    if (first) {
      const { base, course } = parseEvent(first.Event);
      if (dropdownOptions.courses.includes(course)) courseSelect.value = course;
      refreshEventsFromMap();
      if (Array.from(eventMap[courseSelect.value] || []).includes(base)) eventSelect.value = base;
      if (first['Competition Category'] === 'M' || first['Competition Category'] === 'F') genderSelect.value = first['Competition Category'];
      if (ageGroups.includes(first['Age Group'])) ageGroupSelect.value = first['Age Group'];
    }
    // Initial render
    runFilter();
  }).catch(err => {
    console.error('❌ Failed to load JSON:', err);
    setStatusRow('Error loading data');
  });
  // Handlers
  courseSelect.addEventListener('change', () => {
    refreshEventsFromMap();
    runFilter();
  });
  eventSelect.addEventListener('change', runFilter);
  genderSelect.addEventListener('change', runFilter);
  ageGroupSelect.addEventListener('change', runFilter);
  // Form submit (still supported for the button)
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    runFilter();
  });
});
