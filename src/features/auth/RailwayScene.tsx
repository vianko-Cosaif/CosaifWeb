import styles from "./login.module.scss";

// Wheel contact is derived from the rail, so the train cannot drift above or below it.
const RAIL_Y = 251;
const WHEEL_RADIUS = 16;
const AXLE_Y = 128;
const TRAIN_Y = RAIL_Y - AXLE_Y - WHEEL_RADIUS;
const AXLES = [92, 128, 164, 533, 569, 605];

function Wheel({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} ${AXLE_Y})`}>
      <circle r={WHEEL_RADIUS} fill="#14242b" stroke="#87979b" strokeWidth="2" />
      <circle r="12" fill="#2c3f46" stroke="#4e646c" />
      <g className={styles.wheelSpin} stroke="#8b999b" strokeWidth="2">
        <path d="M-11 0h22M0-11v22M-8-8 8 8M-8 8 8-8" />
      </g>
      <circle r="5" fill="#849497" stroke="#23373f" strokeWidth="2" />
    </g>
  );
}

export default function RailwayScene() {
  return (
    <div className={styles.railway} aria-hidden="true">
      <svg viewBox="0 0 900 305" fill="none" focusable="false">
        <defs>
          <linearGradient id="fx-green" x2="0" y2="1"><stop stopColor="#356653" /><stop offset=".48" stopColor="#234f43" /><stop offset="1" stopColor="#173b34" /></linearGradient>
          <linearGradient id="fx-red" x2="0" y2="1"><stop stopColor="#ed665a" /><stop offset=".22" stopColor="#cf403c" /><stop offset="1" stopColor="#992c2d" /></linearGradient>
          <linearGradient id="fx-steel" x2="0" y2="1"><stop stopColor="#657880" /><stop offset="1" stopColor="#253c47" /></linearGradient>
          <linearGradient id="fx-window" x2="1" y2="1"><stop stopColor="#92b6c4" /><stop offset=".3" stopColor="#3d697c" /><stop offset="1" stopColor="#132d3d" /></linearGradient>
          <linearGradient id="fx-ground" x2="0" y2="1"><stop stopColor="#6d8b942a" /><stop offset="1" stopColor="#6d8b9400" /></linearGradient>
          <linearGradient id="fx-light"><stop stopColor="#ffdf9b" stopOpacity="0" /><stop offset="1" stopColor="#ffdf9b" stopOpacity=".15" /></linearGradient>
          <pattern id="fx-grille" width="5" height="6" patternUnits="userSpaceOnUse"><path d="M0 0v6" stroke="#5a7b6b" strokeWidth="1" /><path d="M0 1h5" stroke="#152d2a" strokeWidth="2" /></pattern>
          <pattern id="fx-ballast" width="31" height="13" patternUnits="userSpaceOnUse"><path d="m3 4 4-2m12 7 3-2m-10 6 3-2" stroke="#47616d" strokeWidth="2" /></pattern>
        </defs>

        <g className={styles.distantYard} stroke="#6d97a6" strokeOpacity=".2">
          {[15, 320, 625, 930, 1235].map((x) => <g key={x}><path d={`M${x} 235V65m-32 8 32-8 32 8`} strokeWidth="2" /><path d={`M${x - 31} 77h16m29 0h16`} stroke="#afc7ca" strokeWidth="3" /></g>)}
          <path d="M0 228h1250m-280-1v-80h-170v80m170-80-30-20H830l-30 20" />
        </g>
        <path d={`M0 ${RAIL_Y + 3}h900v51H0z`} fill="url(#fx-ground)" />
        <path d={`M0 ${RAIL_Y + 5}h900v25H0z`} fill="url(#fx-ballast)" />
        <g className={styles.sleeperMotion} stroke="#75909a" strokeOpacity=".55" strokeWidth="9">
          {Array.from({ length: 34 }, (_, i) => <path key={i} d={`m${i * 30 - 60} ${RAIL_Y + 5}-6 10`} />)}
        </g>
        <path d={`M0 ${RAIL_Y}h900`} stroke="#abc0c5" strokeWidth="2" />
        <path d={`M0 ${RAIL_Y + 3}h900`} stroke="#496975" strokeWidth="3" />
        <path d={`M0 ${RAIL_Y + 13}h900`} stroke="#617f8b" strokeWidth="2" />

        <g transform={`translate(118 ${TRAIN_Y})`}>
          <ellipse cx="340" cy="145" rx="341" ry="5" fill="#091d29" fillOpacity=".65" />
          <path d="m31 79-133-36v73L31 87Z" fill="url(#fx-light)" />
          <path d="M208 112h241l-12 29H220Z" fill="url(#fx-steel)" stroke="#7c8c90" strokeWidth=".7" />
          <path d="M225 118h205m-188 0v16m168-16v16" stroke="#233b46" strokeWidth="2" />
          {AXLES.map((x) => <Wheel key={x} x={x} />)}
          {[67, 508].map((x) => <g key={x} transform={`translate(${x} 113)`}>
            <path d="M0 0h120l-8 12H8Z" fill="#42575e" stroke="#829396" />
            {[20, 56, 92].map((spring) => <g key={spring}><rect x={spring} y="1" width="11" height="9" rx="2" fill="#152e39" /><path d={`M${spring} 3h11m-11 3h11`} stroke="#a3abad" /></g>)}
          </g>)}

          <path d="M26 109V66l43-12V18L86 5h68l18 18v14h403V24h84l13 14v71Z" fill="url(#fx-green)" stroke="#729182" strokeWidth="1" />
          <path d="M26 108V66l43-12V18L86 5h68l18 18v84Z" fill="url(#fx-red)" />
          <path d="M69 55V18L86 5h68l18 18v27" stroke="#f28b76" strokeWidth="1.5" />
          <path d="m62 18 21-19h75l19 21" fill="#993a37" stroke="#d65b50" strokeWidth="2" />
          <path d="M80 23h27v29H76V29Zm35 0h32l8 8v21h-40Z" fill="url(#fx-window)" stroke="#173038" strokeWidth="3" />
          <path d="m80 28 15-2m25 1 18 13" stroke="#c0d1d4" strokeOpacity=".45" strokeWidth="2" />
          <path d="M162 39h10v65h-10M73 62h84v44H73" stroke="#802d2e" />
          <path d="M175 48h382l-19 50H199Z" fill="#e5e6d9" />
          <text x="267" y="85" fill="#234c40" fontSize="34" fontFamily="Arial, sans-serif" fontWeight="700" fontStyle="italic" letterSpacing="-1">Ferromex</text>
          <path d="m177 38 69 0-25 20h-44Zm0 58h76l-12 12h-64Z" fill="#b83833" />
          <path d="M172 30h353v7H172" fill="#243f37" /><path d="M575 22h83l15 15h-99Z" fill="#466c5a" stroke="#809786" />
          <rect x="547" y="47" width="111" height="47" rx="1" fill="#16392f" stroke="#668672" />
          <rect x="550" y="50" width="105" height="40" fill="url(#fx-grille)" />
          <path d="M187 41v62m58-5v5m44-5v5m44-5v5m44-5v5m44-5v5m44-5v5m44-62v62" stroke="#729381" strokeOpacity=".5" />
          <path d="M280 30v-8h30v8m139 0v-7h25v7" fill="#263f39" stroke="#789487" />
          <text x="93" y="86" fill="#f5e8d9" fontSize="19" fontWeight="600" fontFamily="Arial, sans-serif">4036</text>
          <rect x="81" y="8" width="34" height="11" fill="#152d31" /><text x="85" y="16" fill="#edeadf" fontSize="8" fontFamily="monospace">4036</text>
          <path d="M29 78h36v13H29m44-2h83v6H73" fill="#245047" />
          <path d="M23 105h653v7H23Z" fill="#d2d7ce" /><path d="M23 113h653v7H23Z" fill="#253c46" stroke="#506c76" />
          <path d="m23 120-13 21h37l9-21" fill="#223a43" stroke="#76909a" />
          <path d="m24 123-8 15m19-15-7 15m19-15-7 15" stroke="#c0c9c4" strokeWidth="4" />
          <path d="M10 124H-1m677-5h16" stroke="#5a7078" strokeWidth="6" />
          <path d="M23 131V75l20-16h23M174 104V85h485v46m-485-27V85m65 19V85m65 19V85m65 19V85m65 19V85m65 19V85m65 19V85m65 19V85" stroke="#b6c4bc" strokeWidth="1.5" />
          <path d="M25 118h20m-20 7h16m-16 7h12m615-14h14m-14 7h14m-14 7h14" stroke="#d2d0a9" strokeWidth="2" />
          <circle cx="30" cy="74" r="3" fill="#ffe0a0" /><circle cx="30" cy="83" r="3" fill="#ffedbd" />
          <path d="M671 63v40" stroke="#d0d7cc" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}
