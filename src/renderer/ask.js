// A question before something that cannot be undone, before closing, or with two ways to go, in the window's own
// dialog (#ask in index.html), the same look on every OS: the question as the title, what goes as its text, Cancel
// and the button that does it (red when it deletes), another way before it when there is one (other).
// Questions asked while one is open wait their turn. An ES module loaded when needed (common.js).
//   ask({ message, detail, ok, other, danger })   resolves 'ok' or 'other' (the button clicked); '' for Cancel, Esc, ×,
//                                                 a click outside, or the dialog closed by the window
const dialog = document.getElementById('ask');
const title = dialog.querySelector('h2');
const detail = dialog.querySelector('.detail');
const okButton = dialog.querySelector('.ok'), otherButton = dialog.querySelector('.other');
const showDialog = coverWhileOpen(dialog);
let turn = Promise.resolve();

export function ask(q) {
  const answer = turn.then(() => new Promise((resolve) => {
    title.textContent = q.message;
    detail.textContent = q.detail || '';
    okButton.textContent = q.ok || 'OK';
    okButton.classList.toggle('danger', !!q.danger);
    okButton.classList.toggle('primary', !q.danger);
    otherButton.textContent = q.other || '';
    otherButton.hidden = !q.other;
    dialog.returnValue = '';
    dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true });
    showDialog();
  }));
  turn = answer;
  return answer;
}
