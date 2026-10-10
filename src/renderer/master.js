// The bar of a master's window (master.html; main/master.js): the address (Enter goes there), back, forward, reload,
// and what the window is for. Its theme and the profile's name come in the URL.
const query = new URLSearchParams(location.search);
document.documentElement.dataset.theme = query.get('theme') || 'dark';
document.getElementById('what').textContent = `${query.get('name')}: signed in here, every new task's copy is too`;
const address = document.getElementById('address');
// While the human types an address, where the page goes does not overwrite it.
let typing = false;
address.oninput = () => { typing = true; };
address.onblur = () => { typing = false; };
document.getElementById('go').onsubmit = (e) => { e.preventDefault(); typing = false; if (address.value.trim()) kulisa.invoke('master:go', address.value.trim()); };
for (const id of ['back', 'forward', 'reload']) document.getElementById(id).onclick = () => kulisa.invoke(`master:${id}`);
kulisa.on('master:url', (url) => { if (!typing) address.value = url === 'about:blank' ? '' : url; });
address.focus();
