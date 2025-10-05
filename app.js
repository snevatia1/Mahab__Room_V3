
// Minimal legacy stubs (left intentionally light)
let CONFIG=null;
async function loadConfig(){try{CONFIG=await (await fetch('config.json')).json();}catch(e){CONFIG=await (await fetch('config.example.json')).json();}}
loadConfig();
function setupAuth(){/* no-op for static demo */}
