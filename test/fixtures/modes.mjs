// A program in a shell that sets the terminal's modes as Claude Code's fullscreen does (window.ts): the mouse in SGR,
// the cursor hidden, after a marker and lines to scroll. It reads its input raw and keeps running, as an agent does:
// Windows' ConPTY passes the mouse's modes on only for a program that reads its input so.
process.stdin.setRawMode(true);
console.log('shell-marker');
for (let i = 1; i <= 300; i++) console.log(i);
process.stdout.write('\x1b[?1000h\x1b[?1006h\x1b[?25l');
setInterval(() => {}, 60_000);
