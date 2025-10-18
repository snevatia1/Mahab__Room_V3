// Main module - Globals, loadData, init
let rooms = []; // Fallback empty
let tariff = {}; // Fallback
let rules = {}; // Fallback
let restricted_periods = []; // Fallback
let bookings = JSON.parse(localStorage.getItem('bookings') || '[]');
let history = JSON.parse(localStorage.getItem('history') || '[]');
const defaultMem = {id: '123', name: 'John Doe'};

// Load JSONs with fallback
async function loadData() {
  try {
    rooms = await fetch('data/config/rooms.json').then(r => { if (!r.ok) throw new Error('Rooms failed'); return r.json(); });
    tariff = await fetch('data/config/tariff.json').then(r => { if (!r.ok) throw new Error('Tariff failed'); return r.json(); });
    rules = await fetch('data/config/rules.json').then(r => { if (!r.ok) throw new Error('Rules failed'); return r.json(); });
    restricted_periods = await fetch('data/config/restricted_periods.json').then(r => { if (!r.ok) throw new Error('Restricted failed'); return r.json(); });
    console.log('Data loaded');
  } catch (e) {
    console.error('Load error:', e);
    // Full fallback data from CSV/PDFs (rooms, tariff, rules, restricted)
    rooms = [
      {"block": "A", "room_no": "A-1", "floor": "1st", "min_person": 1, "max_person": 2, "airconditioning": false, "wheel_chair_access": true, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "A", "room_no": "A-2", "floor": "1st", "min_person": 2, "max_person": 4, "airconditioning": false, "wheel_chair_access": true, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "A", "room_no": "A-3", "floor": "1st", "min_person": 1, "max_person": 2, "airconditioning": false, "wheel_chair_access": true, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "A", "room_no": "A-4", "floor": "1st", "min_person": 2, "max_person": 4, "airconditioning": false, "wheel_chair_access": true, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "A", "room_no": "A-5", "floor": "1st", "min_person": 2, "max_person": 3, "airconditioning": false, "wheel_chair_access": true, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "A", "room_no": "A-6", "floor": "1st", "min_person": 2, "max_person": 3, "airconditioning": false, "wheel_chair_access": true, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "A", "room_no": "A-7", "floor": "1st", "min_person": 1, "max_person": 2, "airconditioning": false, "wheel_chair_access": true, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "A", "room_no": "A-8", "floor": "1st", "min_person": 1, "max_person": 2, "airconditioning": false, "wheel_chair_access": true, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "A", "room_no": "A-9", "floor": "G", "min_person": 1, "max_person": 2, "airconditioning": false, "wheel_chair_access": true, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "B", "room_no": "B-1", "floor": "G", "min_person": 2, "max_person": 4, "airconditioning": false, "wheel_chair_access": true, "pets_permitted": false, "group_booking_permitted": false},
      {"block": "B", "room_no": "B-2", "floor": "G", "min_person": 2, "max_person": 4, "airconditioning": false, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": false},
      {"block": "B", "room_no": "B-3", "floor": "G", "min_person": 2, "max_person": 4, "airconditioning": false, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": false},
      {"block": "B", "room_no": "B-4", "floor": "G", "min_person": 2, "max_person": 4, "airconditioning": false, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": false},
      {"block": "B", "room_no": "B-5", "floor": "G", "min_person": 2, "max_person": 4, "airconditioning": false, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": false},
      {"block": "B", "room_no": "B-6", "floor": "G", "min_person": 2, "max_person": 4, "airconditioning": false, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": false},
      {"block": "B", "room_no": "B-7", "floor": "G", "min_person": 2, "max_person": 4, "airconditioning": false, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": false},
      {"block": "B", "room_no": "B-8", "floor": "G", "min_person": 2, "max_person": 4, "airconditioning": false, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": false},
      {"block": "B", "room_no": "B-9", "floor": "G", "min_person": 1, "max_person": 2, "airconditioning": false, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": false},
      {"block": "Old C", "room_no": "C-1", "floor": "G", "min_person": 2, "max_person": 3, "airconditioning": true, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "Old C", "room_no": "C-2", "floor": "G", "min_person": 2, "max_person": 3, "airconditioning": true, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "Old C", "room_no": "C-3", "floor": "G", "min_person": 2, "max_person": 3, "airconditioning": true, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "Old C", "room_no": "C-4", "floor": "G", "min_person": 2, "max_person": 3, "airconditioning": true, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "Old C", "room_no": "C-5", "floor": "G", "min_person": 2, "max_person": 3, "airconditioning": true, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "Old C", "room_no": "C-6", "floor": "G", "min_person": 2, "max_person": 3, "airconditioning": true, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": true},
      {"block": "New C", "room_no": "C-7", "floor": "G", "min_person": 2, "max_person": 2, "airconditioning": true, "wheel_chair_access": false, "pets_permitted": true, "group_booking_permitted": true},
      {"block": "New C", "room_no": "C-8", "floor": "G", "min_person": 2, "max_person": 2, "airconditioning": true, "wheel_chair_access": false, "pets_permitted": true, "group_booking_permitted": true},
      {"block": "New C", "room_no": "C-9", "floor": "G", "min_person": 1, "max_person": 2, "airconditioning": true, "wheel_chair_access": false, "pets_permitted": true, "group_booking_permitted": true},
      {"block": "New C", "room_no": "C-10", "floor": "G", "min_person": 1, "max_person": 2, "airconditioning": true, "wheel_chair_access": false, "pets_permitted": true, "group_booking_permitted": true},
      {"block": "D", "room_no": "D-1", "floor": "G", "min_person": 1, "max_person": 2, "airconditioning": true, "wheel_chair_access": true, "pets_permitted": true, "group_booking_permitted": false},
      {"block": "D", "room_no": "D-2", "floor": "G", "min_person": 1, "max_person": 2, "airconditioning": true, "wheel_chair_access": true, "pets_permitted": true, "group_booking_permitted": false},
      {"block": "D", "room_no": "D-3", "floor": "G", "min_person": 2, "max_person": 3, "airconditioning": true, "wheel_chair_access": true, "pets_permitted": true, "group_booking_permitted": false},
      {"block": "D", "room_no": "D-4", "floor": "G", "min_person": 2, "max_person": 3, "airconditioning": true, "wheel_chair_access": true, "pets_permitted": true, "group_booking_permitted": false},
      {"block": "Old E", "room_no": "E-1", "floor": "G", "min_person": 1, "max_person": 2, "airconditioning": true, "wheel_chair_access": false, "pets_permitted": true, "group_booking_permitted": false},
      {"block": "Old E", "room_no": "E-2", "floor": "G", "min_person": 1, "max_person": 2, "airconditioning": true, "wheel_chair_access": false, "pets_permitted": true, "group_booking_permitted": false},
      {"block": "Old E", "room_no": "E-3", "floor": "G", "min_person": 2, "max_person": 3, "airconditioning": true, "wheel_chair_access": false, "pets_permitted": false, "group_booking_permitted": false},
      {"block": "New E", "room_no": "E-4", "floor": "G", "min_person": 2, "max_person": 2, "airconditioning": true, "wheel_chair_access": true, "pets_permitted": false, "group_booking_permitted": false},
      {"block": "New E", "room_no": "E-5", "floor": "G", "min_person": 2, "max_person": 2, "airconditioning": true, "wheel_chair_access": true, "pets_permitted": false, "group_booking_permitted": false},
      {"block": "New E", "room_no": "E-6", "floor": "G", "min_person": 2, "max_person": 2, "airconditioning": true, "wheel_chair_access": true, "pets_permitted": false, "group_booking_permitted": false},
      {"block": "New E", "room_no": "E-7", "floor": "G", "min_person": 2, "max_person": 2, "airconditioning": true, "wheel_chair_access": true, "pets_permitted": false, "group_booking_permitted": false}
    ];
    // Full tariff from PDF
    tariff = {
      "regular": {
        "member": {"double": 5460, "single_double": 4410, "single_single": 2730, "extra_adult": 2170, "extra_child": 1085},
        "senior": {"double": 4914, "single_double": 3969, "single_single": 2457, "extra_adult": 1953},
        "temp": {"double": 9930, "single_double": 8060, "single_single": 4965, "extra_adult": 3727, "extra_child": 1863.5}
      },
      "special": {
        "member": {"double": 6552, "single_double": 5292, "single_single": 3276, "extra_adult": 2604, "extra_child": 1302},
        "senior": {"double": 5896.8, "single_double": 4762.8, "single_single": 2948.4, "extra_adult": 2343.6},
        "temp": {"double": 11868.8, "single_double": 9648.4, "single_single": 5934.4, "extra_adult": 4448.8, "extra_child": 2224.4}
      },
      "add_ons": {"bbq_per_person": 210, "ac_per_night": 1000, "gst_on_ac": 0.18}
    };
    // Full rules
    rules = {
      "booking_windows": {"member": 180, "with_temp": 90, "unaccompanied_temp": 60},
      "max_live_bookings": 2,
      "room_limits": {"weekday": 6, "weekend": 3},
      "group": {"min_rooms": 10, "max_rooms": 19, "min_nights": 2, "max_nights": 5, "deposit": 20000, "guest_list_days": 15, "block_caps": {"c": 10, "a": 9}},
      "cancellation": {
        "regular": [{"days": ">7", "cancel": 0.1, "mod": 0}, {"days": "2-7", "cancel": 0.2, "mod": 1000}, {"days": "<2", "cancel": "100% first 2 days", "mod": "cancel"}],
        "special": [{"days": ">30", "cancel": 0.1, "mod": 0}, {"days": "7-30", "cancel": 0.2, "mod": 2000}, {"days": "2-7", "cancel": 0.5, "mod": 3000}, {"days": "<2", "cancel": 1, "mod": "no"}],
        "group_complete": [{"days": ">7", "cancel": 20000, "mod": 0}, {"days": "2-7", "cancel": 0.2, "mod": 5000}, {"days": "<2", "cancel": 0.5, "mod": "no"}],
        "group_partial": [{"days": ">7", "cancel": 0.1, "mod": 0}, {"days": "2-7", "cancel": 0.2, "mod": 1000}, {"days": "<2", "cancel": 1, "mod": "no"}]
      }
    };
    // Full restricted from PDF
    restricted_periods = [
      {"start": "2025-01-11", "end": "2025-01-11", "type": "event", "name": "Barbeque"},
      {"start": "2025-01-25", "end": "2025-01-25", "type": "event", "name": "Barbeque"},
      {"start": "2025-02-08", "end": "2025-02-08", "type": "event", "name": "Barbeque"},
      {"start": "2025-02-22", "end": "2025-02-22", "type": "event", "name": "Barbeque"},
      {"start": "2025-03-08", "end": "2025-03-08", "type": "event", "name": "Barbeque"},
      {"start": "2025-03-14", "end": "2025-03-16", "type": "long_weekend", "name": "Holi"},
      {"start": "2025-03-22", "end": "2025-03-22", "type": "event", "name": "Barbeque"},
      {"start": "2025-03-28", "end": "2025-03-31", "type": "long_weekend", "name": "Ramzan Eid"},
      {"start": "2025-04-11", "end": "2025-04-14", "type": "long_weekend", "name": "Dr Ambedkar Jayanti"},
      {"start": "2025-04-12", "end": "2025-04-12", "type": "event", "name": "Barbeque"},
      {"start": "2025-04-18", "end": "2025-04-20", "type": "long_weekend", "name": "Good Friday"},
      {"start": "2025-04-26", "end": "2025-04-26", "type": "event", "name": "Barbeque"},
      {"start": "2025-05-09", "end": "2025-05-12", "type": "long_weekend", "name": "Buddha Purnima"},
      {"start": "2025-05-10", "end": "2025-05-10", "type": "event", "name": "Barbeque"},
      {"start": "2025-05-23", "end": "2025-06-08", "type": "event", "name": "Summer Season"},
      {"start": "2025-05-24", "end": "2025-05-24", "type": "event", "name": "Barbeque"},
      {"start": "2025-06-08", "end": "2025-06-08", "type": "event", "name": "Non-Season Begins"},
      {"start": "2025-06-14", "end": "2025-06-14", "type": "event", "name": "Barbeque"},
      {"start": "2025-06-30", "end": "2025-09-14", "type": "closed", "name": "Monsoons"},
      {"start": "2025-10-17", "end": "2025-11-02", "type": "special", "name": "Diwali"},
      {"start": "2025-12-19", "end": "2026-01-04", "type": "special", "name": "Christmas/New Year"},
      {"start": "2026-01-24", "end": "2026-01-26", "type": "long_weekend", "name": "Republic Day"},
      {"start": "2026-03-20", "end": "2026-03-22", "type": "long_weekend", "name": "Eid-al-Fitr"},
      {"start": "2026-04-03", "end": "2026-04-05", "type": "long_weekend", "name": "Good Friday"},
      {"start": "2026-05-01", "end": "2026-05-03", "type": "long_weekend", "name": "Labour Day"}
    ];
  }
}

// Init
window.onload = async () => {
  console.log('Page loaded');
  try {
    await loadData();
    generateCalendar();
    document.getElementById('avail-start').value = moment().format('YYYY-MM-DD');
    document.getElementById('avail-end').value = moment().add(1, 'day').format('YYYY-MM-DD');
    updateAvailability();
  } catch (e) {
    console.error('Onload error:', e);
    generateCalendar(); // Run with fallback
  }
};