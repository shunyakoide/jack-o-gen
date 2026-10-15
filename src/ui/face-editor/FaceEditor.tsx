// 顔パーツを 2D 展開図上でドラッグして位置・大きさ・回転を調整するエディタ。ペンで形を描き足すこともできる。
// 座標は直径 120mm 基準の mm（x：赤道に沿った弧長、y：赤道からの弧長、上が +）。
import { useEffect, useMemo, useRef, useState } from 'react';
import { crossesCenter, finishLine, finishStroke, LINE_WIDTH, mirrorX, placeDrawn, toDrawn } from '../../geometry/face/draw';
import { partPolygons } from '../../geometry/face/layout';
import type { Pt } from '../../geometry/face/presets';
import { applySymmetry, drawnIndex, drawnKey, PART_KEYS, type PartBox, type PartKey, type SelKey } from '../../model/params';
import { useStore } from '../../state/store';
import { useT } from '../../i18n';
import { holdGesture } from '../gesture';

const VB = { x: -95, y: -58, w: 190, h: 116 };

type Drag =
  | { mode: 'move'; key: SelKey; sx: number; sy: number; part: PartBox; flip: boolean }
  | { mode: 'scale'; key: SelKey; part: PartBox; min: number }
  | { mode: 'rotate'; key: SelKey; part: PartBox };

/** 表示する 1 つの形。鏡像の写しは flip（ドラッグの左右が逆になる） */
interface Item {
  key: SelKey;
  box: PartBox;
  d: string;
  line: number;
  flip: boolean;
}

function pathOf(polys: Pt[][], closed = true): string {
  return polys.map((p) => 'M' + p.map(([x, y]) => `${x.toFixed(2)},${(-y).toFixed(2)}`).join('L') + (closed ? 'Z' : '')).join('');
}

export function FaceEditor() {
  const face = useStore((s) => s.params.face);
  const ribs = useStore((s) => s.params.ribs);
  const twist = useStore((s) => s.params.twist);
  const diameter = useStore((s) => s.params.diameter);
  const rEqReal = useStore((s) => s.preview?.stats.rEq);
  const problems = useStore((s) => s.preview?.faceProblems);
  const selected = useStore((s) => s.selectedPart);
  const pen = useStore((s) => s.pen);
  const setPen = useStore((s) => s.setPen);
  const setPart = useStore((s) => s.setPart);
  const selectPart = useStore((s) => s.selectPart);
  const addDrawn = useStore((s) => s.addDrawn);
  const removeDrawn = useStore((s) => s.removeDrawn);
  const t = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // 描いている途中の点列はイベントごとに ref へ足す（state だと描画の合間に来たイベントが古い値を見る）。ink は表示用の写し
  const inkRef = useRef<Pt[] | null>(null);
  const [ink, setInk] = useState<Pt[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (pen === 'off') return;
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setPen('off');
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [pen, setPen]);

  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(id);
  }, [msg]);

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

  const items: Item[] = [];
  for (const key of PART_KEYS) {
    const { holes, islands } = partPolygons(key, shown[key], 1);
    if (holes.length) items.push({ key, box: shown[key], d: pathOf([...holes, ...islands]), line: 0, flip: false });
  }
  face.drawn.forEach((dp, i) => {
    placeDrawn(dp).forEach((poly, j) => {
      items.push({ key: drawnKey(i), box: dp, d: pathOf([poly], dp.line === 0), line: dp.line, flip: j === 1 });
    });
  });

  // 選択中の形の枠（undo などで消えていれば枠を出さない）
  const di = drawnIndex(selected);
  const selDrawn = di >= 0 ? face.drawn[di] : undefined;
  const selPart = di < 0 ? shown[selected as PartKey] : undefined;
  const sel: PartBox | null = selDrawn ?? (selPart?.preset !== 'none' ? selPart ?? null : null);

  const toLocal = (e: { clientX: number; clientY: number }): [number, number] => {
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
    holdGesture(e);
    setDrag(d);
  };

  const startInk = (e: React.PointerEvent) => {
    if (pen === 'off' || e.button > 0) return;
    svgRef.current!.setPointerCapture(e.pointerId);
    inkRef.current = [toLocal(e)];
    setInk(inkRef.current);
  };

  const endInk = () => {
    const raw = inkRef.current;
    if (!raw) return;
    inkRef.current = null;
    setInk(null);
    const line = pen === 'line';
    const poly = line ? finishLine(raw) : finishStroke(raw);
    if (!poly) return setMsg(t('drawTooSmall'));
    if (!addDrawn(toDrawn(poly, line ? LINE_WIDTH : 0, face.symmetric && !crossesCenter(poly)))) setMsg(t('drawFull'));
  };

  const onMove = (e: React.PointerEvent) => {
    const raw = inkRef.current;
    if (raw) {
      // 速くなぞっても角が欠けないよう、間引かれたイベントも拾う
      const evs = e.nativeEvent.getCoalescedEvents?.() ?? [];
      const n = raw.length;
      for (const ev of evs.length ? evs : [e.nativeEvent]) {
        const q = toLocal(ev);
        const last = raw[raw.length - 1];
        if (Math.hypot(q[0] - last[0], q[1] - last[1]) > 0.5) raw.push(q);
      }
      if (raw.length > n) setInk([...raw]);
      return;
    }
    if (!drag) return;
    const [x, y] = toLocal(e);
    const p = drag.part;
    if (drag.mode === 'move') {
      const s = drag.flip ? -1 : 1;
      setPart(drag.key, { x: round(p.x + s * (x - drag.sx)), y: round(p.y + y - drag.sy) });
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
        setPart(drag.key, { w: clamp(round(Math.abs(lx) * 2), drag.min, 120), h: clamp(round(Math.abs(ly) * 2), drag.min, 120) });
      }
    }
  };

  // 矢印キーで選択パーツを 1mm（Shift で 5mm）ずつ動かす。押し続けた分は 1 手にまとめる。Delete で描いた形を消す
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selDrawn) {
      e.preventDefault();
      removeDrawn(di);
      return;
    }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (!d || !sel) return;
    e.preventDefault();
    holdGesture(e);
    const k = e.shiftKey ? 5 : 1;
    setPart(selected, { x: sel.x + d[0] * k, y: sel.y + d[1] * k });
  };

  const selRot = ((sel?.rot ?? 0) * Math.PI) / 180;
  const corner: [number, number] = sel ? rotate(sel.w / 2, -sel.h / 2, selRot) : [0, 0];
  const knob: [number, number] = sel ? rotate(0, sel.h / 2 + 7, selRot) : [0, 0];
  const ghost = ink && face.symmetric && !crossesCenter(ink);

  return (
    <svg
      ref={svgRef}
      className={`face-editor ${drag ? 'dragging' : ''} ${pen !== 'off' ? 'pen' : ''}`}
      tabIndex={0}
      onKeyDown={onKey}
      viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      onPointerDown={startInk}
      onPointerMove={onMove}
      onPointerUp={() => {
        setDrag(null);
        endInk();
      }}
      onPointerCancel={() => {
        setDrag(null);
        inkRef.current = null;
        setInk(null);
      }}
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
      {items.map((it, i) => (
        <path
          key={i}
          d={it.d}
          fillRule={it.line ? undefined : it.key[0] === 'd' ? 'nonzero' : 'evenodd'}
          className={`fe-part ${it.line ? 'line' : ''} ${it.key === selected ? 'selected' : ''}`}
          style={it.line ? { strokeWidth: it.line } : undefined}
          onPointerDown={(e) => {
            const [x, y] = toLocal(e);
            start(e, { mode: 'move', key: it.key, sx: x, sy: y, part: it.box, flip: it.flip });
          }}
        />
      ))}
      {!!problems?.length && <path d={pathOf(problems)} fillRule="evenodd" className="fe-problem" />}
      {ink && ink.length > 1 && (
        <>
          <path d={pathOf([ink], pen === 'fill')} className={`fe-ink ${pen}`} style={pen === 'line' ? { strokeWidth: LINE_WIDTH } : undefined} />
          {ghost && (
            <path d={pathOf([mirrorX(ink)], pen === 'fill')} className={`fe-ink ghost ${pen}`} style={pen === 'line' ? { strokeWidth: LINE_WIDTH } : undefined} />
          )}
        </>
      )}
      {msg && (
        <text x={VB.x + VB.w / 2} y={VB.y + VB.h - 6} className="fe-msg" textAnchor="middle">
          {msg}
        </text>
      )}
      {pen === 'off' && sel && (
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
          <Handle
            at={corner}
            className="fe-handle"
            onPointerDown={(e) => start(e, { mode: 'scale', key: selected, part: sel, min: selDrawn?.line ? 1 : 4 })}
          />
          <Handle
            at={knob}
            className="fe-handle rot"
            onPointerDown={(e) => start(e, { mode: 'rotate', key: selected, part: sel })}
            onDoubleClick={() => setPart(selected, { rot: 0 })}
          />
        </g>
      )}
    </svg>
  );
}

/** 見た目は小さい丸、当たり判定は指でつかめる大きさ */
function Handle({ at, className, ...on }: { at: [number, number]; className: string } & React.SVGProps<SVGCircleElement>) {
  return (
    <g className={className}>
      <circle cx={at[0]} cy={-at[1]} r={7} className="fe-hit" {...on} />
      <circle cx={at[0]} cy={-at[1]} r={2.6} pointerEvents="none" />
    </g>
  );
}

function rotate(x: number, y: number, a: number): [number, number] {
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}
const round = (v: number) => Math.round(v * 2) / 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
