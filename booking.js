// Booking module - Wizard, calculations, confirm
async function startBooking() {
  const otp = prompt('Enter OTP (test: 123)');
  if (otp !== '123') return alert('Invalid OTP');
  try {
    await loadData();
    document.getElementById('member-name').textContent = defaultMem.name;
    document.getElementById('booking-wizard').style.display = 'block';
    // Tables from forms PDF
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
  } catch (e) {
    alert('Booking start error: ' + e.message);
  }
}

function updateEndDate() {
  const start = moment(document.getElementById('start-date').value);
  if (start.isValid()) {
    document.getElementById('end-date').value = start.clone().add(1, 'day').format('YYYY-MM-DD');
  }
}

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
    single: form['single'].checked ? true : false,
    min_person: parseInt(form['min-beds'].value),
    max_person: parseInt(form['max-beds'].value),
    group_booking_permitted: form['group'].checked
  };
  let avail = getAvailableRooms(start, end, filters);
  let html = '';
  if (avail.length === 0) {
    html += '<p>No exact match. Alternates:</p>';
    for (let key in filters) {
      if (filters[key]) {
        let relaxed = {...filters, [key]: false};
        let altAvail = getAvailableRooms(start, end, relaxed);
        if (altAvail.length > 0) html += `<p>Without ${key}: ${altAvail.length} rooms</p>`;
      }
    }
  }
  const blocks = {};
  avail.forEach(r => {
    if (!blocks[r.block]) blocks[r.block] = [];
    blocks[r.block].push(r);
  });
  for (let block in blocks) {
    const total = rooms.filter(r => r.block === block).length;
    const free = blocks[block].length;
    html += `<div class="block"><h3>${block} (${free}/${total})</h3>`;
    blocks[block].forEach(r => {
      html += `<div class="room-item"><input type="checkbox" value="${r.room_no}" data-min="${r.min_person}" data-max="${r.max_person}"> ${r.room_no} (Min: ${r.min_person}, Max: ${r.max_person})</div>`;
    });
    html += '</div>';
  }
  if (avail.length < nights * parseInt(form['mem-adults'].value || 1)) html += '<p>Partial availability; club will transfer luggage.</p>';
  document.getElementById('available-rooms').innerHTML = html;
  document.getElementById('calculate-btn').style.display = 'block';
}

function getAvailableRooms(start, end, filters) {
  let availRooms = rooms.filter(r => {
    if (filters.single && (r.min_person !== 1 || r.max_person !== 2)) return false;
    if (filters.min_person && r.min_person < filters.min_person) return false;
    if (filters.max_person && r.max_person > filters.max_person) return false;
    if (filters.group_booking_permitted && !b.group_booking_permitted) return false;
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

function calculateBooking() {
  const form = document.getElementById('booking-form');
  const start = moment(form['start-date'].value);
  const end = moment(form['end-date'].value);
  const nights = end.diff(start, 'days');
  let selectedRooms = Array.from(document.querySelectorAll('#available-rooms input:checked')).map(cb => rooms.find(r => r.room_no === cb.value));
  if (selectedRooms.length === 0) return alert('Select rooms');
  // Open bookings check
  const openBookings = bookings.filter(b => b.memId === defaultMem.id);
  const openCount = openBookings.length;
  if (openCount >= rules.max_live_bookings) return alert('You have ' + openCount + ' open bookings (' + openBookings.map(b => b.start + '-' + b.end).join(', ') + '). Max 2 allowed. Please cancel one.');
  // Occupants
  const members = parseInt(form['members'].value);
  const spouse = parseInt(form['spouse'].value);
  const childUnder10 = parseInt(form['child-under10'].value);
  const childOver10 = parseInt(form['child-over10'].value);
  const senior = parseInt(form['senior'].value);
  const parents = parseInt(form['parents'].value);
  const tempMembers = parseInt(form['temp-members'].value);
  const groupSize = parseInt(form['group-size'].value);
  const totalOccupants = members + spouse + childUnder10 + childOver10 + senior + parents + tempMembers + groupSize;
  // Veg/non-veg
  const veg = parseInt(form['veg'].value);
  const nonveg = parseInt(form['nonveg'].value);
  if (veg + nonveg !== totalOccupants) return alert('Veg + Non-Veg must match total occupants');
  // Calc
  let type = restricted_periods.some(p => p.type === 'special' && start.isBefore(p.end) && end.isAfter(p.start)) ? 'special' : 'regular';
  const totalRooms = selectedRooms.length;
  let total = totalRooms * tariff[type].member.double * nights;
  total += (senior + parents) * tariff[type].senior.extra_adult * nights;
  total += tempMembers * tariff[type].temp.extra_adult * nights;
  total += childOver10 * tariff[type].member.extra_adult * nights;
  total += (childUnder10 + groupSize) * tariff[type].temp.extra_child * nights;
  if (form['ac'].checked) total += totalRooms * (tariff.add_ons.ac_per_night * (1 + tariff.add_ons.gst_on_ac)) * nights;
  const summary = document.getElementById('booking-summary');
  summary.innerHTML = `<p>Dates: ${start.format('YYYY-MM-DD')} to ${end.format('YYYY-MM-DD')} (${nights} nights)</p>
    <p>Total Rooms: ${totalRooms} | Room Nights: ${totalRooms * nights}</p>
    <p>Total Occupants: ${totalOccupants}</p>
    <p>Open Bookings: ${openCount}</p>
    <p>Type: ${type}</p>
    <p>Total: ₹${total.toFixed(2)} (incl. GST)</p>`;
  document.getElementById('confirm-btn').style.display = 'block';
}

function confirmBooking() {
  const form = document.getElementById('booking-form');
  const selectedRooms = Array.from(document.querySelectorAll('#available-rooms input:checked')).map(cb => rooms.find(r => r.room_no === cb.value));
  const booking = {
    memId: defaultMem.id,
    start: form['start-date'].value,
    end: form['end-date'].value,
    selectedRooms
  };
  bookings.push(booking);
  localStorage.setItem('bookings', JSON.stringify(bookings));
  alert('Booking confirmed!');
  document.getElementById('booking-wizard').style.display = 'none';
  generateCalendar();
  updateAvailability();
}