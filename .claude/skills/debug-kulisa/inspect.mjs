// Runs JavaScript in a running Kulisa's main process, through Node's inspector, and prints the result as JSON.
//   node inspect.mjs <port> '<body of an async function>'
// The body may use `require` (paths from the repository root, e.g. require('./src/main/profiles.js'), and
// require('electron')) and `return` a JSON-able value. Values kept on globalThis stay for the next call.
const [port, body] = process.argv.slice(2);
const [target] = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((ok) => ws.addEventListener('open', ok));
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
  expression: `(async () => { const require = process.mainModule.require; ${body} })()`,
  awaitPromise: true, returnByValue: true } }));
ws.addEventListener('message', (m) => {
  const d = JSON.parse(m.data);
  if (d.id !== 1) return;
  const ex = d.result.exceptionDetails;
  console.log(ex ? `ERROR: ${ex.exception?.description || ex.text}` : JSON.stringify(d.result.result.value, null, 1));
  process.exit(ex ? 1 : 0);
});
