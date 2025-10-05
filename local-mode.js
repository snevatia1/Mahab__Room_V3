/* local-mode.js — Keep members & bookings on THIS computer only. No server. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const byId = (id) => document.getElementById(id);
  const LS_KEY = 'local_bookings_v1';
  const STATE = { member: null, members: [], bookings: [] };

  // ---------- CSV parsing (tiny) ----------
  function parseCsv(text) {
    const rows = text.trim().split(/\r?\n/).filter(Boolean);
    if (!rows.length) return [];
    const heads = rows.shift().split(',').map(h => h.trim().toLowerCase());
    const idx = Object.fromEntries(heads.map((h, i) => [h, i]));
    return rows.map(r => {
      const cols = r.split(',');
      return {
        id: cols[idx.id]?.trim(),
        name: cols[idx.name]?.trim(),
        phone: cols[idx.phone]?.trim(),
        email: cols[idx.email]?.trim()
      };
    }).filter(m => m.id);
  }

  // ---------- Local storage (bookings) ----------
  function loadBookings() {
    try { STATE.bookings = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
    catch { STATE.bookings = []; }
  }
  function saveBookings() {
    localStorage.setItem(LS_KEY, JSON.stringify(STATE.bookings));
  }

  // ---------- UI helpers ----------
  function show(el) { el?.classList?.remove('hidden'); }
  function hide(el) { el?.classList?.add('hidden'); }
  function msg(id, t) { const el = byId(id); if (el) el.textContent = t || ''; }

  // ---------- Members CSV load ----------
  function wireLocalPanel() {
    const openBtn = byId('btnLocal');
    const panel = byId('localPanel');
    const fileMembers = byId('fileMembers');
    const fileImport = byId('fileBookings');
    const btnExport = byId('btnExportBookings');
    const btnClose = byId('btnCloseLocal');

    openBtn?.addEventListener('click', () => show(panel));
    btnClose?.addEventListener('click', () => hide(panel));

    fileMembers?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const txt = await f.text();
      STATE.members = parseCsv(txt);
      msg('localMsg', `Loaded ${STATE.members.length} members. (Stays on this computer)`);
    });

    fileImport?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        const txt = await f.text();
        const arr = JSON.parse(txt);
        if (!Array.isArray(arr)) throw new Error('Bad file');
        STATE.bookings = arr;
        saveBookings();
        msg('localMsg', `Imported ${arr.length} bookings.`);
      } catch (err) {
        msg('localMsg', 'Import failed: ' + err.message);
      }
    });

    btnExport?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(STATE.bookings, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'bookings.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  // ---------- Local Login (no OTP; Member ID + last 4 phone) ----------
  function wireLogin() {
    const btnLogin = byId('btnLogin') || $$('button').find(b => /login/i.test(b.textContent));
    const modal = byId('localLogin');
    const btnClose = byId('btnCloseLogin');
    const btnVerify = byId('btnVerifyLocal');

    btnLogin?.addEventListener('click', () => show(modal));
    btnClose?.addEventListener('click', () => hide(modal));

    btnVerify?.addEventListener('click', () => {
      const id = byId('loginMemberId').value.trim();
      const last4 = byId('loginLast4').value.trim();
      if (!id || !last4) { msg('loginMsg', 'Enter Member ID and last 4 digits.'); return; }
      const m = STATE.members.find(x => x.id === id);
      if (!m) { msg('loginMsg', 'Member not found in loaded CSV.'); return; }
      const ph = (m.phone || '').replace(/\D/g, '');
      if (!ph.endsWith(last4)) { msg('loginMsg', 'Phone last 4 do not match.'); return; }
      STATE.member = m;
      localStorage.setItem('memberId', m.id);
      msg('loginMsg', `Signed in as ${m.name}.`);
      setTimeout(() => hide(modal), 500);
      renderMyBookings();
    });
  }

  // ---------- Policy (for cancellation) ----------
  async function getPolicy() {
    try { return await (await fetch('data/policies.json')).json(); }
    catch { return {}; }
  }

  // ---------- My bookings (drawer) ----------
  function wireBookingsDrawer() {
    const openBtn = byId('btnMyBookings');
    const drawer = byId('myBookings');
    const closeBtn = byId('btnCloseBookings');

    openBtn?.addEventListener('click', () => { renderMyBookings(); show(drawer); });
    closeBtn?.addEventListener('click', () => hide(drawer));
  }

  function renderMyBookings() {
    const drawer = byId('myBookings');
    const list = byId('myBookingsList');
    if (!STATE.member) { list.innerHTML = '<p class="muted">Please login first.</p>'; return; }

    loadBookings();
    const mine = STATE.bookings.filter(b => b.memberId === STATE.member.id)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (!mine.length) { list.innerHTML = '<p class="muted">No bookings yet.</p>'; return; }

    let html = '<table class="table"><tr><th>Dates</th><th>Rooms</th><th>Status</th><th></th></tr>';
    for (const b of mine) {
      html += `<tr>
        <td>${b.ci} → ${b.co}</td>
        <td>${(b.rooms || []).join(', ')}</td>
        <td>${b.status || 'confirmed'}</td>
        <td>
          <button class="button ghost btn-cancel" data-id="${b.id}">Cancel</button>
        </td>
      </tr>`;
    }
    html += '</table>';
    list.innerHTML = html;

    $$('.btn-cancel', list).forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const pol = await getPolicy();
        const daysFree = Number(pol?.cancellation?.free_before_days ?? 7);
        const b = STATE.bookings.find(x => x.id === id);
        if (!b) return;
        const ci = new Date(b.ci + 'T00:00:00');
        const cutoff = new Date(ci.getTime() - daysFree * 86400000);
        if (new Date() > cutoff) {
          alert(`Cancellation not allowed inside ${daysFree} days per policy.`);
          return;
        }
        b.status = 'cancelled';
        b.cancelledAt = new Date().toISOString();
        saveBookings();
        renderMyBookings();
      });
    });

    show(drawer);
  }

  // ---------- Public functions used by app.js ----------
  // Called by your Confirm button code with booking object
  window.persistBooking = function (booking) {
    if (!STATE.member) { alert('Please login first (Local).'); return; }
    loadBookings();
    booking.id = booking.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
    booking.memberId = STATE.member.id;
    booking.createdAt = new Date().toISOString();
    booking.status = booking.status || 'confirmed';
    STATE.bookings.push(booking);
    saveBookings();
    alert('Booking saved on this computer.');
    renderMyBookings();
  };

  // For “Lookup Member” flow if you still need it
  window.lookupMemberLocal = function (memberId) {
    return STATE.members.find(m => m.id === memberId) || null;
  };

  // ---------- Boot ----------
  loadBookings();
  wireLocalPanel();
  wireLogin();
  wireBookingsDrawer();
})();
