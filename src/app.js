// -------- src/app.js (FULL REPLACEMENT) --------
//
// CSV HEADERS SUPPORTED (case-insensitive):
// Rooms inventory  -> data/uploads/rooms.csv  (or "Room Classification List.csv")
//   Block, Room No, Floor, Min Person, Max Person,
//   Airconditioning, Wheel Chair Access, Pets Permitted, Group Booking Permitted
//
// Optional bookings -> data/uploads/bookings.csv
//   BookingID, CheckIn, CheckOut, Block, Room No, Status
//   - Dates in YYYY-MM-DD
//   - Status: Confirmed (counts as booked), Held (counts as booked), Cancelled (ignored)
//
// With bookings.csv present, the calendar shows per-date available rooms = total - booked.
// Right-panel counts also respect bookings if both Check-in and Check-out are selected.

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

// -------- dates/helpers --------
function iso(d){ return d.toISOString().slice(0,10); }
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function rng(a,b){const out=[];for(let x=new Date(a); x<=b; x.setDate(x.getDate()+1)) out.push(new Date(x)); return out;}
function overlap(aStart,aEnd,bStart,bEnd){ return aStart < bEnd && bStart < aEnd; } // [aStart,aEnd) vs [bStart,bEnd)

// -------------------- app state --------------------
let config = { rules:null, restricted:null, longWeekends:null, tariff:null };
let checkIn = null;   // inclusive
let checkOut = null;  // inclusive end-date selection for UI; range used is [checkIn, nextDay(checkOut))
let selection = {
  roomsSelected: [],
  filters: { wc:false, pet:false, ac:false, group:false, minOcc:1, maxOcc:1, blocksIncluded: new Set() }
};
let inventory = []; // [{block,num,floor,min,max,ac,wc,pet,groupPerm}]
let bookings = [];  // [{id,cin,cout,block,num,status}]
let bookedByDate = {}; // dateISO -> Set('B9','A1',...)

// -------- CSV parsing (robust to comma or tab) --------
function splitSmart(line, header=false){
  // pick delimiter by which yields more columns
  const comma = line.split(','), tab = line.split('\t');
  if (tab.length > comma.length) return tab.map(s=>s.trim());
  return comma.map(s=>s.trim());
}
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(x=>x.trim().length);
  if (!lines.length) return [];
  const header = splitSmart(lines[0], true);
  return lines.slice(1).map(line=>{
    const cells = splitSmart(line);
    const row = {};
    header.forEach((h,i)=> row[h] = (cells[i]??'').trim());
    return row;
  });
}
function toBool(v){
  const s = String(v||'').trim().toLowerCase();
  return ['yes','y','true','1'].includes(s);
}
function pick(obj, keys){
  for (const k of keys){ if (obj[k]!==undefined) return obj[k]; }
  return undefined;
}
function normalizeRooms(rows){
  return rows.map(r=>{
    const room = {
      block: (pick(r, ['Block','BLOCK'])||'').trim(),
      num:   String(pick(r, ['Room No','Room','RoomNo'])||'').trim(),
      floor: (pick(r, ['Floor','FLOOR'])||'').toString().trim(),
      min:   Math.max(1, parseInt(pick(r,['Min Person','Min'])||'1',10)),
      max:   Math.max(1, parseInt(pick(r,['Max Person','Max'])||'4',10)),
      ac:    toBool(pick(r,['Airconditioning','AC'])),
      wc:    toBool(pick(r,['Wheel Chair Access','Wheelchair','WC'])),
      pet:   toBool(pick(r,['Pets Permitted','Pet Friendly','Pets'])),
      groupPerm: toBool(pick(r,['Group Booking Permitted','GroupAllowed','Group']))
    };
    return (room.block && room.num) ? room : null;
  }).filter(Boolean);
}
function normalizeBookings(rows){
  // Expect: BookingID, CheckIn, CheckOut, Block, Room No, Status
  return rows.map(r=>{
    const cin = new Date(String(pick(r,['CheckIn','Check In','From'])||'').trim());
    const cout= new Date(String(pick(r,['CheckOut','Check Out','To'])||'').trim());
    const ok = !isNaN(cin) && !isNaN(cout);
    const b = {
      id: (pick(r,['BookingID','ID'])||'').trim(),
      cin: ok ? startOfDay(cin) : null,
      cout: ok ? startOfDay(cout) : null, // exclusive when computing
      block: (pick(r,['Block'])||'').trim(),
      num: String(pick(r,['Room No','Room','RoomNo'])||'').trim(),
      status: (pick(r,['Status'])||'').trim().toLowerCase()
    };
    return (b.cin && b.cout && b.block && b.num) ? b : null;
  }).filter(Boolean);
}
function buildBookedByDate(bookings){
  const map = {};
  bookings.forEach(b=>{
    if (b.status === 'cancelled') return;
    const key = b.block + (b.num||'');
    // Nights are [cin, cout) ; user selects inclusive dates but nights exclude last day
    for (let d = new Date(b.cin); d < b.cout; d = addDays(d,1)){
      const k = iso(d);
      if (!map[k]) map[k] = new Set();
      map[k].add(key);
    }
  });
  return map;
}

// ------- special/closed sets for coloring (calendar) -------
function buildSpecialSets(restricted){
  const special = new Set(), closed = new Set();
  (restricted.special_periods || []).forEach(p => rng(new Date(p.start), new Date(p.end)).forEach(d => special.add(iso(d))));
  (restricted.closed_periods || []).forEach(p => rng(new Date(p.start), new Date(p.end)).forEach(d => closed.add(iso(d))));
  return {special, closed};
}

/* ===================== CALENDAR (LEFT) ===================== */
function roomsAvailableOn(dateISO){
  const booked = bookedByDate[dateISO] ? bookedByDate[dateISO].size : 0;
  const total = inventory.length;
  return Math.max(0, total - booked);
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
      const dCopy = new Date(d);        // capture per-cell (fixes wrong-date selection)
      const s = iso(dCopy);
      const classes = ['date'];
      const wday = dCopy.getDay();
      if (wday===0 || wday===6) classes.push('weekend');
      if (special.has(s)) classes.push('special');
      if (closed.has(s)) classes.push('closed');
      if (checkIn && !checkOut && iso(checkIn)===s) classes.push('selected');
      if (checkIn && checkOut){
        const rangeStart = checkIn;
        const rangeEndEx = addDays(checkOut,1);
        if (overlap(rangeStart, rangeEndEx, dCopy, addDays(dCopy,1))) classes.push('in-range');
      }

      const avail = roomsAvailableOn(s);
      const countLine = el('div', {style:'line-height:1;margin-top:-2px;font-size:10px;color:#666'}, `${avail}`);
      const cell = el('div', {class:classes.join(' ')}, String(dCopy.getDate()), countLine);
      cell.addEventListener('click', () => onDateClick(dCopy, closed.has(s)));
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
  const day = startOfDay(d);
  if (!checkIn || (checkIn && checkOut)){ checkIn = day; checkOut = null; }
  else if (day > checkIn){ checkOut = day; }
  else { checkIn = day; checkOut = null; }
  renderCalendar(document.getElementById('calendar'), config.restricted);
  updateFiltersDynamic();
  updateRightPanels();
}

/* ===================== RIGHT PANELS ===================== */
function renderFilters(container){
  container.innerHTML = '';
  container.appendChild(el('h3',{class:'panel-title'},'Filters'));

  const ciRow = el('div',{id:'cirow', style:'margin-bottom:10px;font-weight:600'});
  container.appendChild(ciRow);

  const line1 = el('div', {class:'filters-row'},
    labelChk('Wheelchair','f_wc', val => {selection.filters.wc = val; updatePanelsAndBlocks();}),
    labelChk('Pet-friendly','f_pet', val => {selection.filters.pet = val; updatePanelsAndBlocks();}),
    labelChk('AC','f_ac', val => {selection.filters.ac = val; updatePanelsAndBlocks();}),
    labelChk('Group','f_grp', val => {selection.filters.group = val; updatePanelsAndBlocks();})
  );

  // Single occupancy dropdown (1..4)
  const occ = el('select', {id:'occ', style:'margin-left:8px;height:34px;border:1px solid #e5e5e5;border-radius:8px;padding:4px 8px'},
    ...[1,2,3,4].map(n => el('option', {value:String(n)}, String(n)))
  );
  occ.value = '1';
  occ.addEventListener('change', e => {
    const v = Math.max(1, Math.min(4, parseInt(e.target.value,10)));
    selection.filters.minOcc = v;
    selection.filters.maxOcc = v;
    updatePanelsAndBlocks();
  });

  const line2 = el('div', {class:'filters-row', style:'margin-top:10px'},
    el('span', {}, 'Occupancy:'), occ
  );

  container.appendChild(line1);
  container.appendChild(line2);

  const blocksWrap = el('div',{id:'blocksWrap', class:'blocks-grid'}); // two rows, spaced
  container.appendChild(blocksWrap);

  updateFiltersDynamic();
}
function updateFiltersDynamic(){
  const ciRow = document.getElementById('cirow');
  if (ciRow){
    const ci = checkIn ? iso(checkIn) : '—';
    const co = checkOut ? iso(checkOut) : '—';
    ciRow.textContent = `Check-in: ${ci}   |   Check-out: ${co}`;
  }

  const wrap = document.getElementById('blocksWrap');
  if (!wrap) return;

  const roomsNow = filterRoomsRaw(); // attribute + occupancy only
  const counts = blockCounts(roomsNow);

  if (selection.filters.blocksIncluded.size === 0){
    Object.keys(counts).forEach(b => selection.filters.blocksIncluded.add(b));
  }

  wrap.innerHTML = '';
  Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).forEach(([blk,count])=>{
    const active = selection.filters.blocksIncluded.has(blk);
    const pill = el('button', {class:'block-pill' + (active?' active':''), type:'button'},
      `${blk}: ${count} room(s)`
    );
    pill.addEventListener('click', ()=>{
      if (active) selection.filters.blocksIncluded.delete(blk);
      else selection.filters.blocksIncluded.add(blk);
      updatePanelsAndBlocks();
    });
    wrap.appendChild(pill);
  });
}
function labelChk(text, id, onchg){
  const i = el('input',{type:'checkbox',id});
  i.addEventListener('change', e => onchg(e.target.checked));
  return el('label',{for:id,style:'margin-right:16px'}, text+' ', i);
}

// -------- filtering logic --------
function filterRoomsRaw(){
  const f = selection.filters;
  return inventory.filter(r => {
    if (f.wc && !r.wc) return false;
    if (f.pet && !r.pet) return false;
    if (f.ac && !r.ac) return false;
    if (f.group && !r.groupPerm) return false; // now uses "Group Booking Permitted"
    if (r.min > f.maxOcc) return false;
    if (r.max < f.minOcc) return false;
    return true;
  });
}
function isRoomAvailableInSelectedRange(room){
  if (!(checkIn && checkOut)) return true; // no range chosen -> treat as free
  const key = room.block + room.num;
  const start = checkIn;
  const endEx = addDays(checkOut,1);
  for (let d = new Date(start); d < endEx; d = addDays(d,1)){
    const k = iso(d);
    if (bookedByDate[k] && bookedByDate[k].has(key)) return false;
  }
  return true;
}
function filterRoomsApplyBlocksAndDates(){
  const f = selection.filters;
  return filterRoomsRaw()
    .filter(r => f.blocksIncluded.has(r.block))
    .filter(isRoomAvailableInSelectedRange);
}
function blockCounts(rooms){
  const map = {};
  rooms.forEach(r => map[r.block] = (map[r.block]||0)+1);
  return map;
}

function renderRooms(container){
  container.innerHTML = '';
  container.appendChild(el('h3',{class:'panel-title'},'Rooms (from CSV if present)'));

  const rooms = filterRoomsApplyBlocksAndDates();
  const counts = blockCounts(rooms);
  const blocksLine = el('div', {style:'margin-bottom:8px'});
  Object.entries(counts).sort(([a],[b])=>a.localeCompare(b)).forEach(([blk,count])=>{
    blocksLine.appendChild(el('span',{class:'block-pill'}, `${blk}: ${count} room(s)`));
  });
  if (rooms.length===0) blocksLine.appendChild(el('div',{},'No rooms match the selected filters / dates.'));
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
  container.appendChild(el('div', {style:'margin-top:6px'}, 'Rooms CSV: data/uploads/rooms.csv. Optional: data/uploads/bookings.csv.'));
}

function updateRightPanels(){
  renderRooms(document.getElementById('rooms'));
  renderSummary(document.getElementById('summary'));
}
function updatePanelsAndBlocks(){
  updateRightPanels();
  updateFiltersDynamic();
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

  // Load rooms (CSV or the "Room Classification List.csv") - comma or tab separated
  const roomsCSV = await tryFetchText([
    'data/uploads/rooms.csv',
    'data/uploads/Room%20Classification%20List.csv',
    'data/uploads/Room Classification List.csv'
  ]);
  if (roomsCSV){
    const rows = parseCSV(roomsCSV);
    const norm = normalizeRooms(rows);
    inventory = norm.length ? norm : [];
  }
  if (!inventory.length){
    // fallback demo inventory
    inventory = [
      {block:'A', num:'1', ac:false, pet:false, wc:false, min:1, max:2, groupPerm:false},
      {block:'A', num:'3', ac:false, pet:false, wc:false, min:1, max:2, groupPerm:false},
      {block:'B', num:'9', ac:false, pet:false, wc:false, min:1, max:3, groupPerm:false},
      {block:'C', num:'8', ac:true,  pet:true,  wc:false, min:2, max:4, groupPerm:true},
      {block:'C', num:'9', ac:true,  pet:true,  wc:false, min:2, max:4, groupPerm:true},
      {block:'D', num:'2', ac:true,  pet:true,  wc:true,  min:1, max:3, groupPerm:true},
      {block:'E', num:'1', ac:true,  pet:false, wc:false, min:2, max:4, groupPerm:true},
    ];
  }

  // Load optional bookings
  const bookingsCSV = await tryFetchText(['data/uploads/bookings.csv']);
  if (bookingsCSV){
    const rows = parseCSV(bookingsCSV);
    bookings = normalizeBookings(rows);
  }else{
    bookings = [];
  }
  bookedByDate = buildBookedByDate(bookings);

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

