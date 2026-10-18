// The pictures' file names (main/folder.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileName } from './main/folder.ts';

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
