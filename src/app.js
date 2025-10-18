// -------- src/app.js (FULL REPLACEMENT) --------

// Tiny DOM helpers
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
async function tryFetchText(paths){
  for (const p of paths){
    try{
      const r = await fetch(p + '?v=' + Date.now());
      if (r.ok) return await r.text();
    }catch(_){}
  }
  return null;
}

function iso(d){ return d.toISOString().slice(0,10); }
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function rng(a,b){const out=[];for(let x=new Date(a); x<=b; x.setDate(x.getDate()+1)) out.push(new Date(x)); return out;}

// -------------------- app state --------------------
let config = { rules:null, restricted:null, longWeekends:null, tariff:null };

// calendar selection
let checkIn = null;
let checkOut = null;

// right-side UI state
let selection = {
  roomsSelected: [],
  filters: { wc:false, pet:false, ac:false, group:false, minOcc:1, maxOcc:6, blocksIncluded: new Set() }
};

// inventory (from CSV if present; fallback to demo)
let inventory = [];

// CSV parser (very tolerant)
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(x=>x.trim().length);
  if (lines.length===0) return [];
  const header = lines[0].split(',').map(s=>s.trim());
  return lines.slice(1).map(line=>{
    // simple split; handles values without embedded commas (sufficient for our schema)
    const cells = line.split(','); 
    const row = {};
    header.forEach((h,i)=> row[h] = (cells[i]??'').trim());
    return row;
  });
}
function toBool(v){
  const s = String(v||'').trim().toLowerCase();
  return ['yes','y','true','1'].includes(s);
}
function normalizeRooms(rows){
  // Expect columns: Block,Room No,Floor,Min Person,Max Person,Airconditioning,Wheel Chair Access,Pets Permitted
  return rows.map(r=>({
    block: (r['Block']||'').trim() || (r['BLOCK']||'').trim(),
    num:   (r['Room No']||r['Room']||r['RoomNo']||'').toString().trim(),
    ac:    toBool(r['Airconditioning']||r['AC']),
    wc:    toBool(r['Wheel Chair Access']||r['Wheelchair']||r['WC']),
    pet:   toBool(r['Pets Permitted']||r['Pet Friendly']||r['Pets']),
    min:   Math.max(1, parseInt(r['Min Person']||r['Min']||'1',10)),
    max:   Math.max(1, parseInt(r['Max Person']||r['Max']||'4',10))
  })).filter(r=>r.block && r.num);
}

// demo inventory if CSV missing
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
function roomsAvailableOn(_dateISO){
  // Placeholder: total inventory count. When bookings wired, subtract booked rooms for that date.
  return inventory.length;
}

function renderCalendar(container, restricted){
  const {special, closed} = buildSpecialSets(restricted);

  const today = startOfDay(new Date());
  const end   = addDays(new Date(today.getFullYear(), today.getMonth()+6, 1), -1);
  container.innerHTML = '';

  const dow = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
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
    for(let i=0;i<monthStart.getDay();i++) grid.appendChild(el('span'));

    for(let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate()+1)){
      const s = iso(d);
      const classes = ['date'];
      const wday = d.getDay();
      if (wday===0 || wday===6) classes.push('weekend');
      if (special.has(s)) classes.push('special');
      if (closed.has(s)) classes.push('closed');

      if (checkIn && !checkOut && iso(checkIn)===s) classes.push('selected');
      if (checkIn && checkOut && (d>=checkIn && d<=checkOut)) classes.push('in-range');

      const avail = roomsAvailableOn(s);
      const countLine = el('div', {style:'line-height:1;margin-top:-2px;font-size:10px;color:#666'}, `${avail}`);
      const cell = el('div', {class:classes.join(' ')}, String(d.getDate()), countLine);
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
  if (isClosed) return;
  if (!checkIn || (checkIn && checkOut)){ checkIn = startOfDay(d); checkOut = null; }
  else if (d > checkIn){ checkOut = startOfDay(d); }
  else { checkIn = startOfDay(d); checkOut = null; }
  renderCalendar(document.getElementById('calendar'), config.restricted);
  updateFiltersDynamic();  // refresh CI/CO display
  updateRightPanels();
}

/* ===================== RIGHT PANELS ===================== */
function renderFilters(container){
  container.innerHTML = '';
  container.appendChild(el('h3',{class:'panel-title'},'Filters'));

  // Check-in/out display (live)
  const ciRow = el('div',{id:'cirow', style:'margin-bottom:8px;font-weight:600'});
  container.appendChild(ciRow);

  // Filters row 1
  const line1 = el('div',{},
    labelChk('Wheelchair','f_wc', val => {selection.filters.wc = val; updateRightPanels();}),
    gap(),
    labelChk('Pet-friendly','f_pet', val => {selection.filters.pet = val; updateRightPanels();}),
    gap(),
    labelChk('AC','f_ac', val => {selection.filters.ac = val; updateRightPanels();}),
    gap(),
    labelChk('Group','f_grp', val => {selection.filters.group = val; updateRightPanels();})
  );

  // Occupancy with "Min" / "Max" labels
  const line2 = el('div',{style:'margin-top:8px;display:flex;align-items:center;gap:6px'},
    el('span',{},'Occupancy:'),
    el('span',{},'Min'), num('min','f_min',1, v => {selection.filters.minOcc = v; updateRightPanels();}),
    el('span',{},'Max'), num('max','f_max',6, v => {selection.filters.maxOcc = v; updateRightPanels();})
  );

  container.appendChild(line1);
  container.appendChild(line2);

  // Block chips (clickable) + counts (live)
  const blocksWrap = el('div',{id:'blocksWrap', style:'margin-top:12px'});
  container.appendChild(blocksWrap);

  updateFiltersDynamic();
}
function updateFiltersDynamic(){
  // CI/CO live text
  const ciRow = document.getElementById('cirow');
  if (ciRow){
    const ci = checkIn ? iso(checkIn) : '—';
    const co = checkOut ? iso(checkOut) : '—';
    ciRow.textContent = `Check-in: ${ci}   |   Check-out: ${co}`;
  }

  // Blocks and counts (live, affected by current attribute/occ filters)
  const wrap = document.getElementById('blocksWrap');
  if (!wrap) return;

  const roomsNow = filterRoomsRaw(); // apply attribute/min/max filters only
  const counts = blockCounts(roomsNow);

  // Initialize blocksIncluded on first run (all blocks ON)
  if (selection.filters.blocksIncluded.size === 0){
    Object.keys(counts).forEach(b => selection.filters.blocksIncluded.add(b));
  }

  wrap.innerHTML = '';
  Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).forEach(([blk,count])=>{
    const active = selection.filters.blocksIncluded.has(blk);
    const pill = el('span', {class:'block-pill', style: active? 'background:#e6f4ff;border-color:#91caff' : ''},
      `${blk}: ${count} room(s)`
    );
    pill.addEventListener('click', ()=>{
      if (active) selection.filters.blocksIncluded.delete(blk);
      else selection.filters.blocksIncluded.add(blk);
      updateRightPanels();          // this will re-count with block filter applied
      updateFiltersDynamic();       // repaint pills with active state
    });
    wrap.appendChild(pill);
  });
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

// Filter logic for right panel
function filterRoomsRaw(){
  const f = selection.filters;
  return inventory.filter(r => {
    if (f.wc && !r.wc) return false;
    if (f.pet && !r.pet) return false;
    if (f.ac && !r.ac) return false;
    if (r.min > f.maxOcc) return false;
    if (r.max < f.minOcc) return false;
    if (f.group && r.max < 3) return false;
    return true;
  });
}
function filterRoomsApplyBlocks(){
  const f = selection.filters;
  return filterRoomsRaw().filter(r => f.blocksIncluded.has(r.block));
}
function blockCounts(rooms){
  const map = {};
  rooms.forEach(r => map[r.block] = (map[r.block]||0)+1);
  return map;
}

function renderRooms(container){
  container.innerHTML = '';
  container.appendChild(el('h3',{class:'panel-title'},'Rooms (demo) – load your CSV to replace'));

  const rooms = filterRoomsApplyBlocks();
  const counts = blockCounts(rooms);
  const blocksLine = el('div', {style:'margin-bottom:8px'});
  Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).forEach(([blk,count])=>{
    blocksLine.appendChild(el('span',{class:'block-pill'}, `${blk}: ${count} room(s)`));
  });
  if (rooms.length===0) blocksLine.appendChild(el('div',{},'No rooms match the selected filters.'));
  container.appendChild(blocksLine);

  const list = el('div');
  rooms.forEach(r => {
    const key = r.block + r.num;
    const chip = el('span', {class:'room-chip' + (selection.roomsSelected.includes(key)?' selected':'')},
      `${r.block}${r.num} (min ${r.min}/max ${r.max})`
    );
    chip.addEventListener('click', () => {
      const i = selection.roomsSelected.indexOf(key);
      if (i>=0) selection.roomsSelected.splice(i,1);
      else selection.roomsSelected.push(key);
      chip.classList.toggle('selected');
      renderSummary(document.getElementById('summary'));
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
  container.appendChild(el('div', {style:'margin-top:6px'}, `Rooms selected: ${selection.roomsSelected.join(', ') || '—'}`));
  container.appendChild(el('div', {style:'margin-top:6px'}, 'Tip: upload data/uploads/rooms.csv to replace demo.'));
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

  // Load rooms from CSV if present (either name works)
  const csvText = await tryFetchText([
    'data/uploads/rooms.csv',
    'data/uploads/Room%20Classification%20List.csv',
    'data/uploads/Room Classification List.csv'
  ]);
  if (csvText){
    const rows = parseCSV(csvText);
    const norm = normalizeRooms(rows);
    inventory = norm.length ? norm : demoRooms.slice();
  }else{
    inventory = demoRooms.slice();
  }

  // Initialize blocksIncluded with ALL blocks from inventory
  selection.filters.blocksIncluded = new Set(inventory.map(r=>r.block));

  renderCalendar(document.getElementById('calendar'), restricted);
  renderFilters(document.getElementById('filters'));
  updateRightPanels();
}

main().catch(err => {
  const s = document.getElementById('summary');
  if (s) s.textContent = 'Error: ' + err.message;
  console.error(err);
});







