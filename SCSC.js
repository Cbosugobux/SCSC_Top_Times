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
                "50 Free": "50 FR SCY",
                "100 Free": "100 FR SCY",
                "200 Free": "200 FR SCY",
                "500 Free": "500 FR SCY",
                "1000 Free": "1000 FR SCY",
                "1650 Free": "1650 FR SCY",
                "50 Back": "50 BA SCY",
                "100 Back": "100 BK SCY",
                "200 Back": "200 BK SCY",
                "50 Breast": "50 BR SCY",
                "100 Breast": "100 BR SCY",
                "200 Breast": "200 BR SCY",
                "50 Fly": "50 FL SCY",
                "100 Fly": "100 FL SCY",
                "200 Fly": "200 FL SCY",
                "100 IM": "100 IM SCY",
                "200 IM": "200 IM SCY",
                "400 IM": "400 IM SCY",
                "200 Free Relay": "200 FR-R SCY",
                "400 Free Relay": "400 FR-R SCY",
                "800 Free Relay": "800 FR-R SCY",
                "200 Medley Relay": "200 MED-R SCY",
                "400 Medley Relay": "400 MED-R SCY"
            },
            LCM: {
                "50 Free": "50 FR LCM",
                "100 Free": "100 FR LCM",
                "200 Free": "200 FR LCM",
                "500 Free": "500 FR LCM",
                "800 Free": "800 FR LCM",
                "1500 Free": "1500 FR LCM",
                "50 Back": "50 BA LCM",
                "100 Back": "100 BK LCM",
                "200 Back": "200 BK LCM",
                "50 Breast": "50 BR LCM",
                "100 Breast": "100 BR LCM",
                "200 Breast": "200 BR LCM",
                "50 Fly": "50 FL LCM",
                "100 Fly": "100 FL LCM",
                "200 Fly": "200 FL LCM",
                "200 IM": "200 IM LCM",
                "400 IM": "400 IM LCM",
                "200 Free Relay": "200 FR-R LCM",
                "400 Free Relay": "400 FR-R LCM",
                "800 Free Relay": "800 FR-R LCM",
                "200 Medley Relay": "200 MED-R LCM",
                "400 Medley Relay": "400 MED-R LCM"
            }
        },
        genders: {
            "Male": "M",
            "Female": "F"
        },
        "Age Groups": {
            "10 & Under": "10 & Under",
            "11-12": "11-12",
            "13-14": "13-14",
            "15-16": "15-16",
            "17-18": "17-18",
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

    courseSelect.addEventListener('change', () => {
        const selectedCourse = courseSelect.value;
        const events = dropdownOptions.events[selectedCourse];
        eventSelect.innerHTML = '';
        for (const [label, code] of Object.entries(events)) {
            eventSelect.innerHTML += `<option value="${code}">${label}</option>`;
        }
    });

    courseSelect.dispatchEvent(new Event('change'));

    // Form submit
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const payload = {
            course: courseSelect.value,
            event_code: eventSelect.value,
            type_code: genderSelect.value,
            age_group_desc: ageGroupSelect.value
        };

        const jsonFile = payload.course === "SCY" ? "Data/SCY_05012025.json" : "Data/LCM_05012025.json";

        d3.json(jsonFile).then(data => {
            const results = data.Table2.Detail_Collection
                .filter(d =>
                    d["Event Code"] === payload.event_code &&
                    d["Type Code"] === payload.type_code &&
                    d["Age Group Desc"] === payload.age_group_desc
                )
                .sort((a, b) => a["Top Time"] - b["Top Time"])
                .slice(0, 10)
                .map(row => ({
                    rank: row["Top Time"],
                    name: `${row["First Name"]} ${row["Last Name"]}`,
                    swim_time: row["Swim Time"],
                    date: row["TextBox59"]
                }));

            if (results.length === 0) {
                resultsTable.innerHTML = `<tr><td colspan="4">No results found</td></tr>`;
                return;
            }

            resultsTable.innerHTML = results.map(r => `
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
        });
    });
});

// All code and intellectual property herein contain belongs to Chris Bushelman
