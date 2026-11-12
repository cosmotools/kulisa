# Window client

Typed core clients and one preference store per UI page, independent of shell/task navigation and resource stores.
Core remains authoritative; URL preferences seed first paint, then core events/ready handshakes refresh them.

## The code

`renderer/actions.ts` binds task identity; `open-settings.ts` requests Settings; `preferences.ts` receives core facts.
The entry imports `names.ts` once per page for the shared name-input filter; core still validates submissions.
