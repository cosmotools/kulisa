// A question before something that cannot be undone, in the window's own dialog (#ask in index.html), the same look
// on every OS: the question as the title, what goes as its text, Cancel and the button that does it (red when it
// deletes).
// Questions asked while one is open wait their turn. An ES module loaded when needed (common.js).
//   ask({ message, detail, ok, danger })   resolves true for ok; false for Cancel, Esc, ×, a click outside, or the dialog
//                                          closed by the window (another project shown)
const dialog = document.getElementById('ask');
const title = dialog.querySelector('h2');
const detail = dialog.querySelector('.detail');
const okButton = dialog.querySelector('.ok');
const showDialog = coverWhileOpen(dialog);
let turn = Promise.resolve();

export function ask(q) {
  const answer = turn.then(() => new Promise((resolve) => {
    title.textContent = q.message;
    detail.textContent = q.detail || '';
    okButton.textContent = q.ok || 'OK';
    okButton.classList.toggle('danger', !!q.danger);
    okButton.classList.toggle('primary', !q.danger);
    dialog.returnValue = '';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
    showDialog();
  }));
  turn = answer;
  return answer;
}
