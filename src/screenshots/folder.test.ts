// The pictures' file names (main/folder.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileName, movedTo } from './main/folder.ts';

const at = new Date(2026, 9, 9, 7, 5, 3);

test('a picture is named by Kulisa, the profile and the time, as the OSes name theirs', () => {
  assert.equal(fileName('Sam seller', at), 'Kulisa Sam seller 2026-10-09 07.05.03.png');
  assert.equal(fileName('Sam seller', at, 2), 'Kulisa Sam seller 2026-10-09 07.05.03 (2).png', 'a second in the same second');
});

test("a profile's name keeps no character a file name may not have on any OS", () => {
  assert.equal(fileName('a/b\\c:d*e?"f<g>h|i\tj', at), 'Kulisa a b c d e f g h i j 2026-10-09 07.05.03.png');
  assert.equal(fileName('dots...', at), 'Kulisa dots 2026-10-09 07.05.03.png');
  assert.equal(fileName(' / ', at), 'Kulisa 2026-10-09 07.05.03.png');
});

test("Windows' Screenshots folder where it was moved, as the registry keeps it; none while it was not", () => {
  const query = (value: string) => `\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders\r\n    {B7BEDE81-DF94-4682-A7D8-57A52620B86F}    ${value}\r\n\r\n`;
  assert.equal(movedTo(query('REG_EXPAND_SZ    %USERPROFILE%\\OneDrive\\Shots'), { USERPROFILE: 'C:\\Users\\me' }), 'C:\\Users\\me\\OneDrive\\Shots');
  assert.equal(movedTo(query('REG_SZ    D:\\My Shots'), {}), 'D:\\My Shots', 'with a space');
  assert.equal(movedTo(query('REG_EXPAND_SZ    %NOPE%\\x'), {}), '%NOPE%\\x', 'a variable not set stays');
  assert.equal(movedTo('', {}), null, 'the value missing: reg failed');
});
