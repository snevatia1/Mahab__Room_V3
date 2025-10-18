// ===== src/app.js (FULL REPLACEMENT) =====

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

// -------- dates/helpers --------
function iso(d){ return d.toISOString().slice(0,10); }
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function rng(a,b){const out=[];for(let x=new Date(a); x<=b; x.setDate(x.getDate()+1)) out.push(new Date(x)); return out;}
function overlap(aStart,aEnd,bStart,bEnd){ return aStart < bEnd && bStart < aEnd; } // [aStart,aEnd) vs [bStart,bEnd)

// -------------------- app state --------------------
let config = { rules:null, restricted:null, longWeekends:null, tariff:null };

// calendar selection (inclusive for display)
let checkIn = null;
let checkOut = null;

// filters + selections
let selection = {
  // key -> occupants (>=1 means "selected")
  roomsSelected: new Map(),
  filters: { wc:false, pet:false, ac:false, group:false, occ:1, blocksIncluded: new Set(), blockOpen: null },
  food: { veg:0, nonveg:0 }
};

let inventory = []; // [{block,num,floor,min,max,ac,wc,pet,groupPerm}]
let bookings = [];  // [{id,cin,cout,block,num,status}]
let bookedByDate = {}; // dateISO -> Set('B9','A1',...)

// -------- CSV parsing (comma or tab) --------
function splitSmart(line){
  const comma = line.split(','), tab = line.split('\t');
  return (tab.length > comma.length ? tab : comma).map(s=>s.trim());
}
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(x=>x.trim().length);
  if (!lines.length) return [];
  const header = splitSmart(lines[0]);
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
function pick(obj, keys){ for (const k of keys){ if (obj[k]!==undefined) return obj[k]; } }
function normalizeRooms(rows){
  // FINAL HEADERS (case-insensitive):
  // Block, Room No, Floor, Min Person, Max Person, Airconditioning, Wheel Chair Access, Pets Permitted, Group Booking Permitted
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
  // Optional bookings.csv: BookingID, CheckIn, CheckOut, Block, Room No, Status
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
    for (let d = new Date(b.cin); d < b.cout; d = addDays(d,1)){
      const k = iso(d);
      if (!map[k]) map[k] = new Set();
      map[k].add(key);
    }
  });
  return map;
}

// ------- special/closed sets -------
function buildSpecialSets(restricted){
  const special = new Set(), closed = new Set();
  (restricted.special_periods || []).forEach(p => rng(new Date(p.start), new Date(p.end)).forEach(d => special.add(iso(d))));
  (restricted.closed_periods || []).forEach(p => rng(new Date(p.start), new Date(p.end)).forEach(d => closed.add(iso(d))));
  return {special, closed};
}

/* ===================== CALENDAR (LEFT) ===================== */
function roomsAvailableOn(dateISO){
  const booked = bookedByDate[dateISO] ? bookedByDate[dateISO].size : 0;
  return Math.max(0, inventory.length - booked);
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
      const dCopy = new Date(d); // capture per-cell
      const s = iso(dCopy);
      const classes = ['date'];
      const wday = dCopy.getDay();
      if (wday===0 || wday===6) classes.push('weekend');
      if (special.has(s)) classes.push('special');
      if (closed.has(s)) classes.push('closed');

      // show selection inclusive (exactly what user clicked)
      if (checkIn && !checkOut && iso(checkIn)===s) classes.push('selected');
      if (checkIn && checkOut){
        if (dCopy >= checkIn && dCopy <= checkOut) classes.push('in-range');
      }

      const avail = roomsAvailableOn(s);
      const cell = el('div', {class:classes.join(' ')},
        String(dCopy.getDate()),
        el('div', {style:'line-height:1;margin-top:-2px;font-size:10px;color:#666'}, `${avail}`)
      );
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

/* ===================== RIGHT SIDE ===================== */
function renderFilters(container){
  container.innerHTML = '';
  container.appendChild(el('h3',{class:'panel-title'},'Filters'));

  // Check-in/out + Summary (moved UP)
  const ciRow = el('div',{id:'cirow', class:'double-space strong'});
  container.appendChild(ciRow);
  const summaryTop = el('div',{id:'summaryTop', class:'summary-box'});
  container.appendChild(summaryTop);

  // Checkboxes
  const line1 = el('div', {class:'filters-row double-space'},
    labelChk('Wheelchair','f_wc', val => {selection.filters.wc = val; refreshAfterFilter();}),
    labelChk('Pet-friendly','f_pet', val => {selection.filters.pet = val; refreshAfterFilter();}),
    labelChk('AC','f_ac', val => {selection.filters.ac = val; refreshAfterFilter();}),
    labelChk('Group','f_grp', val => {selection.filters.group = val; refreshAfterFilter();})
  );

  // Single occupancy dropdown (1..4)
  const occ = el('select', {id:'occ', class:'select'},
    ...[1,2,3,4].map(n => el('option', {value:String(n)}, String(n)))
  );
  occ.value = '1';
  occ.addEventListener('change', e => {
    const v = Math.max(1, Math.min(4, parseInt(e.target.value,10)));
    selection.filters.occ = v;
    refreshAfterFilter();
  });

  const line2 = el('div', {class:'filters-row double-space'},
    el('span', {}, 'Occupancy:'), occ
  );

  container.appendChild(line1);
  container.appendChild(line2);

  // Block pills (always show ALL blocks, clickable to toggle + show room numbers)
  const blocksWrap = el('div',{id:'blocksWrap', class:'blocks-grid double-space'});
  const blockRooms = el('div',{id:'blockRooms', class:'block-rooms'});
  container.appendChild(blocksWrap);
  container.appendChild(blockRooms);

  updateFiltersDynamic();
}

// small helpers
function labelChk(text, id, onchg){
  const i = el('input',{type:'checkbox',id});
  i.addEventListener('change', e => onchg(e.target.checked));
  return el('label',{for:id,style:'margin-right:16px'}, text+' ', i);
}

// filtering logic
function filterRoomsRaw(){
  const f = selection.filters;
  return inventory.filter(r => {
    if (f.wc && !r.wc) return false;
    if (f.pet && !r.pet) return false;
    if (f.ac && !r.ac) return false;
    if (f.group && !r.groupPerm) return false;
    if (f.occ < r.min || f.occ > r.max) return false;
    // availability in selected range (if both chosen)
    if (checkIn && checkOut && !isRoomAvailableInSelectedRange(r)) return false;
    return true;
  });
}
function isRoomAvailableInSelectedRange(room){
  if (!(checkIn && checkOut)) return true;
  const key = room.block + room.num;
  for (let d = new Date(checkIn); d <= checkOut; d = addDays(d,1)){
    const k = iso(d);
    if (bookedByDate[k] && bookedByDate[k].has(key)) return false;
  }
  return true;
}
function roomsByBlock(rooms){
  const map = {};
  rooms.forEach(r => {
    (map[r.block] ||= []).push(r);
  });
  return map;
}
function blockCountsAllBlocks(){
  // counts respecting current filters (attr+occ+dates) but listing ALL blocks
  const rooms = filterRoomsRaw();
  const byB = roomsByBlock(rooms);
  const allBlocks = Array.from(new Set(inventory.map(r=>r.block))).sort();
  const out = {};
  allBlocks.forEach(b => out[b] = (byB[b]||[]).length);
  return {counts: out, byBlock: byB};
}

function updateFiltersDynamic(){
  // Check-in/out line
  const ciRow = document.getElementById('cirow');
  if (ciRow){
    const ci = checkIn ? iso(checkIn) : '—';
    const co = checkOut ? iso(checkOut) : '—';
    ciRow.textContent = `Check-in: ${ci}   |   Check-out: ${co}`;
  }

  // Summary (quick)
  renderSummaryTop();

  // Blocks
  const wrap = document.getElementById('blocksWrap');
  const roomsBox = document.getElementById('blockRooms');
  if (!wrap || !roomsBox) return;

  const {counts, byBlock} = blockCountsAllBlocks();
  if (selection.filters.blocksIncluded.size === 0){
    Object.keys(counts).forEach(b => selection.filters.blocksIncluded.add(b));
  }

  wrap.innerHTML = '';
  Object.keys(counts).sort().forEach(blk=>{
    const count = counts[blk];
    const active = selection.filters.blocksIncluded.has(blk);
    const pill = el('button', {class:'block-pill' + (active?' active':''), type:'button'},
      `${blk}: ${count} room(s)`
    );
    pill.addEventListener('click', ()=>{
      // toggle include/exclude
      if (active) selection.filters.blocksIncluded.delete(blk);
      else selection.filters.blocksIncluded.add(blk);
      // also open this block to show room numbers
      selection.filters.blockOpen = blk;
      refreshAfterFilter();
    });
    wrap.appendChild(pill);
  });

  // Show room numbers for the currently "open" block
  roomsBox.innerHTML = '';
  const open = selection.filters.blockOpen || Object.keys(counts).sort()[0];
  if (open){
    const list = byBlock[open] || [];
    roomsBox.appendChild(el('div',{class:'block-rooms-title'}, `Rooms available in ${open}:`));
    if (!list.length){
      roomsBox.appendChild(el('div',{}, 'None'));
    } else {
      const ul = el('div',{class:'room-list'});
      list.sort((a,b)=>a.num.localeCompare(b.num)).forEach(r=>{
        const key = r.block + r.num;
        const selected = selection.roomsSelected.has(key);
        // occupants dropdown per room (min..max)
        const occSel = el('select',{class:'select small'},
          ...Array.from({length: r.max - r.min + 1}, (_,i)=> r.min + i)
                 .map(n => el('option', {value:String(n)}, String(n)))
        );
        occSel.value = String(selected ? selection.roomsSelected.get(key) : r.min);
        occSel.addEventListener('change', e=>{
          const val = parseInt(e.target.value,10);
          if (val>0) selection.roomsSelected.set(key, val);
          renderSummaryTop(); // update totals
        });

        const item = el('div',{class:'room-row'},
          el('button',{class:'room-btn' + (selected?' selected':''), type:'button',
            onclick: ()=>{
              if (selection.roomsSelected.has(key)){
                selection.roomsSelected.delete(key);
                item.querySelector('.room-btn').classList.remove('selected');
              }else{
                selection.roomsSelected.set(key, parseInt(occSel.value,10));
                item.querySelector('.room-btn').classList.add('selected');
              }
              renderSummaryTop();
            }
          }, `${r.block}${r.num}`),
          occSel
        );
        ul.appendChild(item);
      });
      roomsBox.appendChild(ul);
    }
  }
}

function refreshAfterFilter(){
  updateFiltersDynamic();
  updateRightPanels();
}

/* ---------- Summary (top, concise) ---------- */
function renderSummaryTop(){
  const box = document.getElementById('summaryTop');
  if (!box) return;

  const totalPeople = Array.from(selection.roomsSelected.values()).reduce((a,b)=>a+b,0);
  // Clamp food counts to total people
  if (selection.food.veg + selection.food.nonveg > totalPeople){
    selection.food.nonveg = Math.max(0, totalPeople - selection.food.veg);
  }

  box.innerHTML = '';
  const ci = checkIn ? iso(checkIn) : '—';
  const co = checkOut ? iso(checkOut) : '—';

  let nights = 0;
  if (checkIn && checkOut && checkOut >= checkIn){
    nights = Math.round((startOfDay(checkOut) - startOfDay(checkIn))/(1000*60*60*24)) + 1 - 1;
    // inclusive display; room-nights use (checkOut - checkIn)
    nights = Math.max(0, nights + ((checkOut>checkIn)?0:0));
    nights = (checkIn && checkOut) ? Math.max(0, Math.round((checkOut - checkIn)/(1000*60*60*24))) : 0;
  }

  // Veg/Non-veg controls
  const foodRow = el('div',{class:'food-row double-space'},
    el('label',{},'Veg ', el('input',{type:'number',min:'0',value:String(selection.food.veg),class:'num',
      oninput:(e)=>{ selection.food.veg = Math.max(0, Math.min(totalPeople, parseInt(e.target.value||'0',10))); renderSummaryTop(); }
    })),
    el('label',{},'Non-veg ', el('input',{type:'number',min:'0',value:String(selection.food.nonveg),class:'num',
      oninput:(e)=>{ selection.food.nonveg = Math.max(0, parseInt(e.target.value||'0',10)); 
                     if (selection.food.veg + selection.food.nonveg > totalPeople){
                       selection.food.nonveg = Math.max(0, totalPeople - selection.food.veg);
                       e.target.value = String(selection.food.nonveg);
                     }
                     renderSummaryTop();
      }
    })),
    el('span',{class:'hint'}, ` (must total ≤ ${totalPeople})`)
  );

  // Amounts (placeholder ₹0 until tariff mapping per room type)
  const perNight = 0;
  const totalAmount = perNight * nights * selection.roomsSelected.size;

  box.appendChild(el('div',{}, `Check-in: ${ci}   |   Check-out: ${co}`));
  box.appendChild(el('div',{}, `Rooms selected: ${selection.roomsSelected.size}   |   Occupants: ${totalPeople}`));
  box.appendChild(foodRow);
  box.appendChild(el('div',{}, `Room-nights: ${nights * selection.roomsSelected.size}   |   Amount/night: ₹${perNight.toFixed(0)}   |   Total: ₹${totalAmount.toFixed(0)}`));
}

/* ---------- Rooms panel (detailed list still shown below) ---------- */
function renderRooms(container){
  container.innerHTML = '';
  container.appendChild(el('h3',{class:'panel-title'},'Rooms (available with current filters & dates)'));

  const rooms = filterRoomsRaw().filter(r => selection.filters.blocksIncluded.has(r.block));
  const byB = roomsByBlock(rooms);
  const counts = {};
  Object.keys(byB).forEach(b => counts[b] = byB[b].length);

  // quick counts strip
  const strip = el('div',{class:'counts-strip'});
  Object.keys(counts).sort().forEach(b=>{
    strip.appendChild(el('span',{class:'block-pill'}, `${b}: ${counts[b]} room(s)`));
  });
  if (!Object.keys(counts).length) strip.appendChild(el('div',{},'No rooms match the selected filters / dates.'));
  container.appendChild(strip);

  // detailed room list for the currently open block is rendered above (in filters) already
}

/* ---------- Bottom summary (unchanged content but kept in sync) ---------- */
function renderSummary(container){
  // We keep the bottom panel minimal since the top summary now shows everything.
  container.innerHTML = '';
  container.appendChild(el('h3',{class:'panel-title'},'Summary'));
  const top = document.getElementById('summaryTop');
  if (top){
    // mirror the same lines
    container.appendChild(el('div',{}, top.textContent));
  }
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

  // Load rooms CSV (supports your headings exactly)
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
    // fallback small demo so page doesn't break (remove when your CSV is live)
    inventory = [
      {block:'A', num:'1', floor:'0', min:1, max:2, ac:false, wc:false, pet:false, groupPerm:false},
      {block:'A', num:'3', floor:'0', min:1, max:2, ac:false, wc:false, pet:false, groupPerm:false},
      {block:'B', num:'9', floor:'1', min:1, max:3, ac:false, wc:false, pet:false, groupPerm:false},
      {block:'C', num:'8', floor:'1', min:2, max:4, ac:true,  wc:false, pet:true,  groupPerm:true},
      {block:'C', num:'9', floor:'1', min:2, max:4, ac:true,  wc:false, pet:true,  groupPerm:true},
      {block:'D', num:'2', floor:'0', min:1, max:3, ac:true,  wc:true,  pet:true,  groupPerm:true},
      {block:'E', num:'1', floor:'0', min:2, max:4, ac:true,  wc:false, pet:false, groupPerm:true},
    ];
  }

  // Optional bookings
  const bookingsCSV = await tryFetchText(['data/uploads/bookings.csv']);
  if (bookingsCSV){
    const rows = parseCSV(bookingsCSV);
    bookings = normalizeBookings(rows);
  }else{
    bookings = [];
  }
  bookedByDate = buildBookedByDate(bookings);

  // set blocksIncluded to ALL blocks initially
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
