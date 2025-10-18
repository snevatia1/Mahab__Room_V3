// Availability module
function updateAvailability() {
  if (!rooms.length) return;
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
    if (free < total) results.innerHTML += `<p class="partial">${block}: ${free}/${total}</p>`;
    else results.innerHTML += `<p>${block}: ${free}/${total}</p>`;
  });
}

// Wizard availability (filters)
function updateAvailabilityWizard() {
  findAvailableRooms();
}