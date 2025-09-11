document.addEventListener('DOMContentLoaded', function () {
  const courseSelect = document.getElementById('course');
  const eventSelect = document.getElementById('event');
  const genderSelect = document.getElementById('gender');
  const ageGroupSelect = document.getElementById('age_group_desc');
  const form = document.getElementById('filter-form');
  const resultsTable = document.getElementById('results-table');

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
        "50 Back": "50 BA",
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
        "400 Free": "400 FR",
        "800 Free": "800 FR",
        "1500 Free": "1500 FR",
        "50 Back": "50 BA",
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
      "11-12": "11-12",
      "13-14": "13-14",
      "15-16": "15-16",
      "17-18": "17-18",
      "15-18": "15-18",
      "Open": "Open"
    }
  };

  // Populate dropdowns
  dropdownOptions.courses.forEach(c => {
    courseSelect.innerHTML += `<option value="${c}">${c}</option>`;
  });
  for (const [k, v] of Object.entries(dropdownOptions.genders)) {
    genderSelect.innerHTML += `<option value="${v}">${k}</option>`;
  }
  for (const [k, v] of Object.entries(dropdownOptions["Age Groups"])) {
    ageGroupSelect.innerHTML += `<option value="${v}">${k}</option>`;
  }

  const refreshEvents = () => {
    const selectedCourse = courseSelect.value;
    const events = dropdownOptions.events[selectedCourse] || {};
    eventSelect.innerHTML = '';
    for (const [label, code] of Object.entries(events)) {
      eventSelect.innerHTML += `<option value="${code}">${label}</option>`;
    }
  };
  courseSelect.addEventListener('change', refreshEvents);
  courseSelect.dispatchEvent(new Event('change'));

  const trimStr = v => (typeof v === 'string' ? v.trim() : v);

  const timeToSeconds = (t) => {
    if (t == null) return Number.POSITIVE_INFINITY;
    const s = String(t).trim();
    if (s.includes(":")) {
      return s.split(":").reduce((acc, part) => acc * 60 + parseFloat(part), 0);
    }
    const num = parseFloat(s);
    return Number.isNaN(num) ? Number.POSITIVE_INFINITY : num;
  };

  // >>> Use the file you just shared <<<
  const jsonFile = "Static/SCSCTop10_with_course.json";

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const payload = {
      course: trimStr(courseSelect.value),          // "SCY" | "LCM"
      event_code: trimStr(eventSelect.value),       // e.g., "50 FR"
      type_code: trimStr(genderSelect.value),       // "M" | "F"
      age_group_desc: trimStr(ageGroupSelect.value) // e.g., "11-12"
    };

    d3.json(jsonFile).then(data => {
      const rows = (data?.Table2?.Detail_Collection || []).map(r => {
        const obj = { ...r };
        // normalize/trim fields used for filtering
        obj.course = trimStr(obj.course);
        obj.Event = trimStr(obj.Event);
        obj["Competition Category"] = trimStr(obj["Competition Category"]);
        obj["Age Group"] = trimStr(obj["Age Group"]);
        obj.Time = trimStr(obj.Time);
        obj["Swim Date"] = trimStr(obj["Swim Date"]);
        return obj;
      });

      // Event can be stored as "50 FR" or "50 FR SCY". Match both.
      const eventWithCourse = `${payload.event_code} ${payload.course}`;
      const filtered = rows
        .filter(d =>
          d.course === payload.course &&
          (d.Event === payload.event_code || d.Event === eventWithCourse) &&
          d["Competition Category"] === payload.type_code &&
          d["Age Group"] === payload.age_group_desc
        )
        .sort((a, b) => timeToSeconds(a.Time) - timeToSeconds(b.Time))
        .slice(0, 10)
        .map((row, index) => ({
          rank: index + 1,
          name: `${row.First} ${row.Last}`,
          swim_time: row.Time,
          date: row["Swim Date"]
        }));

      if (filtered.length === 0) {
        resultsTable.innerHTML = `<tr><td colspan="4">No results found</td></tr>`;
        return;
      }

      resultsTable.innerHTML = filtered.map(r => `
        <tr>
          <td>${r.rank}</td>
          <td>${r.name}</td>
          <td>${r.swim_time}</td>
          <td>${r.date}</td>
        </tr>
      `).join('');

      setTimeout(() => {
        Array.from(resultsTable.children).forEach(tr => tr.classList.add('show'));
      }, 50);
    }).catch(err => {
      console.error("Failed to load JSON:", err);
      resultsTable.innerHTML = `<tr><td colspan="4">Error loading data</td></tr>`;
    });
  });
});
