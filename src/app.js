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
    dow.forEach(d => head.appendChild(el('div', {class:'weekday-head'}, d)));
    m.appendChild(head);

    const grid = el('div', {class:'month-grid'});
    // pad before 1st day
    for(let i=0;i<monthStart.getDay();i++) grid.appendChild(el('span'));

    for(let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate()+1)){
      const s = iso(d);
      const classes = ['date'];
      const wday = d.getDay();
      if (wday===0 || wday===6) classes.push('weekend');
      if (special.has(s)) classes.push('special');
      if (closed.has(s)) classes.push('closed');

      // selection styling
      if (checkIn && !checkOut && iso(checkIn)===s) classes.push('selected');
      if (checkIn && checkOut && (d>=checkIn && d<=checkOut)) classes.push('in-range');

      const avail = roomsAvailableOn(s);
      const cell = el('div', {class:classes.join(' ')},
        String(d.getDate()),
        el('div', {
          // small count line (inline style to avoid editing CSS file)
          style:'line-height:1;margin-top:-2px;font-size:10px;color:#666'
        }, `${avail}`)
      );
      cell.addEventListener('click', () => onDateClick(new Date(d), closed.has(s)));
      grid.appendChild(cell);
    }
    m.appendChild(grid);
    container.appendChild(m);

    cursor = new Date(cursor.getFullYear(), cursor.getMonth()+1, 1);
  }

  const legend = el('div', {class:'legend'},
    badge('Weekend'), badge('Special'), badge('Closed'), badge('Selected/Range')
  );
  container.appendChild(legend);
}

function onDateClick(d, isClosed){
  if (isClosed) return; // cannot select closed dates
  if (!checkIn || (checkIn && checkOut)){ checkIn = startOfDay(d); checkOut = null; }
  else if (d > checkIn){ checkOut = startOfDay(d); }
  else { checkIn = startOfDay(d); checkOut = null; }

  renderCalendar(document.getElementById('calendar'), config.restricted);
  updateRightPanels();
}

/* ===================== RIGHT PANELS ===================== */
function renderFilters(container){
  container.innerHTML = '';
  container.appendChild(el('h3',{class:'panel-title'},'Filters'));

  const line1 = el('div',{},
    labelChk('Wheelchair','f_wc', val => {selection.filters.wc = val; updateRightPanels();}),
    gap(),
    labelChk('Pet-friendly','f_pet', val => {selection.filters.pet = val; updateRightPanels();}),
    gap(),
    labelChk('AC','f_ac', val => {selection.filters.ac = val; updateRightPanels();}),
    gap(),
    labelChk('Group','f_grp', val => {selection.filters.group = val; updateRightPanels();})
  );

  const line2 = el('div',{style:'margin-top:8px'},
    el('span',{},'Occupancy: '),
    num('min', 'f_min', 1, v => {selection.filters.minOcc = v; updateRightPanels();}),
    el('span', {style:'margin:0 6px'}, 'to'),
    num('max', 'f_max', 6, v => {selection.filters.maxOcc = v; updateRightPanels();})
  );

  container.appendChild(line1);
  container.appendChild(line2);
}
function labelChk(text, id, onchg){
  const i = el('input',{type:'checkbox',id});
  i.addEventListener('change', e => onchg(e.target.checked));
  return el('label',{for:id,style:'margin-right:12px'}, text+' ', i);
}
function num(ph,id,def,onchg){
  const i = el('input',{type:'number',id,placeholder:ph,min:'1',value:String(def),style:'width:80px;margin-left:6px'});
  i.addEventListener('input', e => onchg(Math.max(1, parseInt(e.target.value||'1',10))));
  return i;
}
function gap(){ return el('span',{style:'display:inline-block;width:12px'}); }

// filtering for RIGHT-PANEL ONLY (calendar does NOT use these)
function filterRooms(){
  const f = selection.filters;
  return demoRooms.filter(r => {
    if (f.wc && !r.wc) return false;
    if (f.pet && !r.pet) return false;
    if (f.ac && !r.ac) return false;
    if (r.min > f.maxOcc) return false;
    if (r.max < f.minOcc) return false;
    if (f.group && r.max < 3) return false; // simple demo rule
    return true;
  });
}
function blockCounts(rooms){
  const map = {};
  rooms.forEach(r => map[r.block] = (map[r.block]||0)+1);
  return map;
}

function renderRooms(container){
  container.innerHTML = '';
  container.appendChild(el('h3',{class:'panel-title'},'Rooms (demo) – load your CSV to replace'));

  const rooms = filterRooms(); // RIGHT ONLY
  const counts = blockCounts(rooms);
  const blocksLine = el('div', {style:'margin-bottom:8px'});
  Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).forEach(([blk,count])=>{
    blocksLine.appendChild(el('span',{class:'block-pill'}, `${blk}: ${count} room(s)`));
  });
  if (rooms.length===0) blocksLine.appendChild(el('div',{},'No rooms match the selected filters.'));
  container.appendChild(blocksLine);

  // Selectable room chips
  const list = el('div');
  rooms.forEach(r => {
    const key = r.block + r.num;
    const chip = el('span', {class:'room-chip' + (selection.rooms.includes(key)?' selected':'')},
      `${r.block}${r.num} (min ${r.min}/max ${r.max})`
    );
    chip.addEventListener('click', () => {
      const i = selection.rooms.indexOf(key);
      if (i>=0) selection.rooms.splice(i,1);
      else selection.rooms.push(key);
      chip.classList.toggle('selected');
      updateRightPanels();
    });
    list.appendChild(chip);
  });
  container.appendChild(list);
}

function renderSummary(container){
  container.innerHTML = '';
  container.appendChild(el('h3',{class:'panel-title'},'Summary'));

  const ci = checkIn ? iso(checkIn) : '—';
  const co = checkOut ? iso(checkOut) : '—';
  container.appendChild(el('div', {}, `Check-in: ${ci}`));
  container.appendChild(el('div', {}, `Check-out: ${co}`));

  let nights = 0;
  if (checkIn && checkOut && checkOut > checkIn) {
    nights = Math.max(0, Math.round((checkOut - checkIn)/(1000*60*60*24)));
  }
  container.appendChild(el('div', {}, `Nights: ${nights}`));
  container.appendChild(el('div', {style:'margin-top:6px'}, `Rooms selected: ${selection.rooms.join(', ') || '—'}`));
  container.appendChild(el('div', {style:'margin-top:6px'}, 'Tip: replace demo with your data/uploads/*.csv to activate real pricing.'));
}

function updateRightPanels(){
  renderRooms(document.getElementById('rooms'));
  renderSummary(document.getElementById('summary'));
}

/* ===================== Boot ===================== */
async function main(){
  const [rules, restricted, lweek, tariff] = await Promise.all([
    loadJSON('data/config/rules.json'),
    loadJSON('data/config/restricted_periods.json'),
    loadJSON('data/config/long_weekends.json'),
    loadJSON('data/config/tariff.json')
  ]);
  config = {rules, restricted, longWeekends:lweek, tariff};

  renderCalendar(document.getElementById('calendar'), restricted);  // calendar shows ONLY date layout + availability count
  renderFilters(document.getElementById('filters'));                // filters affect ONLY the right panels
  updateRightPanels();
}

main().catch(err => {
  const s = document.getElementById('summary');
  if (s) s.textContent = 'Error: ' + err.message;
  console.error(err);
});






