// crypto's randomInt made to draw given ids, to test that one taken is drawn again (store.ts, newId).
import crypto from 'crypto';
import { syncBuiltinESMExports } from 'module';

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

// The characters of these ids, one a draw, then randomInt's own again (the returned function puts it back). The
// stores import it by name: the named export is synced with the module's object.
function drawing(...ids: string[]) {
  const chars = [...ids.join('')], own = crypto.randomInt;
  crypto.randomInt = (max: number) => (chars.length ? ID_CHARS.indexOf(chars.shift()) : own(max));
  syncBuiltinESMExports();
  return () => { crypto.randomInt = own; syncBuiltinESMExports(); };
}

export { drawing };
