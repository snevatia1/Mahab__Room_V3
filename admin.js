// Admin module
function loginAdmin() {
  if (document.getElementById('admin-pass').value !== 'admin123') return alert('Wrong password');
  document.getElementById('admin-content').style.display = 'block';
  const select = document.getElementById('json-select');
  select.onchange = () => {
    const key = select.value;
    document.getElementById('edit-json').value = JSON.stringify(window[key], null, 2);
  };
  select.onchange();
  const blist = document.getElementById('bookings-list');
  bookings.forEach((b, i) => {
    const li = document.createElement('li');
    li.innerHTML = `${b.memId}: ${b.start} to ${b.end} <button onclick="cancelBooking(${i})">Cancel</button>`;
    blist.appendChild(li);
  });
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
  alert('Saved (refresh to test)');
}

function cancelBooking(index) {
  const b = bookings[index];
  const daysToStart = moment(b.start).diff(moment(), 'days');
  let charge = 0;
  if (daysToStart > 7) charge = rules.cancellation.regular[0].cancel * 100;
  alert(`Cancelled with ₹${charge} charge (simulated)`);
  bookings.splice(index, 1);
  localStorage.setItem('bookings', JSON.stringify(bookings));
  location.reload();
}