import { el, badge } from './display.js';

async function loadJSON(path){
  const r = await fetch(path + '?v=' + Date.now());
  if(!r.ok) throw new Error('Failed to load ' + path);
  return r.json();
}

function dateRange(start, end){
  const out = [];
  const s = new Date(start), e = new Date(end);
  for(let d = new Date(s); d <= e; d.setDate(d.getDate()+1)){
    out.push(new Date(d));
  }
  return out;
}

function iso(d){ return d.toISOString().slice(0,10); }

function renderCalendar(container, restricted, longWeekends){
  const today = new Date();
  const sixMonthsLater = new Date(today); sixMonthsLater.setMonth(today.getMonth()+6);
  const dates = dateRange(today, sixMonthsLater);
  const special = new Set();
  const closed = new Set();
  (restricted.special_periods || []).forEach(p => dateRange(new Date(p.start), new Date(p.end)).forEach(d => special.add(iso(d))));
  (restricted.closed_periods || []).forEach(p => dateRange(new Date(p.start), new Date(p.end)).forEach(d => closed.add(iso(d))));

  container.innerHTML = '';
  const wrap = el('div');
  dates.forEach(d => {
    const s = iso(d);
    const classes = ['date'];
    if (special.has(s)) classes.push('special');
    if (closed.has(s)) classes.push('closed');
    const cell = el('div', {class: classes.join(' ')},
      String(d.getDate())
    );
    cell.addEventListener('click', () => {
      if (closed.has(s)) return;
      if (cell.classList.contains('selected')) cell.classList.remove('selected');
      else cell.classList.add('selected');
      updateSummary();
    });
    wrap.appendChild(cell);
  });
  container.appendChild(wrap);
  const legend = el('div', {},
    badge('Special'),
    badge('Closed'),
    badge('Selected')
  );
  container.appendChild(legend);
}

let selection = { rooms: [], people: { member_adults:0, seniors:0, temp_adults:0, kids_5_10:0, kids_11_21:0 }, veg:0, nonveg:0 };

function renderFilters(container, rules){
  container.innerHTML = '';
  const form = el('div', {},
    el('h3', {}, 'Filters'),
    el('label', {}, 'Wheelchair ', el('input', {type:'checkbox', id:'f_wc'})),
    el('label', {style:'margin-left:12px'}, 'Pet-friendly ', el('input', {type:'checkbox', id:'f_pet'})),
    el('label', {style:'margin-left:12px'}, 'AC ', el('input', {type:'checkbox', id:'f_ac'})),
    el('div', {style:'margin-top:8px'}, 'Enter People:'),
    el('input', {type:'number', id:'p_member', placeholder:'Member adults', min:'0', value:'0', style:'width:140px;margin-right:8px'}),
    el('input', {type:'number', id:'p_senior', placeholder:'Seniors 65+', min:'0', value:'0', style:'width:120px;margin-right:8px'}),
    el('input', {type:'number', id:'p_temp', placeholder:'Temp adults', min:'0', value:'0', style:'width:120px;margin-right:8px'}),
    el('input', {type:'number', id:'p_k510', placeholder:'Kids 5-10', min:'0', value:'0', style:'width:100px;margin-right:8px'}),
    el('input', {type:'number', id:'p_k1121', placeholder:'Kids 11-21', min:'0', value:'0', style:'width:110px'}),
  );
  container.appendChild(form);
}

function renderRooms(container){
  container.innerHTML = '';
  const demoRooms = [
    {block:'A', num:'1', ac:false, pet:false, wc:false, min:1, max:2},
    {block:'C', num:'8', ac:true, pet:true, wc:false, min:2, max:4},
    {block:'D', num:'2', ac:true, pet:true, wc:true, min:1, max:3}
  ];
  const header = el('h3', {}, 'Rooms (demo) – load your CSV to replace');
  container.appendChild(header);
  const list = el('div');
  demoRooms.forEach(r => {
    const chip = el('span', {class:'room-chip'}, `${r.block}${r.num} (min ${r.min}/max ${r.max})`);
    chip.addEventListener('click', () => {
      chip.classList.toggle('selected');
      const key = r.block + r.num;
      const i = selection.rooms.indexOf(key);
      if (i>=0) selection.rooms.splice(i,1); else selection.rooms.push(key);
      updateSummary();
    });
    list.appendChild(chip);
  });
  container.appendChild(list);
}

async function updateSummary(){
  const s = document.getElementById('summary');
  if (!s) return;
  const selectedDates = Array.from(document.querySelectorAll('.date.selected')).length;
  const nights = Math.max(0, selectedDates-1);
  // Basic calc demo
  s.innerHTML = '';
  s.appendChild(el('h3', {}, 'Summary'));
  s.appendChild(el('div', {}, 'Rooms selected: ' + selection.rooms.join(', ')));
  s.appendChild(el('div', {}, 'Nights (approx): ' + nights));
  s.appendChild(el('div', {}, 'Tip: replace demo with your data/uploads/*.csv to activate real pricing.'));
}

async function main(){
  const [rules, restricted, lweek, tariff] = await Promise.all([
    loadJSON('data/config/rules.json'),
    loadJSON('data/config/restricted_periods.json'),
    loadJSON('data/config/long_weekends.json'),
    loadJSON('data/config/tariff.json')
  ]);
  window.__rules = rules;
  window.__restricted = restricted;
  window.__longWeekends = lweek;
  window.__tariff = tariff;

  renderCalendar(document.getElementById('calendar'), restricted, lweek);
  renderFilters(document.getElementById('filters'), rules);
  renderRooms(document.getElementById('rooms'));
  updateSummary();
}

main().catch(err => {
  const s = document.getElementById('summary');
  if (s) s.textContent = 'Error: ' + err.message;
  console.error(err);
});
