import React from 'react';
import {
  getBogieRanges,
  getDiagramMetrics,
  getWheelPoints,
  VIEWBOX_HEIGHT,
  VIEWBOX_WIDTH,
} from './core/geometry';
import { getStatusFill, getStatusStroke, resolveLabels, resolveTheme } from './core/theme';
import { LocomotiveMapProps, WheelPoint } from './core/types';

function titleForView(viewMode: LocomotiveMapProps['viewMode']) {
  if (viewMode === 'top') return 'VISTA SUPERIOR';
  if (viewMode === 'left') return 'VISTA LATERAL IZQUIERDA';
  return 'VISTA LATERAL DERECHA';
}

interface OrientationProps {
  orientation: 'vertical' | 'horizontal';
}

function TopLocomotiveBody({ 
  wheelCount, 
  viewMode,
  orientation,
  theme,
}: Pick<LocomotiveMapProps, 'wheelCount' | 'viewMode'> & OrientationProps & {
  theme: ReturnType<typeof resolveTheme>;
}) {
  const bogies = getBogieRanges(wheelCount, viewMode);
  const scale = 0.68;
  const topTransform = orientation === 'horizontal'
    ? `translate(91 136) scale(${scale})`
    : `translate(283 91) rotate(90) scale(${scale})`;
  const base = theme.colors.primary;
  const baseDeep = 'var(--loco-map-accent-shadow)';
  const baseDark = theme.colors.machineStroke;
  const baseLight = theme.colors.primarySoft;
  const baseGlow = 'var(--loco-map-accent-highlight)';
  const metal = theme.colors.machineStroke;

  return (
    <>
      <g className="loco-map-body" transform={topTransform}>
        <rect x="-18" y="112" width="836" height="42" rx="18" fill="#020617" opacity="0.16" />
        <rect x="-20" y="95" width="40" height="30" fill={metal} rx="4" />
        <rect x="780" y="95" width="40" height="30" fill={metal} rx="4" />

        <rect x="0" y="20" width="800" height="180" fill={baseDeep} rx="8" />
        <rect x="6" y="28" width="788" height="34" fill={baseLight} opacity="0.22" rx="7" />
        <rect x="0" y="150" width="800" height="50" fill={baseDeep} opacity="0.7" rx="8" />
        <line x1="10" y1="35" x2="790" y2="35" stroke={baseGlow} strokeWidth="2" strokeDasharray="10 5" opacity="0.95" />
        <line x1="10" y1="185" x2="790" y2="185" stroke={baseGlow} strokeWidth="2" strokeDasharray="10 5" opacity="0.75" />

        <rect x="250" y="45" width="530" height="130" fill={baseDark} />
        <rect x="260" y="60" width="510" height="100" fill={base} />
        <rect x="260" y="60" width="510" height="28" fill={baseLight} opacity="0.32" />
        <rect x="260" y="140" width="510" height="20" fill={baseDeep} opacity="0.36" />

        <rect x="30" y="30" width="190" height="160" fill={baseDark} rx="4" />
        <rect x="40" y="45" width="160" height="130" fill={base} rx="4" />
        <rect x="42" y="47" width="156" height="28" fill={baseLight} opacity="0.34" rx="4" />
        <rect x="40" y="145" width="160" height="30" fill={baseDeep} opacity="0.34" rx="4" />
        <rect x="70" y="70" width="80" height="80" fill={baseDeep} rx="4" />
        <rect x="80" y="80" width="60" height="60" fill={baseDark} rx="2" />
        <rect x="86" y="86" width="48" height="16" fill={baseLight} opacity="0.28" rx="2" />

        <rect x="220" y="45" width="30" height="130" fill={baseDeep} opacity="0.72" />

        {[300, 420, 540, 660].map((x, index) => (
          <g key={`top-module-${index}`}>
            <rect x={x} y="75" width="70" height="70" fill={baseDeep} rx="4" />
            <rect x={x + 5} y="80" width="60" height="18" fill={baseLight} opacity="0.24" rx="3" />
            <circle cx={x + 35} cy="110" r="25" fill={metal} />
            <circle cx={x + 35} cy="110" r="15" fill={baseDark} />
            <circle cx={x + 30} cy="105" r="7" fill={baseGlow} opacity="0.28" />
          </g>
        ))}
      </g>

      <rect
        x={orientation === 'horizontal' ? bogies.front.y : bogies.front.x}
        y={orientation === 'horizontal' ? bogies.front.x : bogies.front.y}
        width={orientation === 'horizontal' ? bogies.front.height : bogies.front.width}
        height={orientation === 'horizontal' ? bogies.front.width : bogies.front.height}
        rx="16"
        fill="none"
        stroke={theme.colors.primary}
        strokeWidth="2"
        strokeDasharray="8 6"
        opacity="0.65"
      />

      {bogies.rear && (
        <rect
          x={orientation === 'horizontal' ? bogies.rear.y : bogies.rear.x}
          y={orientation === 'horizontal' ? bogies.rear.x : bogies.rear.y}
          width={orientation === 'horizontal' ? bogies.rear.height : bogies.rear.width}
          height={orientation === 'horizontal' ? bogies.rear.width : bogies.rear.height}
          rx="16"
          fill="none"
          stroke={theme.colors.primary}
          strokeWidth="2"
          strokeDasharray="8 6"
          opacity="0.45"
        />
      )}

    </>
  );
}

function SideLocomotiveBody({ 
  wheelCount, 
  viewMode,
  orientation,
}: Pick<LocomotiveMapProps, 'wheelCount' | 'viewMode'> & OrientationProps) {
  const metrics = getDiagramMetrics(viewMode);
  const bogies = getBogieRanges(wheelCount, viewMode);
  const sideLabel = viewMode === 'left' ? 'COSTADO IZQUIERDO' : 'COSTADO DERECHO';
  const flipY = viewMode === 'right';

  const getTransform = () => {
    if (!flipY) return undefined;
    return orientation === 'horizontal'
      ? 'translate(760, 0) scale(-1, 1)'
      : 'translate(0, 760) scale(1, -1)';
  };

  const getRectProps = (x: number, y: number, w: number, h: number) => {
    const resolvedY = flipY ? (760 - y - h) : y;
    return orientation === 'horizontal'
      ? { x: resolvedY, y: x, width: h, height: w }
      : { x, y: resolvedY, width: w, height: h };
  };

  const getLineProps = (x1: number, y1: number, x2: number, y2: number) => {
    const resolvedY1 = flipY ? (760 - y1) : y1;
    const resolvedY2 = flipY ? (760 - y2) : y2;
    return orientation === 'horizontal'
      ? { x1: resolvedY1, y1: x1, x2: resolvedY2, y2: x2 }
      : { x1, y1: resolvedY1, x2, y2: resolvedY2 };
  };

  const getTextProps = (x: number, y: number) => {
    const resolvedY = flipY ? (760 - y) : y;
    return orientation === 'horizontal'
      ? { x: resolvedY, y: x }
      : { x, y: resolvedY };
  };

  const getCircleProps = (cx: number, cy: number, r: number) => {
    const resolvedY = flipY ? (760 - cy) : cy;
    return orientation === 'horizontal'
      ? { cx: resolvedY, cy: cx, r }
      : { cx, cy: resolvedY, r };
  };

  const d1 = orientation === 'horizontal'
    ? `M ${metrics.bodyY + 24} ${metrics.bodyX + 66}
       V ${metrics.bodyX + 166}
       H ${metrics.bodyY + metrics.bodyHeight - 30}
       V ${metrics.bodyX + 46}
       H ${metrics.bodyY + 280}
       L ${metrics.bodyY + 150} ${metrics.bodyX + 16}
       H ${metrics.bodyY + 82}
       L ${metrics.bodyY + 24} ${metrics.bodyX + 66}
       Z`
    : `M ${metrics.bodyX + 66} ${metrics.bodyY + 24}
       H ${metrics.bodyX + 166}
       V ${metrics.bodyY + metrics.bodyHeight - 30}
       H ${metrics.bodyX + 46}
       V ${metrics.bodyY + 280}
       L ${metrics.bodyX + 16} ${metrics.bodyY + 150}
       V ${metrics.bodyY + 82}
       L ${metrics.bodyX + 66} ${metrics.bodyY + 24}
       Z`;

  const d2 = "";

  const frenteX = flipY ? 696 : 72;
  const traseraX = flipY ? 72 : 696;
  const frenteY = flipY ? 696 : 72;
  const traseraY = flipY ? 72 : 696;

  return (
    <>
      {orientation === 'horizontal' ? (
        <>
          <text x={frenteX} y="210" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748B" className="select-none">
            {flipY ? 'FRENTE →' : '← FRENTE'}
          </text>
          <text x={traseraX} y="210" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748B" className="select-none">
            {flipY ? '← TRASERA' : 'TRASERA →'}
          </text>
        </>
      ) : (
        <>
          <text x="210" y={frenteY} textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748B" className="select-none">
            {flipY ? 'FRENTE ↓' : 'FRENTE ↑'}
          </text>
          <text x="210" y={traseraY} textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748B" className="select-none">
            {flipY ? 'TRASERA ↑' : 'TRASERA ↓'}
          </text>
        </>
      )}

      <path d={d1} fill="#F8FAFC" stroke="#475569" strokeWidth="2.4" transform={getTransform()} />
      {d2 ? <path d={d2} fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" transform={getTransform()} /> : null}

      {/* Cab Windows (horizontally side-by-side) */}
      <rect {...getRectProps(metrics.bodyX + 25, metrics.bodyY + 70, 18, 25)} rx="3" fill="#E2E8F0" stroke="#94A3B8" />
      <rect {...getRectProps(metrics.bodyX + 25, metrics.bodyY + 110, 18, 25)} rx="3" fill="#E2E8F0" stroke="#94A3B8" />
      <line {...getLineProps(metrics.bodyX + 166, metrics.bodyY + 24, metrics.bodyX + 166, metrics.bodyY + metrics.bodyHeight - 30)} stroke="#475569" strokeWidth="4" />

      {/* Cab Main Text */}
      <text 
        {...getTextProps(120, metrics.bodyY + 98)}
        textAnchor="middle" 
        fontSize="11" 
        fontWeight="800" 
        fill="#334155" 
        className="select-none"
      >
        CABINA
      </text>

      {/* Engine Compartment Body Rect */}
      <rect
        {...getRectProps(metrics.bodyX + 46, metrics.bodyY + 170, 120, 280)}
        rx="8"
        fill="#FFFFFF"
        stroke="#CBD5E1"
        strokeWidth="2"
      />

      {/* Vents (inside the engine compartment) */}
      {[0, 1, 2, 3].map(index => (
        <g key={`side-vent-${index}`}>
          <rect
            {...getRectProps(metrics.bodyX + 66, metrics.bodyY + 198 + index * 48, 80, 26)}
            rx="3"
            fill="#F1F5F9"
            stroke="#CBD5E1"
          />
          {[0, 1, 2, 3, 4].map(line => (
            <line
              key={`vent-line-${index}-${line}`}
              {...getLineProps(
                metrics.bodyX + 80 + line * 13,
                metrics.bodyY + 203 + index * 48,
                metrics.bodyX + 80 + line * 13,
                metrics.bodyY + 219 + index * 48
              )}
              stroke="#94A3B8"
              strokeWidth="2"
            />
          ))}
        </g>
      ))}

      {/* Fuel Tank (sits underneath the walkway line) */}
      <rect
        {...getRectProps(metrics.bodyX + 166, metrics.bodyY + 280, 40, 140)}
        rx="6"
        fill="#E2E8F0"
        stroke="#94A3B8"
      />
      <text 
        {...getTextProps(210, metrics.bodyY + 350)}
        textAnchor="middle" 
        fontSize="10" 
        fontWeight="800" 
        fill="#475569" 
        className="select-none"
      >
        TANQUE / BASTIDOR
      </text>

      <line {...getLineProps(metrics.bodyX + 166, metrics.bodyY + 28, metrics.bodyX + 166, metrics.bodyY + metrics.bodyHeight - 30)} stroke="#475569" strokeWidth="5" />
      <line {...getLineProps(metrics.bodyX + 180, metrics.bodyY + 48, metrics.bodyX + 180, metrics.bodyY + metrics.bodyHeight - 48)} stroke="#94A3B8" strokeWidth="3" strokeDasharray="12 8" />

      <text 
        {...getTextProps(120, metrics.bodyY + 310)}
        textAnchor="middle" 
        fontSize="12" 
        fontWeight="700" 
        fill="#64748B" 
        className="select-none"
      >
        {sideLabel}
      </text>

      <rect
        {...getRectProps(bogies.front.x, bogies.front.y, bogies.front.width, bogies.front.height)}
        rx="16"
        fill="none"
        stroke="#0B63CE"
        strokeWidth="2"
        strokeDasharray="8 6"
        opacity="0.65"
      />

      {bogies.rear && (
        <rect
          {...getRectProps(bogies.rear.x, bogies.rear.y, bogies.rear.width, bogies.rear.height)}
          rx="16"
          fill="none"
          stroke="#0B63CE"
          strokeWidth="2"
          strokeDasharray="8 6"
          opacity="0.45"
        />
      )}
    </>
  );
}

function SideLocomotiveBodyReferenceSvg({
  viewMode,
  orientation,
  theme,
  rotateForPortrait,
}: Pick<LocomotiveMapProps, 'wheelCount' | 'viewMode'> & OrientationProps & {
  theme: ReturnType<typeof resolveTheme>;
  rotateForPortrait?: boolean;
}) {
  const canvasWidth = orientation === 'horizontal' ? VIEWBOX_HEIGHT : VIEWBOX_WIDTH;
  const locoFill = theme.colors.primary;
  const locoShadow = theme.colors.machineStroke;
  const locoDark = theme.colors.machineStroke;
  const locoDeep = 'var(--loco-map-accent-shadow)';
  const locoHighlight = theme.colors.primarySoft;
  const locoSoftHighlight = 'var(--loco-map-accent-highlight)';
  const cutFill = theme.colors.background;
  const cutStroke = theme.colors.background;
  const sideScale = 0.51;
  const sideTranslateX = orientation === 'horizontal' ? 90 : -82;
  const sideTranslateY = 59;
  const sideTransform = viewMode === 'right'
    ? `translate(${canvasWidth} 0) scale(-1 1) translate(${sideTranslateX} ${sideTranslateY}) scale(${sideScale})`
    : `translate(${sideTranslateX} ${sideTranslateY}) scale(${sideScale})`;

  const portraitRotation = viewMode === 'right'
    ? 'translate(210 380) rotate(-90) translate(-210 -212)'
    : 'translate(210 380) rotate(90) translate(-210 -212)';

  return (
    <>
      <g transform={rotateForPortrait ? portraitRotation : undefined}>
        <g className="loco-map-body" transform={sideTransform}>
        <g opacity="0.18" transform="translate(8 28)">
          <path
            d="M88 276 H1050 C1076 276 1090 284 1104 300 H64 C72 288 78 282 88 276 Z"
            fill="#020617"
          />
        </g>
        <g opacity="0.34" transform="translate(0 16)">
          <path
            d="M72 224 H1072 V275 H1040 V266 H1032 L1028 257 H792 L787 266 H760 V275 H418 V266 H391 L386 257 H142 L137 266 H105 V275 H72 Z"
            fill={locoShadow}
          />
          <path d="M92 126 L111 72 H225 V52 H346 V74 H352 V138 H270 V224 H72 V150 H88 Z" fill={locoShadow} />
          <path d="M270 64 H530 V102 H570 L608 66 H1048 L1055 86 H1088 V225 H270 Z" fill={locoShadow} />
        </g>
        <g>
          <path d="M20 228 H42 V178 C42 170 48 165 54 165 C60 165 66 170 66 178 V228 H75 V236 H8 V228 Z" fill={locoFill} />
          <path d="M1082 228 H1091 V178 C1091 170 1097 165 1103 165 C1109 165 1115 170 1115 178 V228 H1137 V236 H1072 V228 Z" fill={locoFill} />
        </g>

        <g>
          <rect x="28" y="236" width="44" height="68" fill={locoFill} />
          <rect x="1067" y="236" width="44" height="68" fill={locoFill} />
          {[254, 274, 294].map(y => (
            <g key={`stairs-${y}`}>
              <line x1="28" y1={y} x2="72" y2={y} stroke={cutStroke} strokeWidth="5" strokeLinecap="square" />
              <line x1="1067" y1={y} x2="1111" y2={y} stroke={cutStroke} strokeWidth="5" strokeLinecap="square" />
            </g>
          ))}
        </g>

        <path
          d="M72 224 H1072 V275 H1040 V266 H1032 L1028 257 H792 L787 266 H760 V275 H418 V266 H391 L386 257 H142 L137 266 H105 V275 H72 Z"
          fill={locoFill}
        />
        <path d="M78 230 H1066 V244 H78 Z" fill={locoHighlight} opacity="0.34" />
        <path d="M86 218 H1060" fill="none" stroke={locoSoftHighlight} strokeWidth="4" opacity="0.28" strokeLinecap="round" />
        <path
          d="M72 266 H1072 V275 H1040 V266 H1032 L1028 257 H792 L787 266 H760 V275 H418 V266 H391 L386 257 H142 L137 266 H105 V275 H72 Z"
          fill={locoDeep}
          opacity="0.58"
        />
        <path d="M72 248 H1072 V258 H72 Z" fill={locoDark} opacity="0.24" />

        <g>
          <path d="M92 126 L111 72 H225 V52 H346 V74 H352 V138 H270 V224 H72 V150 H88 Z" fill={locoFill} />
          <path d="M96 132 L116 82 H225 V64 H342 V74 H348 V92 H112 L96 132 Z" fill={locoHighlight} opacity="0.38" />
          <path d="M76 184 H270 V224 H72 V150 H88 Z" fill={locoDeep} opacity="0.22" />
          <path d="M108 74 H226 V88 H102 Z" fill={locoSoftHighlight} opacity="0.34" />
          <path d="M92 126 L111 72" fill="none" stroke={cutStroke} strokeWidth="5" strokeLinecap="square" />
          <path d="M72 150 V210 L80 236" fill="none" stroke={cutStroke} strokeWidth="5" strokeLinecap="square" />
          <rect x="142" y="42" width="120" height="18" fill={locoFill} />
          <rect x="160" y="83" width="26" height="38" rx="3" fill={cutFill} />
          <rect x="190" y="83" width="28" height="38" rx="3" fill={cutFill} />
          <rect x="224" y="83" width="26" height="38" rx="3" fill={cutFill} />
        </g>

        <g>
          <path d="M270 64 H530 V102 H570 L608 66 H1048 L1055 86 H1088 V225 H270 Z" fill={locoFill} />
          <path d="M286 74 H520 V108 H566 L606 74 H1036 L1042 90 H1080 V104 H608 L570 140 H270 V74 Z" fill={locoHighlight} opacity="0.28" />
          <path d="M270 178 H1088 V225 H270 Z" fill={locoDeep} opacity="0.24" />
          <path d="M300 64 H530 V78 H300 Z M610 66 H1040 L1046 82 H600 Z" fill={locoSoftHighlight} opacity="0.32" />
          <path d="M570 102 L608 66" fill="none" stroke={cutStroke} strokeWidth="5" strokeLinecap="square" />

          <rect x="300" y="74" width="200" height="42" fill={cutFill} />
          {[306, 346, 386, 426, 466].map(x => (
            <rect key={`upper-left-panel-${x}`} x={x} y="74" width="34" height="38" fill={locoDark} opacity="0.78" />
          ))}

          <rect x="780" y="112" width="230" height="48" fill={cutFill} />
          <rect x="786" y="118" width="106" height="36" fill={locoDark} opacity="0.82" />
          <rect x="898" y="118" width="106" height="36" fill={locoDark} opacity="0.82" />

          <rect x="1030" y="154" width="70" height="70" fill={cutFill} />
          <rect x="1037" y="162" width="50" height="36" fill={locoFill} />
          {[1037, 1052, 1067, 1082].map(x => (
            <rect key={`right-grille-${x}`} x={x} y="204" width="9" height="21" fill={locoFill} />
          ))}
        </g>

        <path d="M70 110 H102 L91 134 H78 Z" fill={locoFill} />

        <g>
          <rect x="290" y="46" width="210" height="16" rx="2" fill={locoFill} />
          <rect x="640" y="50" width="44" height="8" rx="1" fill={locoFill} />
          <rect x="730" y="46" width="42" height="8" rx="1" fill={locoFill} />
          <rect x="845" y="42" width="68" height="8" rx="1" fill={locoFill} />
          <rect x="960" y="42" width="68" height="8" rx="1" fill={locoFill} />
          <rect x="1060" y="42" width="68" height="8" rx="1" fill={locoFill} />
        </g>

        <g>
          <line x1="270" y1="174" x2="1088" y2="174" stroke={cutStroke} strokeWidth="5" strokeLinecap="square" />
          <line x1="270" y1="224" x2="1088" y2="224" stroke={cutStroke} strokeWidth="5" strokeLinecap="square" />
          {[370, 438, 500, 570, 640, 712, 780, 850, 920, 990].map(x => (
            <line key={`lower-panel-${x}`} x1={x} y1="174" x2={x} y2="224" stroke={cutStroke} strokeWidth="5" strokeLinecap="square" />
          ))}
          <path d="M300 125 H448 L482 174" fill="none" stroke={cutStroke} strokeWidth="5" strokeLinecap="square" strokeLinejoin="round" />
          <path d="M300 65 V174" fill="none" stroke={cutStroke} strokeWidth="3" strokeLinecap="square" />
        </g>

        <g>
          <rect x="422" y="246" width="330" height="54" fill={locoFill} />
          <rect x="422" y="276" width="330" height="24" fill={locoDeep} opacity="0.5" />
          <rect x="432" y="250" width="310" height="8" fill={locoSoftHighlight} opacity="0.25" />
          <line x1="430" y1="246" x2="744" y2="246" stroke={cutStroke} strokeWidth="3" strokeLinecap="square" />
        </g>

        <g>
          <path d="M105 266 L114 256 H190 V248 H205 V256 H288 V248 H303 V256 H382 L392 266 V286 H105 Z" fill={locoFill} />
          <path d="M105 274 H392 V286 H105 Z" fill={locoDeep} opacity="0.48" />
          <path d="M175 286 H220 V304 H175 Z" fill={locoFill} />
          <path d="M270 286 H315 V304 H270 Z" fill={locoFill} />
          <line x1="105" y1="266" x2="392" y2="266" stroke={cutStroke} strokeWidth="3" strokeLinecap="square" />
        </g>

        <g>
          <path d="M790 266 L800 256 H872 V248 H887 V256 H966 V248 H981 V256 H1042 L1052 266 V286 H790 Z" fill={locoFill} />
          <path d="M790 274 H1052 V286 H790 Z" fill={locoDeep} opacity="0.48" />
          <path d="M862 286 H907 V304 H862 Z" fill={locoFill} />
          <path d="M958 286 H1003 V304 H958 Z" fill={locoFill} />
          <line x1="790" y1="266" x2="1052" y2="266" stroke={cutStroke} strokeWidth="3" strokeLinecap="square" />
        </g>
      </g>
    </g>
  </>
  );
}

function AxleGuides({ 
  wheelPoints, 
  viewMode,
  orientation,
}: { 
  wheelPoints: WheelPoint[]; 
  viewMode: LocomotiveMapProps['viewMode'];
  orientation: 'vertical' | 'horizontal';
}) {
  const visible = wheelPoints.filter(item => item.visible);
  const uniqueAxles = Array.from(new Set(visible.map(item => item.axleIndex)));

  if (viewMode !== 'top') return null;

  const getLineProps = (x1: number, y1: number, x2: number, y2: number) => {
    return orientation === 'horizontal'
      ? { x1: y1, y1: x1, x2: y2, y2: x2 }
      : { x1, y1, x2, y2 };
  };

  const getRectProps = (x: number, y: number, w: number, h: number) => {
    return orientation === 'horizontal'
      ? { x: y, y: x, width: h, height: w }
      : { x, y, width: w, height: h };
  };

  const getTextProps = (x: number, y: number) => {
    return orientation === 'horizontal'
      ? { x: y, y: x }
      : { x, y };
  };

  return (
    <>
      {uniqueAxles.map(axleIndex => {
        const sample = visible.find(item => item.axleIndex === axleIndex);
        if (!sample) return null;

        return (
          <g key={`axle-${axleIndex}`} opacity="0.9">
            {viewMode === 'top' ? (
              <line
                {...getLineProps(90, sample.y, 330, sample.y)}
                stroke="#94A3B8"
                strokeWidth="3"
                strokeDasharray="7 7"
              />
            ) : (
              <line
                {...getLineProps(122, sample.y, 298, sample.y)}
                stroke="#94A3B8"
                strokeWidth="3"
                strokeDasharray="7 7"
              />
            )}

            <rect {...getRectProps(22, sample.y - 16, 58, 32)} rx="8" fill="#FFFFFF" stroke="#CBD5E1" />
            <text 
              {...getTextProps(51, sample.y + 4)}
              textAnchor="middle" 
              fontSize="11" 
              fontWeight="800" 
              fill="#334155" 
              className="select-none"
            >
              {`EJE ${axleIndex}`}
            </text>
          </g>
        );
      })}
    </>
  );
}

function WheelNode({
  wheel,
  disabled,
  onWheelSelect,
  theme,
  viewMode,
  rotateCoordinates,
  sidePortraitMode,
}: {
  wheel: WheelPoint;
  disabled?: boolean;
  onWheelSelect?: LocomotiveMapProps['onWheelSelect'];
  theme: ReturnType<typeof resolveTheme>;
  viewMode: LocomotiveMapProps['viewMode'];
  rotateCoordinates: boolean;
  sidePortraitMode?: boolean;
}) {
  const stroke = getStatusStroke(theme, wheel.visualStatus);
  const fill = getStatusFill(theme, wheel.visualStatus);
  const canPress = !disabled && wheel.status !== 'disabled';
  const completed = wheel.status === 'completed';
  const pending = wheel.status === 'available';
  const locked = wheel.status === 'disabled';
  const selected = wheel.visualStatus === 'selected';
  const compactSideWheel = viewMode !== 'top';
  const detailedWheel = true;
  const hitRadius = compactSideWheel ? 43 : 48;
  const sideLabelOffset = compactSideWheel ? 47 : 48;
  const axleLabelOffset = compactSideWheel ? 65 : 64;
  const outerWheelRadius = detailedWheel ? wheel.radius + 11 : wheel.radius + 6;
  const tireRadius = detailedWheel ? wheel.radius + 6 : wheel.radius;
  const innerWheelRadius = detailedWheel ? Math.max(10, wheel.radius - 4) : 9;

  const getCircleProps = (cx: number, cy: number, r: number) => {
    return rotateCoordinates
      ? { cx: cy, cy: cx, r }
      : { cx, cy, r };
  };

  const getTextProps = (x: number, y: number) => {
    return rotateCoordinates
      ? { x: y, y: x }
      : { x, y };
  };
  const getPoint = (x: number, y: number) => {
    return rotateCoordinates ? { x: y, y: x } : { x, y };
  };
  const wheelPoint = getPoint(wheel.x, wheel.y);
  const topLabelWidth = 64;
  const topLabelHeight = 26;
  const topLabelCenter = rotateCoordinates
    ? {
        x: wheelPoint.x,
        y: wheelPoint.y + (wheel.side === 'left' ? -54 : 54),
      }
    : {
        x: wheelPoint.x + (wheel.side === 'left' ? -58 : 58),
        y: wheelPoint.y,
      };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (canPress) onWheelSelect?.(wheel);
  };

  return (
    <g
      onClick={canPress ? handleClick : undefined}
      className={[
        'loco-wheel-node',
        canPress ? 'can-press cursor-pointer' : '',
        selected ? 'is-selected' : '',
        completed ? 'is-completed' : '',
        locked ? 'is-locked' : '',
        'select-none',
      ].filter(Boolean).join(' ')}
    >
      {detailedWheel ? (
        <circle
          {...getCircleProps(wheel.x, wheel.y + 7, outerWheelRadius + 4)}
          fill="#020617"
          opacity="0.18"
        />
      ) : null}
      <circle
        {...getCircleProps(wheel.x, wheel.y, outerWheelRadius)}
        fill={detailedWheel ? 'var(--loco-map-wheel-rim)' : theme.colors.surface}
        stroke={detailedWheel ? 'var(--loco-map-wheel-tire)' : theme.colors.border}
        strokeWidth={detailedWheel ? 5 : 2}
      />
      {detailedWheel ? (
        <circle
          {...getCircleProps(wheel.x, wheel.y, tireRadius)}
          fill="var(--loco-map-wheel-tire)"
          stroke={selected ? theme.colors.primary : theme.colors.border}
          strokeWidth={selected ? 4 : 2}
        />
      ) : null}
      <circle
        {...getCircleProps(wheel.x, wheel.y, wheel.radius)}
        fill={detailedWheel ? theme.colors.surface : fill}
        stroke={stroke}
        strokeWidth={selected ? 6 : completed ? 5 : 4}
        strokeDasharray={pending ? '8 6' : undefined}
      />
      <circle
        {...getCircleProps(wheel.x - 5, wheel.y - 6, Math.max(8, wheel.radius - 7))}
        fill={theme.colors.surfaceMuted}
        opacity={detailedWheel ? 0.9 : 0}
      />
      <circle
        {...getCircleProps(wheel.x, wheel.y, innerWheelRadius)}
        fill={detailedWheel ? theme.colors.textMuted : stroke}
        stroke={detailedWheel ? stroke : undefined}
        strokeWidth={detailedWheel ? 2 : undefined}
        opacity={pending && !detailedWheel ? 0.35 : 1}
      />
      {locked ? (
        <g transform={`translate(${getPoint(wheel.x, wheel.y).x} ${getPoint(wheel.x, wheel.y).y})`}>
          <path
            d="M -7 -2 V-7 A 7 7 0 0 1 7 -7 V-2"
            fill="none"
            stroke={theme.colors.disabled}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <rect
            x="-10"
            y="-3"
            width="20"
            height="16"
            rx="4"
            fill={theme.colors.disabled}
            stroke={theme.colors.surface}
            strokeWidth="2"
          />
          <circle cx="0" cy="4" r="2" fill={theme.colors.surface} />
          <rect x="-1" y="5" width="2" height="4" rx="1" fill={theme.colors.surface} />
        </g>
      ) : null}
      {completed ? (
        <>
          <circle {...getCircleProps(wheel.x + 21, wheel.y - 22, 14)} fill={theme.colors.success} stroke={theme.colors.surface} strokeWidth="3" />
          <g transform={`translate(${getPoint(wheel.x + 21, wheel.y - 22).x} ${getPoint(wheel.x + 21, wheel.y - 22).y})`}>
            <path
              d="M -6 0 L -2 5 L 7 -6"
              fill="none"
              stroke={theme.colors.surface}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </>
      ) : pending ? (
        <text {...getTextProps(wheel.x, wheel.y + 5)} textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="900" fill={detailedWheel ? theme.colors.text : stroke}>
          PEND
        </text>
      ) : null}
      {completed ? (
        <g transform={`translate(${getPoint(wheel.x, wheel.y).x} ${getPoint(wheel.x, wheel.y).y})`}>
          <path
            d="M -7 0 L -2 6 L 8 -7"
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : null}
      {sidePortraitMode ? (
        <>
          <text x={wheel.x + 38} y={wheel.y - 4} textAnchor="start" fontFamily="sans-serif" fontSize="11" fontWeight="900" fill={theme.colors.text} className="select-none">
            {wheel.side === 'left' ? 'IZQ' : 'DER'}
          </text>
          <text x={wheel.x + 38} y={wheel.y + 11} textAnchor="start" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill={theme.colors.textMuted} className="select-none">
            {`Eje ${wheel.axleIndex}`}
          </text>
        </>
      ) : (
        <>
          {compactSideWheel ? (
            <>
              <rect
                {...(rotateCoordinates
                  ? { x: wheel.y + sideLabelOffset - 13, y: wheel.x - 24, width: 26, height: 48 }
                  : { x: wheel.x - 24, y: wheel.y + sideLabelOffset - 13, width: 48, height: 26 })}
                rx="8"
                fill={theme.colors.surface}
                stroke={theme.colors.border}
                strokeWidth="1"
              />
              <text {...getTextProps(wheel.x, wheel.y + sideLabelOffset + 4)} textAnchor="middle" fontFamily="sans-serif" fontSize="10" fontWeight="900" fill={theme.colors.text} className="select-none">
                {`EJE ${wheel.axleIndex}`}
              </text>
            </>
          ) : (
            <>
              <rect
                x={topLabelCenter.x - topLabelWidth / 2}
                y={topLabelCenter.y - topLabelHeight / 2}
                width={topLabelWidth}
                height={topLabelHeight}
                rx="8"
                fill={theme.colors.surface}
                stroke={theme.colors.border}
                strokeWidth="1"
              />
              <text
                x={topLabelCenter.x}
                y={topLabelCenter.y + 4}
                textAnchor="middle"
                fontFamily="sans-serif"
                fontSize="10"
                fontWeight="900"
                fill={theme.colors.text}
                className="select-none"
              >
                {`${wheel.side === 'left' ? 'IZQ' : 'DER'} E${wheel.axleIndex}`}
              </text>
            </>
          )}
        </>
      )}
      <circle
        {...getCircleProps(wheel.x, wheel.y, hitRadius)}
        fill="transparent"
        stroke="transparent"
        strokeWidth="1"
      />
    </g>
  );
}

export function LocomotiveWheelMap({
  wheelCount,
  viewMode,
  selectedWheelId,
  wheels = [],
  disabled,
  theme: customTheme,
  labels: customLabels,
  showLabels = true,
  orientation = 'vertical',
  onWheelSelect,
}: LocomotiveMapProps) {
  const resolvedTheme = resolveTheme(customTheme);
  const theme = customTheme
    ? resolvedTheme
    : {
        ...resolvedTheme,
        colors: {
          ...resolvedTheme.colors,
          background: 'var(--loco-map-cut)',
          surface: 'var(--loco-map-surface)',
          surfaceMuted: 'var(--loco-map-surface-muted)',
          border: 'var(--loco-map-border)',
          primary: 'var(--loco-map-accent)',
          primarySoft: 'var(--loco-map-accent-soft)',
          success: 'var(--loco-map-accent-deep)',
          successSoft: 'var(--loco-map-accent-soft)',
          disabled: 'var(--loco-map-disabled)',
          disabledSoft: 'var(--loco-map-surface)',
          text: 'var(--loco-map-text)',
          textMuted: 'var(--loco-map-muted)',
          rail: 'var(--loco-map-rail)',
          machineStroke: 'var(--loco-map-accent-deep)',
          machineFill: 'var(--loco-map-accent)',
        },
      };
  const labels = resolveLabels(customLabels);
  
  const sidePortraitMode = viewMode !== 'top' && orientation === 'vertical';
  const transformSidePortraitWheel = (wheel: WheelPoint): WheelPoint => {
    if (!sidePortraitMode) return wheel;

    const baseCenterX = 210;
    const baseCenterY = 212;
    const portraitCenterX = 210;
    const portraitCenterY = 380;
    const dx = wheel.x - baseCenterX;
    const dy = wheel.y - baseCenterY;
    const clockwise = viewMode === 'left';

    return {
      ...wheel,
      x: clockwise ? portraitCenterX - dy : portraitCenterX + dy,
      y: clockwise ? portraitCenterY + dx : portraitCenterY - dx,
    };
  };

  const renderOrientation = orientation;
  const wheelPoints = getWheelPoints(wheelCount, viewMode, selectedWheelId, wheels, renderOrientation);
  const renderedWheelPoints = wheelPoints.map(transformSidePortraitWheel);
  const visibleWheels = renderedWheelPoints.filter(wheel => wheel.visible);
  const rotateWheelCoordinates = viewMode === 'top' && renderOrientation === 'horizontal';
  const compactHorizontalSide = viewMode !== 'top' && renderOrientation === 'horizontal';

  const widthVal = renderOrientation === 'horizontal' ? VIEWBOX_HEIGHT : VIEWBOX_WIDTH;
  const heightVal = renderOrientation === 'horizontal' ? VIEWBOX_WIDTH : VIEWBOX_HEIGHT;
  const renderedHeight = compactHorizontalSide
    ? 300
    : renderOrientation === 'horizontal'
      ? 380
      : 640;

  const topHorizontalMode = viewMode === 'top' && renderOrientation === 'horizontal';
  const getTitleProps = () => {
    if (topHorizontalMode) return { x: 24, y: 22 };
    return renderOrientation === 'horizontal'
      ? { x: VIEWBOX_HEIGHT / 2, y: 34 }
      : { x: VIEWBOX_WIDTH / 2, y: 34 };
  };

  const getSubTitleProps = () => {
    if (topHorizontalMode) return { x: 24, y: 40 };
    return renderOrientation === 'horizontal'
      ? { x: VIEWBOX_HEIGHT / 2, y: 54 }
      : { x: VIEWBOX_WIDTH / 2, y: 54 };
  };

  const getInstructionProps = () => {
    return renderOrientation === 'horizontal'
      ? { x: VIEWBOX_HEIGHT / 2, y: VIEWBOX_WIDTH - 20 }
      : { x: VIEWBOX_WIDTH / 2, y: VIEWBOX_HEIGHT - 30 };
  };

  return (
    <svg 
      viewBox={`0 0 ${widthVal} ${heightVal}`} 
      width="100%" 
      height={renderedHeight}
      className="loco-map-root mx-auto block"
    >
      <style>
        {`
          .loco-map-root {
            --loco-map-text: #0f172a;
            --loco-map-muted: #64748b;
            --loco-map-cut: #f8fafc;
            --loco-map-surface: #ffffff;
            --loco-map-surface-muted: #f1f5f9;
            --loco-map-border: #cbd5e1;
            --loco-map-rail: #94a3b8;
            --loco-map-accent: #059669;
            --loco-map-accent-deep: #047857;
            --loco-map-accent-soft: #d1fae5;
            --loco-map-accent-shadow: #064e3b;
            --loco-map-accent-highlight: #a7f3d0;
            --loco-map-disabled: #64748b;
            --loco-map-wheel-rim: #e5e7eb;
            --loco-map-wheel-tire: #1f2937;
          }
          .loco-map-body {
            animation: locoMapBodyEnter 220ms cubic-bezier(0.22, 1, 0.36, 1);
            will-change: opacity;
          }
          .loco-wheel-node {
            transition: opacity 160ms ease, filter 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
            transform-box: fill-box;
            transform-origin: center;
            will-change: transform, opacity;
          }
          .loco-wheel-node.can-press:hover {
            filter: drop-shadow(0 8px 12px rgba(15, 23, 42, 0.16));
            transform: translateY(-1.5px) scale(1.025);
          }
          .loco-wheel-node.can-press:active {
            filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.12));
            transform: scale(0.985);
          }
          .loco-wheel-node.is-selected {
            filter: drop-shadow(0 0 10px color-mix(in srgb, var(--loco-map-accent) 46%, transparent));
          }
          .loco-wheel-node.is-completed {
            filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.1));
          }
          .loco-wheel-node.is-locked {
            opacity: 0.78;
          }
          @keyframes locoMapBodyEnter {
            from {
              opacity: 0.88;
            }
            to {
              opacity: 1;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .loco-map-body,
            .loco-wheel-node {
              animation: none;
              transition: none;
            }
          }
          .dark .loco-map-root {
            --loco-map-text: #f8fafc;
            --loco-map-muted: #cbd5e1;
            --loco-map-cut: #020617;
            --loco-map-surface: #0f172a;
            --loco-map-surface-muted: #1e293b;
            --loco-map-border: #475569;
            --loco-map-rail: #94a3b8;
            --loco-map-accent: #34d399;
            --loco-map-accent-deep: #6ee7b7;
            --loco-map-accent-soft: #064e3b;
            --loco-map-accent-shadow: #022c22;
            --loco-map-accent-highlight: #bbf7d0;
            --loco-map-disabled: #94a3b8;
            --loco-map-wheel-rim: #cbd5e1;
            --loco-map-wheel-tire: #020617;
          }
        `}
      </style>
      <text
        {...getTitleProps()}
        textAnchor={topHorizontalMode ? 'start' : 'middle'}
        fontFamily="sans-serif"
        fontSize="13"
        fontWeight="900"
        letterSpacing="0"
        fill={theme.colors.text}
        className="select-none"
      >
        {titleForView(viewMode)}
      </text>

      <text
        {...getSubTitleProps()}
        textAnchor={topHorizontalMode ? 'start' : 'middle'}
        fontFamily="sans-serif"
        fontSize="10"
        fontWeight="700"
        fill={theme.colors.textMuted}
        className="select-none"
      >
        {`${wheelCount} ruedas torneables - ${wheelCount / 2} ejes`}
      </text>

      {viewMode === 'top' ? (
        <TopLocomotiveBody wheelCount={wheelCount} viewMode={viewMode} orientation={renderOrientation} theme={theme} />
      ) : (
        <SideLocomotiveBodyReferenceSvg
          wheelCount={wheelCount}
          viewMode={viewMode}
          orientation={renderOrientation}
          theme={theme}
          rotateForPortrait={sidePortraitMode}
        />
      )}

      <AxleGuides wheelPoints={renderedWheelPoints} viewMode={viewMode} orientation={renderOrientation} />

      {visibleWheels.map(wheel => (
        <WheelNode
          key={wheel.id}
          wheel={wheel}
          disabled={disabled}
          onWheelSelect={onWheelSelect}
          theme={theme}
          viewMode={viewMode}
          rotateCoordinates={rotateWheelCoordinates}
          sidePortraitMode={sidePortraitMode}
        />
      ))}

      {showLabels && (
        <text {...getInstructionProps()} textAnchor="middle" fontSize="11" fill={theme.colors.textMuted} className="select-none">
          {labels.instructions}
        </text>
      )}
    </svg>
  );
}
export default LocomotiveWheelMap;
