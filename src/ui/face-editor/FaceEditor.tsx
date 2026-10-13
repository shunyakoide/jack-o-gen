// 顔パーツを 2D 展開図上でドラッグして位置・大きさ・回転を調整するエディタ。
// 座標は直径 120mm 基準の mm（x：赤道に沿った弧長、y：赤道からの弧長、上が +）。
import { useMemo, useRef, useState } from 'react';
import { partPolygons } from '../../geometry/face/layout';
import { applySymmetry, PART_KEYS, type FacePart, type PartKey } from '../../model/params';
import { useStore } from '../../state/store';
import { useT } from '../../i18n';

const VB = { x: -95, y: -58, w: 190, h: 116 };

type Drag =
  | { mode: 'move'; key: PartKey; sx: number; sy: number; part: FacePart }
  | { mode: 'scale'; key: PartKey; part: FacePart }
  | { mode: 'rotate'; key: PartKey; part: FacePart };

function pathOf(polys: [number, number][][]): string {
  return polys.map((p) => 'M' + p.map(([x, y]) => `${x.toFixed(2)},${(-y).toFixed(2)}`).join('L') + 'Z').join('');
}

export function FaceEditor() {
  const face = useStore((s) => s.params.face);
  const ribs = useStore((s) => s.params.ribs);
  const twist = useStore((s) => s.params.twist);
  const diameter = useStore((s) => s.params.diameter);
  const rEqReal = useStore((s) => s.preview?.stats.rEq);
  const selected = useStore((s) => s.selectedPart);
  const setPart = useStore((s) => s.setPart);
  const selectPart = useStore((s) => s.selectPart);
  const t = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const shown = applySymmetry(face);
  const R = rEqReal ? (rEqReal * 120) / diameter : 58;

  const grooves = useMemo(() => {
    const tau = (twist * Math.PI) / 180;
    const lines: string[] = [];
    for (let k = 0; k < ribs; k++) {
      const pts: string[] = [];
      let prevX: number | null = null;
      for (let i = 0; i <= 40; i++) {
        const y = VB.y + (VB.h * i) / 40;
        const beta = -y / R;
        let th = (2 * Math.PI * (k + 0.5)) / ribs + (tau * Math.sin(beta)) / 2;
        th = ((th + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        const x = th * R;
        const cmd = prevX === null || Math.abs(x - prevX) > 20 ? 'M' : 'L';
        pts.push(`${cmd}${x.toFixed(1)},${y.toFixed(1)}`);
        prevX = x;
      }
      lines.push(pts.join(''));
    }
    return lines;
  }, [ribs, twist, R]);

  const toLocal = (e: React.PointerEvent): [number, number] => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return [p.x, -p.y];
  };

  const start = (e: React.PointerEvent, d: Drag) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    selectPart(d.key);
    setDrag(d);
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const [x, y] = toLocal(e);
    const p = drag.part;
    if (drag.mode === 'move') {
      setPart(drag.key, { x: round(p.x + x - drag.sx), y: round(p.y + y - drag.sy) });
    } else {
      const dx = x - p.x;
      const dy = y - p.y;
      if (drag.mode === 'rotate') {
        const a = (Math.atan2(dy, dx) * 180) / Math.PI - 90;
        setPart(drag.key, { rot: Math.round(((a + 540) % 360) - 180) });
      } else {
        const a = (-p.rot * Math.PI) / 180;
        const lx = dx * Math.cos(a) - dy * Math.sin(a);
        const ly = dx * Math.sin(a) + dy * Math.cos(a);
        setPart(drag.key, { w: clamp(round(Math.abs(lx) * 2), 4, 120), h: clamp(round(Math.abs(ly) * 2), 4, 120) });
      }
    }
  };

  const sel = shown[selected];
  const selRot = (sel.rot * Math.PI) / 180;
  const corner = rotate(sel.w / 2, -sel.h / 2, selRot);
  const knob = rotate(0, sel.h / 2 + 7, selRot);

  return (
    <svg
      ref={svgRef}
      className="face-editor"
      viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      onPointerMove={onMove}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
      role="application"
      aria-label={t('faceEditor')}
    >
      <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} className="fe-bg" />
      {grooves.map((d, i) => (
        <path key={i} d={d} className="fe-groove" />
      ))}
      <line x1={VB.x} x2={VB.x + VB.w} y1={0} y2={0} className="fe-axis" />
      <line x1={0} x2={0} y1={VB.y} y2={VB.y + VB.h} className="fe-axis" />
      {[-1, 1].map((s) => (
        <line key={s} x1={(s * Math.PI * R) / 2} x2={(s * Math.PI * R) / 2} y1={VB.y} y2={VB.y + VB.h} className="fe-side" />
      ))}
      <text x={VB.x + 3} y={VB.y + 7} className="fe-label">{t('faceMap')}</text>
      <text x={(Math.PI * R) / 2 - 2} y={VB.y + 7} className="fe-label" textAnchor="end">{t('faceSide')}</text>
      {PART_KEYS.map((key) => {
        const { holes, islands } = partPolygons(key, shown[key], 1);
        if (!holes.length) return null;
        return (
          <path
            key={key}
            d={pathOf([...holes, ...islands])}
            fillRule="evenodd"
            className={`fe-part ${key === selected ? 'selected' : ''}`}
            onPointerDown={(e) => {
              const [x, y] = toLocal(e);
              start(e, { mode: 'move', key, sx: x, sy: y, part: shown[key] });
            }}
          />
        );
      })}
      {sel.preset !== 'none' && (
        <g transform={`translate(${sel.x},${-sel.y})`}>
          <rect
            x={-sel.w / 2}
            y={-sel.h / 2}
            width={sel.w}
            height={sel.h}
            transform={`rotate(${-sel.rot})`}
            className="fe-box"
          />
          <line x1={0} y1={0} x2={knob[0]} y2={-knob[1]} className="fe-box" />
          <circle
            cx={corner[0]}
            cy={-corner[1]}
            r={2.6}
            className="fe-handle"
            onPointerDown={(e) => start(e, { mode: 'scale', key: selected, part: sel })}
          />
          <circle
            cx={knob[0]}
            cy={-knob[1]}
            r={2.6}
            className="fe-handle rot"
            onPointerDown={(e) => start(e, { mode: 'rotate', key: selected, part: sel })}
          />
        </g>
      )}
    </svg>
  );
}

function rotate(x: number, y: number, a: number): [number, number] {
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}
const round = (v: number) => Math.round(v * 2) / 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
