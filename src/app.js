// ------- tiny DOM helpers (kept inline so we only touch ONE file) -------
function el(tag, attrs={}, ...children){
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  });
  children.flat().forEach(c => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return n;
}
function badge(text){ return el('span', {class:'badge'}, text); }

async function loadJSON(path){
  const r = await fetch(path + '?v=' + Date.now());
  if(!r.ok) throw new Error('Failed to load ' + path);
  return r.json();
}

function iso(d){ return d.toISOString().slice(0,10); }
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function rng(a,b){const out=[];for(let x=new Date(a); x<=b; x.setDate(x.getDate()+1)) out.push(new Date(x)); return out;}

// -------------------- app state --------------------
let config = { rules:null, restricted:null, longWeekends:null, tariff:null };

// calendar date range selection (no attributes involved)
let checkIn = null;
let checkOut = null;

// right-side UI state
let selection = {
  rooms: [],
  filters: { wc:false, pet:false, ac:false, group:false, minOcc:1, maxOcc:6 }
};

// demo inventory (calendar shows availability counts from total inventory only)
// later we’ll swap this for rooms.csv + bookings to compute actual per-date availability.
const demoRooms = [
  {block:'A', num:'1', ac:false, pet:false, wc:false, min:1, max:2},
  {block:'A', num:'3', ac:false, pet:false, wc:false, min:1, max:2},
  {block:'B', num:'9', ac:false, pet:false, wc:false, min:1, max:3},
  {block:'C', num:'8', ac:true,  pet:true,  wc:false, min:2, max:4},
  {block:'C', num:'9', ac:true,  pet:true,  wc:false, min:2, max:4},
  {block:'D', num:'2', ac:true,  pet:true,  wc:true,  min:1, max:3},
  {block:'E', num:'1', ac:true,  pet:false, wc:false, min:2, max:4},
];

// ------- special/closed sets for coloring (calendar-only) -------
function buildSpecialSets(restricted){
  const special = new Set(), closed = new Set();
  (restricted.special_periods || []).forEach(p => rng(new Date(p.start), new Date(p.end)).forEach(d => special.add(iso(d))));
  (restricted.closed_periods || []).forEach(p => rng(new Date(p.start), new Date(p.end)).forEach(d => closed.add(iso(d))));
  return {special, closed};
}

/* ===================== CALENDAR (LEFT) ===================== */
/* Calendar responsibility: month layout, colors, and ROOMS AVAILABLE COUNT ONLY */
function roomsAvailableOn(dateISO){
  // For now we show total inventory as available (no bookings data yet).
  // When wiring to CSV+bookings, compute: totalRooms - bookedRooms[dateISO]
  return demoRooms.length;
}

function renderCalendar(container, restricted){
  const {special, closed} = buildSpecialSets(restricted);

  // show from today → +6 months, grouped by month
  const today = startOfDay(new Date());
  const end   = addDays(new Date(today.getFullYear(), today.getMonth()+6, 1), -1);
  container.innerHTML = '';

  const dow = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  let cursor = new Date(today.getFullYear(), today.getMonth(), 1); // 1st of current month
  while (cursor <= end){
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd   = new Date(cursor.getFullYear(), cursor.getMonth()+1, 0);

    const m = el('div', {class:'month'});
    m.appendChild(el('div', {class:'month-title'},
      monthStart.toLocaleString(undefined, {month:'long', year:'numeric'})
    ));
    const head = el('div', {class:'month-grid'});
    dow.forEach(d => head.a

