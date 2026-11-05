// The welcome's coffee-break vignette (README.md, Demonstrations). The upper body pivots at the hips while the
// feet stay on the ottoman; articulated SVG shares the demo clock and its Pause/reduced-motion behavior.
export function CoffeeBreak() {
  return <svg viewBox="0 0 240 200" fill="none" aria-hidden="true" className="pointer-events-none absolute -bottom-2 -left-46 hidden w-44 overflow-visible text-muted-foreground xl:block [@media(max-height:750px)]:hidden">
    <ellipse cx="120" cy="186" rx="107" ry="5" fill="currentColor" opacity=".08" />
    <path d="M16 188h211" stroke="currentColor" strokeOpacity=".2" strokeLinecap="round" />
    <g stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M77 151v28m-26 6 26-6 26 6M52 185v3m50-3v3" />
      <path d="m152 166-4 19m32-19 5 19" />
    </g>
    <rect x="143" y="155" width="46" height="13" rx="6.5" fill="var(--muted)" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.5" />
    <path d="M54 143h44c7 0 11 3 11 7s-4 6-11 6H63c-7 0-12-4-12-8 0-3 1-5 3-5Z" fill="var(--muted)" stroke="currentColor" strokeOpacity=".5" strokeWidth="2" />
    <path d="M77 125c14 0 25-7 36-10 6-2 11 0 15 5l28 26-7 9-31-25-28 13c-13 4-21-8-13-18Z" fill="currentColor" />
    <path d="m150 145 7-3 8 6 11 1c5 1 7 3 7 6h-28c-4 0-6-3-5-6Z" fill="var(--foreground)" />
    <path d="M76 132c12 2 28-5 42-8 6-1 11 1 15 7l23 25-9 8-28-24-29 9c-12 3-23-7-14-17Z" fill="var(--foreground)" fillOpacity=".8" />
    <path d="m147 155 8-5 8 8 11 1c5 1 7 3 7 6h-29c-4 0-6-3-5-6Z" fill="var(--foreground)" />
    <path d="m151 162 28 1" stroke="var(--background)" strokeOpacity=".45" strokeWidth="1.5" strokeLinecap="round" />
    <path d="m117 130 6 3m-38 8 7-2" stroke="var(--background)" strokeOpacity=".25" strokeWidth="1.5" strokeLinecap="round" />
    <g data-demo-motion className="welcome-human-recline">
      <path d="M37 69c-8 0-11 7-9 15l15 50c2 7 7 12 14 14l8-2-18-66c-2-7-5-11-10-11Z" fill="var(--muted)" stroke="currentColor" strokeOpacity=".5" strokeWidth="2" />
      <path data-demo-motion className="welcome-human-send" d="m67 97 33 17 52-7" stroke="var(--foreground)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M57 88c5-8 15-9 21-3l17 38c3 7 0 13-7 14l-23-3-17-32c-3-6 1-11 9-14Z" fill="var(--destructive)" />
      <path d="m65 78 3 11" stroke="var(--foreground)" strokeWidth="10" strokeLinecap="round" />
      <g data-demo-motion className="welcome-human-head">
        <path d="M49 56c4-8 20-12 26-2l2 9 5 5-5 3-1 9c-1 5-8 8-15 4L50 74Z" fill="var(--foreground)" />
        <path d="M47 65c-6-10-2-22 9-24 13-3 22 5 21 13-8 3-15 1-20-2l-1 13-5 2Z" fill="currentColor" />
        <path d="M61 77c6 4 10 4 15 1l-1 6c-5 4-11 2-15-1Z" fill="currentColor" opacity=".7" />
        <circle cx="72" cy="62" r="1.5" fill="var(--background)" />
        <path d="m75 74-4 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <path d="m74 101 21 16" stroke="var(--foreground)" strokeWidth="9" strokeLinecap="round" />
      <path d="m69 96 8 7" stroke="var(--destructive)" strokeWidth="13" strokeLinecap="round" />
      <g data-demo-motion className="welcome-human-coffee">
        <path d="m95 117 22-16" stroke="var(--foreground)" strokeWidth="9" strokeLinecap="round" />
        <path d="M134 88h4c9 0 9 12 0 12h-4" stroke="var(--foreground)" strokeWidth="3" />
        <path d="M116 84h20v16c0 5-4 8-10 8s-10-3-10-8Z" fill="var(--foreground)" />
        <ellipse cx="126" cy="84" rx="10" ry="2.5" fill="currentColor" />
        <g data-demo-motion className="welcome-human-steam" stroke="var(--foreground)" strokeOpacity=".4" strokeWidth="1.5" strokeLinecap="round"><path d="M122 76c-5-5 4-6 0-11M129 76c-5-5 4-6 0-11" /></g>
      </g>
    </g>
    <path d="M151 115h76m-9 0v69m-13 1h26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <path d="m167 107-7-31c-.6-3 1-5 4-5h40c3 0 5 2 5 5l5 31Z" fill="var(--card)" stroke="currentColor" strokeWidth="2" />
    <path d="M150 107h66l8 5h-79Z" fill="var(--muted)" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="m174 86 5 4-4 4m9 0h6" stroke="var(--foreground)" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle data-demo-motion className="welcome-human-task" cx="204" cy="82" r="3" fill="var(--destructive)" />
  </svg>;
}
