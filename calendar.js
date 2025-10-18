// Calendar module
let restricted_periods = []; // Loaded in main

function generateCalendar() {
  const container = document.getElementById('calendar-container');
  if (!container) return;
  container.innerHTML = '';
  let current = moment('2025-10-01');
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
      cell.style.cursor = 'pointer';
      const dateStr = current.format('YYYY-MM-DD');
      const dayOfWeek = current.day();
      if (dayOfWeek === 5 || dayOfWeek === 6) cell.classList.add('weekend'); // Fri/Sat blue
      let period = restricted_periods.find(p => moment(dateStr).isBetween(p.start, p.end, null, '[]'));
      if (period) cell.classList.add(period.type); // Special yellow, etc.
      let vacant = rooms.length;
      bookings.forEach(b => {
        if (moment(dateStr).isBetween(b.start, b.end, null, '[]')) vacant -= b.selectedRooms.length;
      });
      cell.innerHTML = `${day}<br><span class="vacant-count">${vacant}</span>`;
      cell.onclick = () => {
        if (document.getElementById('booking-wizard').style.display === 'none') startBooking(); // Open wizard if closed
        const startInput = document.getElementById('start-date');
        const endInput = document.getElementById('end-date');
        if (!startInput.value) startInput.value = dateStr;
        else endInput.value = dateStr;
        updateAvailability();
      };
      current.add(1, 'day');
    }
    container.appendChild(table);
    current.add(1, 'month').startOf('month');
  }
}