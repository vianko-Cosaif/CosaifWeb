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
}: Pick<LocomotiveMapProps, 'wheelCount' | 'viewMode'> & OrientationProps) {
  const metrics = getDiagramMetrics(viewMode);
  const bogies = getBogieRanges(wheelCount, viewMode);

  const getRectProps = (x: number, y: number, w: number, h: number) => {
    return orientation === 'horizontal'
      ? { x: y, y: x, width: h, height: w }
      : { x, y, width: w, height: h };
  };

  const getCircleProps = (cx: number, cy: number, r: number) => {
    return orientation === 'horizontal'
      ? { cx: cy, cy: cx, r }
      : { cx, cy, r };
  };

  const getTextProps = (x: number, y: number) => {
    return orientation === 'horizontal'
      ? { x: y, y: x }
      : { x, y };
  };

  return (
    <>
      {orientation === 'horizontal' ? (
        <text x="72" y="210" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748B" className="select-none">
          ← FRENTE
        </text>
      ) : (
        <text x="210" y="72" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748B" className="select-none">
          FRENTE ↑
        </text>
      )}

      <rect
        {...getRectProps(metrics.bodyX, metrics.bodyY, metrics.bodyWidth, metrics.bodyHeight)}
        rx="28"
        fill="#F8FAFC"
        stroke="#475569"
        strokeWidth="2"
      />

      <rect
        {...getRectProps(metrics.bodyX + 10, metrics.bodyY + 12, metrics.bodyWidth - 20, 88)}
        rx="14"
        fill="#FFFFFF"
        stroke="#CBD5E1"
        strokeWidth="2"
      />

      <text 
        {...getTextProps(210, metrics.bodyY + 62)}
        textAnchor="middle" 
        fontSize="13" 
        fontWeight="800" 
        fill="#334155" 
        className="select-none"
      >
        CABINA
      </text>

      <rect
        {...getRectProps(metrics.bodyX + 22, metrics.bodyY + 142, metrics.bodyWidth - 44, 248)}
        rx="14"
        fill="#FFFFFF"
        stroke="#CBD5E1"
        strokeWidth="2"
      />

      <text 
        {...getTextProps(210, metrics.bodyY + 260)}
        textAnchor="middle" 
        fontSize="12" 
        fontWeight="700" 
        fill="#64748B" 
        className="select-none"
      >
        MOTOR
      </text>

      {[0, 1, 2].map(index => (
        <circle
          key={index}
          {...getCircleProps(210, metrics.bodyY + 190 + index * 64, 20)}
          fill="#F1F5F9"
          stroke="#94A3B8"
          strokeWidth="1.5"
        />
      ))}

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

      {orientation === 'horizontal' ? (
        <text x="696" y="210" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748B" className="select-none">
          TRASERA →
        </text>
      ) : (
        <text x="210" y="696" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748B" className="select-none">
          TRASERA ↓
        </text>
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
  const sideLabel = viewMode === 'left' ? 'COSTADO IZQUIERDO' : 'COSTADO DERECHO';
  const canvasWidth = orientation === 'horizontal' ? VIEWBOX_HEIGHT : VIEWBOX_WIDTH;
  const locoFill = theme.colors.text;
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
      <text x={canvasWidth / 2} y="84" textAnchor="middle" fontSize="12" fontWeight="900" fill={theme.colors.text} className="select-none">
        {sideLabel}
      </text>

      <g transform={rotateForPortrait ? portraitRotation : undefined}>
        <g transform={sideTransform}>
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

        <g>
          <path d="M92 126 L111 72 H225 V52 H346 V74 H352 V138 H270 V224 H72 V150 H88 Z" fill={locoFill} />
          <path d="M92 126 L111 72" fill="none" stroke={cutStroke} strokeWidth="5" strokeLinecap="square" />
          <path d="M72 150 V210 L80 236" fill="none" stroke={cutStroke} strokeWidth="5" strokeLinecap="square" />
          <rect x="142" y="42" width="120" height="18" fill={locoFill} />
          <rect x="160" y="83" width="26" height="38" rx="3" fill={cutFill} />
          <rect x="190" y="83" width="28" height="38" rx="3" fill={cutFill} />
          <rect x="224" y="83" width="26" height="38" rx="3" fill={cutFill} />
        </g>

        <g>
          <path d="M270 64 H530 V102 H570 L608 66 H1048 L1055 86 H1088 V225 H270 Z" fill={locoFill} />
          <path d="M570 102 L608 66" fill="none" stroke={cutStroke} strokeWidth="5" strokeLinecap="square" />

          <rect x="300" y="74" width="200" height="42" fill={cutFill} />
          {[306, 346, 386, 426, 466].map(x => (
            <rect key={`upper-left-panel-${x}`} x={x} y="74" width="34" height="38" fill={locoFill} />
          ))}

          <rect x="780" y="112" width="230" height="48" fill={cutFill} />
          <rect x="786" y="118" width="106" height="36" fill={locoFill} />
          <rect x="898" y="118" width="106" height="36" fill={locoFill} />

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
          <line x1="430" y1="246" x2="744" y2="246" stroke={cutStroke} strokeWidth="3" strokeLinecap="square" />
        </g>

        <g>
          <path d="M105 266 L114 256 H190 V248 H205 V256 H288 V248 H303 V256 H382 L392 266 V286 H105 Z" fill={locoFill} />
          <path d="M175 286 H220 V304 H175 Z" fill={locoFill} />
          <path d="M270 286 H315 V304 H270 Z" fill={locoFill} />
          <line x1="105" y1="266" x2="392" y2="266" stroke={cutStroke} strokeWidth="3" strokeLinecap="square" />
        </g>

        <g>
          <path d="M790 266 L800 256 H872 V248 H887 V256 H966 V248 H981 V256 H1042 L1052 266 V286 H790 Z" fill={locoFill} />
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
  const selected = wheel.visualStatus === 'selected';
  const compactSideWheel = viewMode !== 'top';
  const hitRadius = compactSideWheel ? 37 : 48;
  const sideLabelOffset = compactSideWheel ? 40 : 45;
  const axleLabelOffset = compactSideWheel ? 54 : 59;

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

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (canPress) onWheelSelect?.(wheel);
  };

  return (
    <g
      onClick={canPress ? handleClick : undefined}
      className={canPress ? 'cursor-pointer select-none' : 'select-none'}
    >
      <circle
        {...getCircleProps(wheel.x, wheel.y, wheel.radius)}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 6 : completed ? 5 : 3}
        strokeDasharray={pending ? '8 6' : undefined}
      />
      <circle
        {...getCircleProps(wheel.x, wheel.y, 9)}
        fill={stroke}
        opacity={pending ? 0.35 : 1}
      />
      {completed ? (
        <>
          <circle {...getCircleProps(wheel.x + 21, wheel.y - 22, 14)} fill={theme.colors.success} stroke="#FFFFFF" strokeWidth="2" />
          <text {...getTextProps(wheel.x + 21, wheel.y - 17)} textAnchor="middle" fontSize="14" fontWeight="900" fill="#FFFFFF">
            OK
          </text>
        </>
      ) : pending ? (
        <text {...getTextProps(wheel.x, wheel.y + 5)} textAnchor="middle" fontSize="9" fontWeight="900" fill={stroke}>
          PEND
        </text>
      ) : null}
      {completed ? (
        <text {...getTextProps(wheel.x, wheel.y + 5)} textAnchor="middle" fontSize="10" fontWeight="900" fill={stroke}>
          OK
        </text>
      ) : null}
      {sidePortraitMode ? (
        <>
          <text x={wheel.x + 38} y={wheel.y - 4} textAnchor="start" fontSize="10" fontWeight="800" fill={theme.colors.text} className="select-none">
            {wheel.side === 'left' ? 'IZQ' : 'DER'}
          </text>
          <text x={wheel.x + 38} y={wheel.y + 10} textAnchor="start" fontSize="10" fill={theme.colors.textMuted} className="select-none">
            {`Eje ${wheel.axleIndex}`}
          </text>
        </>
      ) : (
        <>
          <text {...getTextProps(wheel.x, wheel.y + sideLabelOffset)} textAnchor="middle" fontSize="10" fontWeight="800" fill={theme.colors.text} className="select-none">
            {wheel.side === 'left' ? 'IZQ' : 'DER'}
          </text>
          <text {...getTextProps(wheel.x, wheel.y + axleLabelOffset)} textAnchor="middle" fontSize="10" fill={theme.colors.textMuted} className="select-none">
            {`Eje ${wheel.axleIndex}`}
          </text>
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
          text: 'var(--loco-map-text)',
          textMuted: 'var(--loco-map-muted)',
          rail: 'var(--loco-map-rail)',
          machineStroke: 'var(--loco-map-text)',
          machineFill: 'var(--loco-map-surface-muted)',
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

  const widthVal = renderOrientation === 'horizontal' ? VIEWBOX_HEIGHT : VIEWBOX_WIDTH;
  const heightVal = renderOrientation === 'horizontal' ? VIEWBOX_WIDTH : VIEWBOX_HEIGHT;

  const getTitleProps = () => {
    return renderOrientation === 'horizontal'
      ? { x: VIEWBOX_HEIGHT / 2, y: 34 }
      : { x: VIEWBOX_WIDTH / 2, y: 34 };
  };

  const getSubTitleProps = () => {
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
      height={renderOrientation === 'horizontal' ? 380 : 640} 
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
          }
          .dark .loco-map-root {
            --loco-map-text: #f8fafc;
            --loco-map-muted: #cbd5e1;
            --loco-map-cut: #020617;
            --loco-map-surface: #0f172a;
            --loco-map-surface-muted: #1e293b;
            --loco-map-border: #475569;
            --loco-map-rail: #94a3b8;
          }
        `}
      </style>
      <text {...getTitleProps()} textAnchor="middle" fontSize="14" fontWeight="800" fill={theme.colors.text} className="select-none">
        {titleForView(viewMode)}
      </text>

      <text {...getSubTitleProps()} textAnchor="middle" fontSize="11" fill={theme.colors.textMuted} className="select-none">
        {`${wheelCount} ruedas torneables · ${wheelCount / 2} ejes`}
      </text>

      {viewMode === 'top' ? (
        <TopLocomotiveBody wheelCount={wheelCount} viewMode={viewMode} orientation={renderOrientation} />
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
