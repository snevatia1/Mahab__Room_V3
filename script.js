let rooms = []; // Fallback empty
let tariff = {}; // Fallback
let rules = {}; // Fallback
let restricted_periods = []; // Fallback
let bookings = JSON.parse(localStorage.getItem('bookings') || '[]');
let history = JSON.parse(localStorage.getItem('history') || '[]');
const defaultMem = {id: '123', name: 'John Doe'};

// Load JSONs with fallback
async function loadData() {
  try {
    // Try fetch
    rooms = await fetch('data/config/rooms.json').then(r => { if (!r.ok) throw new Error('Rooms failed'); return r.json(); });
    tariff = await fetch('data/config/tariff.json').then(r => { if (!r.ok) throw new Error('Tariff failed'); return r.json(); });
    rules = await fetch('data/config/rules.json').then(r => { if (!r.ok) throw new Error('Rules failed'); return r.json(); });
    restricted_periods = await fetch('data/config/restricted_periods.json').then(r => { if (!r.ok) throw new Error('Restricted failed'); return r.json(); });
    alert('Data loaded successfully!'); // Debug popup
    console.log('Data loaded');
  } catch (e) {
    console.error('Load error:', e);
    // Fallback data (minimal for testing)
    rooms = [
      {block: 'A', room_no: 'A-1', floor: '1st', min_person: 1, max_person: 2, airconditioning: false, wheel_chair_access: true, pets_permitted: false, group_booking_permitted: true},
      {block: 'B', room_no: 'B-1', floor: 'G', min_person: 2, max_person: 4, airconditioning: false, wheel_chair_access: true, pets_permitted: false, group_booking_permitted: false},
      // Add more from your full rooms.json for better test, but this works
    ];
    tariff = {
      regular: {
        member: {double: 5460, single_double: 4410, single_single: 2730, extra_adult: 2170, extra_child: 1085},
        senior: {double: 4914, single_double: 3969, single_single: 2457, extra_adult: 1953},
        temp: {double: 9930, single_double: 8060, single_single: 4965, extra_adult: 3727, extra_child: 1863.5}
      },
      special: {
        member: {double: 6552, single_double: 5292, single_single: 3276, extra_adult: 2604, extra_child: 1302},
        senior: {double: 5896.8, single_double: 4762.8, single_single: 2948.4, extra_adult: 2343.6},
        temp: {double: 11868.8, single_double: 9648.4, single_single: 5934.4, extra_adult: 4448.8, extra_child: 2224.4}
      },
      add_ons: {bbq_per_person: 210, ac_per_night: 1000, gst_on_ac: 0.18}
    };
    rules = {
      booking_windows: {member: 180, with_temp: 90, unaccompanied_temp: 60},
      max_live_bookings: 2,
      room_limits: {weekday: 6, weekend: 3},
      group: {min_rooms: 10, max_rooms: 19, min_nights: 2, max_nights: 5, deposit: 20000, guest_list_days: 15, block_caps: {c: 10, a: 9}},
      cancellation: {
        regular: [{days: ">7", cancel: 0.1, mod: 0}, {days: "2-7", cancel: 0.2, mod: 1000}, {days: "<2", cancel: "100% first 2 days", mod: "cancel"}],
        special: [{days: ">30", cancel: 0.1, mod: 0}, {days: "7-30", cancel: 0.2, mod: 2000}, {days: "2-7", cancel: 0.5, mod: 3000}, {days: "<2", cancel: 1, mod: "no"}],
        group_complete: [{days: ">7", cancel: 20000, mod: 0}, {days: "2-7", cancel: 0.2, mod: 5000}, {days: "<2", cancel: 0.5, mod: "no"}],
        group_partial: [{days: ">7", cancel: 0.1, mod: 0}, {days: "2-7", cancel: 0.2, mod: 1000}, {days: "<2", cancel: 1, mod: "no"}]
      }
    };
    restricted_periods = [
      {start: "2025-10-17", end: "2025-11-02", type: "special", name: "Diwali"},
      {start: "2025-12-19", end: "2026-01-04", type: "special", name: "Christmas/New Year"},
      {start: "2025-06-30", end: "2025-09-14", type: "closed", name: "Monsoons"},
      {start: "2025-03-14", end: "2025-03-16", type: "long_weekend", name: "Holi"},
      {start: "2025-03-28", end: "2025-03-31", type: "long_weekend", name: "Ramzan Eid"},
      {start: "2025-04-11", end: "2025-04-14", type: "long_weekend", name: "Dr Ambedkar Jayanti"},
      {start: "2025-04-18", end: "2025-04-20", type: "long_weekend", name: "Good Friday"},
      {start: "2025-05-09", end: "2025-05-12", type: "long_weekend", name: "Buddha Purnima"},
      {start: "2026-01-24", end: "2026-01-26", type: "long_weekend", name: "Republic Day"},
      {start: "2026-03-20", end: "2026-03-22", type: "long_weekend", name: "Eid-al-Fitr"},
      {start: "2026-04-03", end: "2026-04-05", type: "long_weekend", name: "Good Friday"},
      {start: "2026-05-01", end: "2026-05-03", type: "long_weekend", name: "Labour Day"},
      {start: "2025-01-11", end: "2025-01-11", type: "event", name: "Barbeque"},
      {start: "2025-01-25", end: "2025-01-25", type: "event", name: "Barbeque"},
      {start: "2025-02-08", end: "2025-02-08", type: "event", name: "Barbeque"},
      {start: "2025-02-22", end: "2025-02-22", type: "event", name: "Barbeque"},
      {start: "2025-03-08", end: "2025-03-08", type: "event", name: "Barbeque"},
      {start: "2025-03-22", end: "2025-03-22", type: "event", name: "Barbeque"},
      {start: "2025-04-12", end: "2025-04-12", type: "event", name: "Barbeque"},
      {start: "2025-04-26", end: "2025-04-26", type: "event", name: "Barbeque"},
      {start: "2025-05-10", end: "2025-05-10", type: "event", name: "Barbeque"},
      {start: "2025-05-24", end: "2025-05-24", type: "event", name: "Barbeque"},
      {start: "2025-06-14", end: "2025-06-14", type: "event", name: "Barbeque"},
      {start: "2025-03-31", end: "2025-03-31", type: "event", name: "Ramzan Eid"},
      {start: "2025-05-23", end: "2025-06-08", type: "event", name: "Summer Season"},
      {start: "2025-06-08", end: "2025-06-08", type: "event", name: "Non-Season Begins"}
    ];
    alert('Using fallback data (check uploads) - Error: ' + e.message);
  }
}

// Generate calendar (runs even on fallback)
function generateCalendar() {
  console.log('Generating calendar...');
  const container = document.getElementById('calendar-container');
  if (!container) { alert('No calendar div!'); return; }
  container.innerHTML = '<p>Loading calendar...</p>'; // Temp
  let current = moment('2025-10-01');
  container.innerHTML = ''; // Clear
  for (let i = 0; i < 6; i++) {
    const month = current.format('MMMM YYYY');
    const table = document.createElement('table');
    table.innerHTML = `<caption>${month}</caption><tr><th>Sun</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th></tr>`;
    const startDay = current.clone().startOf('month').day();
    let row = table.insertRow();
    for (let j = 0; j < startDay; j++) row.insertCell();
    const daysInMonth = current.daysInMonth();
    for (let day = 1; day <= daysInMonth; day++) {
      if (row.cells.length === 7) row = table.insertRow();
      const cell = row.insertCell();
      const dateStr = current.format('YYYY-MM') + '-' + day.toString().padStart(2, '0');
      let period = restricted_periods.find(p => moment(dateStr).isBetween(p.start, p.end, null, '[]'));
      if (period) cell.classList.add(period.type);
      let vacant = rooms.length; // Fallback
      bookings.forEach(b => {
        if (moment(dateStr).isBetween(b.start, b.end, null, '[]')) vacant -= b.selectedRooms ? b.selectedRooms.length : 0;
      });
      cell.innerHTML = `${day}<br><span class="vacant-count">${vacant}</span>`;
    }
    container.appendChild(table);
    current.add(1, 'month');
  }
  console.log('Calendar done');
}

// Update availability
function updateAvailability() {
  if (!rooms.length) return alert('Data not loaded yet');
  const start = document.getElementById('avail-start').value;
  const end = document.getElementById('avail-end').value;
  if (!start || !end) return;
  const results = document.getElementById('avail-results');
  results.innerHTML = '';
  const blocks = [...new Set(rooms.map(r => r.block))];
  blocks.forEach(block => {
    const total = rooms.filter(r => r.block === block).length;
    let free = total;
    bookings.forEach(b => {
      if (moment(b.start).isSameOrBefore(end) && moment(b.end).isSameOrAfter(start)) {
        free -= b.selectedRooms ? b.selectedRooms.filter(r => r.block === block).length : 0;
      }
    });
    results.innerHTML += `<p>${block}: ${free}/${total} free</p>`;
  });
}

// Start booking
async function startBooking() {
  console.log('Start booking clicked');
  const otp = prompt('Enter OTP (test: 123)');
  if (otp !== '123') {
    alert('Invalid OTP');
    return;
  }
  try {
    await loadData();
    document.getElementById('member-name').textContent = defaultMem.name;
    document.getElementById('booking-wizard').style.display = 'block';
    // Add tables
    const createTable = (id, title, maxRows) => {
      const div = document.getElementById(id);
      if (!div) return;
      const table = document.createElement('table');
      table.innerHTML = '<tr><th>Sr No</th><th>Name</th><th>Age</th><th>Meal Pref (V/NV)</th></tr>';
      for (let i = 1; i <= maxRows; i++) {
        const row = table.insertRow();
        row.innerHTML = `<td>${i}</td><td><input type="text"></td><td><input type="number"></td><td><select><option>V</option><option>NV</option></select></td>`;
      }
      div.appendChild(table);
    };
    createTable('member-list', 'Member Details', 5);
    createTable('temp-member-list', 'Temp Member Details', 5);
    alert('Wizard loaded!'); // Debug
    console.log('Wizard shown');
  } catch (e) {
    alert('Booking start error: ' + e.message);
  }
}

// Find available rooms
function findAvailableRooms() {
  const form = document.getElementById('booking-form');
  const start = moment(form['start-date'].value);
  const end = moment(form['end-date'].value);
  const nights = end.diff(start, 'days');
  if (nights < 1) return alert('Invalid dates');
  const filters = {
    wheel_chair_access: form['wheelchair'].checked,
    pets_permitted: form['pets'].checked,
    airconditioning: form['ac'].checked,
    single: form['single'].checked ? true : false
  };
  // Get available rooms
  let avail = getAvailableRooms(start, end, filters);
  let html = '';
  if (avail.length === 0) {
    html += '<p>No exact match. Alternates:</p>';
    // Relax filters
    for (let key in filters) {
      if (filters[key]) {
        let relaxed = {...filters, [key]: false};
        let altAvail = getAvailableRooms(start, end, relaxed);
        if (altAvail.length > 0) html += `<p>Without ${key}: ${altAvail.length} rooms</p>`;
      }
    }
  }
  // Group by block
  const blocks = {};
  avail.forEach(r => {
    if (!blocks[r.block]) blocks[r.block] = [];
    blocks[r.block].push(r);
  });
  for (let block in blocks) {
    html += `<div class="block"><h3>${block} (${blocks[block].length} vacant)</h3>`;
    blocks[block].forEach(r => {
      html += `<div class="room-item"><input type="checkbox" value="${r.room_no}" data-min="${r.min_person}" data-max="${r.max_person}"> ${r.room_no} (Min: ${r.min_person}, Max: ${r.max_person})</div>`;
    });
    html += '</div>';
  }
  // Check partial
  if (avail.length < nights * parseInt(form['mem-adults'].value || 1)) html += '<p>Partial availability; alternate rooms for some dates. Club will shift luggage.</p>';
  document.getElementById('available-rooms').innerHTML = html;
  document.getElementById('calculate-btn').style.display = 'block';
}

function getAvailableRooms(start, end, filters) {
  let availRooms = rooms.filter(r => {
    if (filters.single && (r.min_person !== 1 || r.max_person !== 2)) return false;
    for (let key in filters) if (filters[key] && !r[key]) return false;
    return true;
  });
  bookings.forEach(b => {
    if (moment(b.start).isSameOrBefore(end.format('YYYY-MM-DD')) && moment(b.end).isSameOrAfter(start.format('YYYY-MM-DD'))) {
      b.selectedRooms.forEach(br => availRooms = availRooms.filter(ar => ar.room_no !== br.room_no));
    }
  });
  return availRooms;
}

// Calculate booking
function calculateBooking() {
  const form = document.getElementById('booking-form');
  const start = moment(form['start-date'].value);
  const end = moment(form['end-date'].value);
  const nights = end.diff(start, 'days');
  let selectedRooms = Array.from(document.querySelectorAll('#available-rooms input:checked')).map(cb => rooms.find(r => r.room_no === cb.value));
  if (selectedRooms.length === 0) return alert('Select rooms');
  // Occupants selection with split
  const occDiv = document.getElementById('occupants-selection');
  occDiv.style.display = 'block';
  occDiv.innerHTML = '<h3>Occupants per Room (Member/Temp/Children)</h3>';
  selectedRooms.forEach(r => {
    let html = `<div class="room-occ">${r.room_no} (Max ${r.max_person}): 
      Member Adults: <select class="mem-adult-sel"><option>0</option><option>1</option><option>2</option></select>
      Temp Adults: <select class="temp-adult-sel"><option>0</option><option>1</option><option>2</option></select>
      Children: <select class="child-sel"><option>0</option><option>1</option><option>2</option></select>
    </div>`;
    occDiv.innerHTML += html;
  });
  // Proceed to summary
  let type = restricted_periods.some(p => p.type === 'special' && start.isBefore(p.end) && end.isAfter(p.start)) ? 'special' : 'regular';
  const memAdults = parseInt(form['mem-adults'].value || 0);
  const seniors = parseInt(form['seniors'].value || 0);
  const memChildren10 = parseInt(form['mem-children-10'].value || 0);
  const memChildren1121 = parseInt(form['mem-children-11-21'].value || 0);
  const tempAdults = parseInt(form['temp-adults'].value || 0);
  const tempChildren = parseInt(form['temp-children'].value || 0);
  const totalOccupants = memAdults + seniors + memChildren10 + memChildren1121 + tempAdults + tempChildren;
  const totalRooms = selectedRooms.length;
  let total = 0;
  const baseType = form['single'].checked ? 'single_single' : 'double'; // Simplified
  total += totalRooms * tariff[type].member[baseType] * nights;
  total += seniors * tariff[type].senior.extra_adult * nights;
  total += tempAdults * tariff[type].temp.extra_adult * nights;
  total += (memAdults + memChildren1121 - totalRooms) * tariff[type].member.extra_adult * nights; // Extras
  total += (memChildren10 + tempChildren) * tariff[type].temp.extra_child * nights; // Use temp for children extras if mixed
  if (form['ac'].checked) total += totalRooms * (tariff.add_ons.ac_per_night * (1 + tariff.add_ons.gst_on_ac)) * nights;
  // Validate occupants
  const sumMemAdults = Array.from(occDiv.querySelectorAll('.mem-adult-sel')).reduce((sum, s) => sum + parseInt(s.value), 0);
  const sumTempAdults = Array.from(occDiv.querySelectorAll('.temp-adult-sel')).reduce((sum, s) => sum + parseInt(s.value), 0);
  const sumChildren = Array.from(occDiv.querySelectorAll('.child-sel')).reduce((sum, s) => sum + parseInt(s.value), 0);
  if (sumMemAdults !== memAdults + seniors + memChildren1121 || sumTempAdults !== tempAdults || sumChildren !== memChildren10 + tempChildren) return alert('Per room counts must match total');
  const summary = document.getElementById('booking-summary');
  summary.innerHTML = `<p>Dates: ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')} (${nights} nights)</p>
    <p>Total Rooms: ${totalRooms}</p>
    <p>Total Occupants: ${totalOccupants}</p>
    <p>Type: ${type}</p>
    <p>Total: ₹${total.toFixed(2)} (incl. GST)</p>`;
  document.getElementById('confirm-btn').style.display = 'block';
  speak(`Your booking summary: ${nights} nights, ${totalRooms} rooms, ${totalOccupants} occupants, total ${total} rupees.`);
}

// Confirm booking
function confirmBooking() {
  const form = document.getElementById('booking-form');
  const selectedRooms = Array.from(document.querySelectorAll('#available-rooms input:checked')).map(cb => rooms.find(r => r.room_no === cb.value));
  const booking = {
    memId: defaultMem.id,
    start: form['start-date'].value,
    end: form['end-date'].value,
    selectedRooms
    // Guests etc.
  };
  bookings.push(booking);
  localStorage.setItem('bookings', JSON.stringify(bookings));
  alert('Booking confirmed (simulated)!');
  document.getElementById('booking-wizard').style.display = 'none';
  generateCalendar(); // Update
  updateAvailability();
}

// Voice assistant
function speak(text) {
  if ('speechSynthesis' in window) {
    const utter = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utter);
  }
}

// Admin functions
function loginAdmin() {
  if (document.getElementById('admin-pass').value !== 'admin123') return alert('Wrong password');
  document.getElementById('admin-content').style.display = 'block';
  const select = document.getElementById('json-select');
  select.onchange = () => {
    const key = select.value;
    document.getElementById('edit-json').value = JSON.stringify(window[key], null, 2);
  };
  select.onchange(); // Load first
  // Bookings list
  const blist = document.getElementById('bookings-list');
  bookings.forEach((b, i) => {
    const li = document.createElement('li');
    li.innerHTML = `${b.memId}: ${b.start} to ${b.end} <button onclick="cancelBooking(${i})">Cancel</button>`;
    blist.appendChild(li);
  });
  // History
  const hlist = document.getElementById('history-list');
  history.forEach(h => {
    const li = document.createElement('li');
    li.textContent = `${h.date}: ${JSON.stringify(h.changes)}`;
    hlist.appendChild(li);
  });
}

function saveJson() {
  const select = document.getElementById('json-select');
  const updated = JSON.parse(document.getElementById('edit-json').value);
  window[select.value] = updated;
  history.push({date: new Date().toISOString(), changes: updated});
  localStorage.setItem('history', JSON.stringify(history));
  alert('Saved (in memory; refresh to test)');
}

function cancelBooking(index) {
  // Simulate charges
  const b = bookings[index];
  const daysToStart = moment(b.start).diff(moment(), 'days');
  let charge = 0;
  // Apply rules (simplified)
  if (daysToStart > 7) charge = rules.cancellation.regular[0].cancel * 100; // Percent
  alert(`Cancelled with ₹${charge} charge (simulated)`);
  bookings.splice(index, 1);
  localStorage.setItem('bookings', JSON.stringify(bookings));
  location.reload();
}

// New: Default check-out to check-in +1
document.addEventListener('DOMContentLoaded', () => {
  const startDateInput = document.getElementById('start-date');
  if (startDateInput) {
    startDateInput.addEventListener('change', () => {
      const start = moment(startDateInput.value);
      if (start.isValid()) {
        const endDateInput = document.getElementById('end-date');
        endDateInput.value = start.clone().add(1, 'day').format('YYYY-MM-DD');
      }
    });
  }
});

// Init
window.onload = async () => {
  console.log('Page loaded');
  try {
    await loadData();
    generateCalendar();
    document.getElementById('avail-start').value = moment().format('YYYY-MM-DD');
    document.getElementById('avail-end').value = moment().add(1, 'day').format('YYYY-MM-DD');
    updateAvailability();
    alert('Page ready! Calendar should show.'); // Debug
  } catch (e) {
    console.error('Onload error:', e);
    generateCalendar(); // Run with fallback
    alert('Page ready with fallback data. Error: ' + e.message);
  }
};