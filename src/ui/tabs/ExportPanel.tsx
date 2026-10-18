import { useEffect, useRef, useState } from 'react';
import { boxOf, partSize, type Vec3 } from '../../geometry/layout';
import { zipStore } from '../../geometry/zip';
import { useT } from '../../i18n';
import { useStore } from '../../state/store';
import { callWorker, WorkerTimeout } from '../../worker/client';
import { CheckList } from '../CheckBadge';
import { LedNotice } from './LedNotice';

function download(buf: ArrayBuffer, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([buf], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ExportPanel() {
  const t = useT();
  const params = useStore((s) => s.params);
  const preview = useStore((s) => s.preview);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  // ネイティブ <dialog> の showModal で Esc・フォーカス閉じ込め・背景の不活性化をブラウザに任せる
  useEffect(() => {
    if (!confirm) return;
    dialog.current?.showModal();
    cancel.current?.focus();
  }, [confirm]);
  const red = preview?.level === 'red';
  const name = `jack-o-gen-lantern-${params.seed}`;
  // ダウンロードされるファイルと大きさ（ヘタは seatZ を底面として測る）
  // 色分けは 3MF 1 つにパーツとしてまとまるので 行の名前はパーツ名
  const inlay = !!preview?.face;
  const files: [string, Vec3][] = preview
    ? [[inlay ? `${name}.3mf` : `${name}.stl`, [preview.stats.width, preview.stats.depth, preview.stats.height]]]
    : [];
  if (preview?.face) files.push([`+ ${t('facePart')}`, partSize(boxOf(preview.face.positions))]);
  if (preview?.stem) files.push([inlay ? `+ ${t('stemPart')}` : `${name}-stem.stl`, partSize(boxOf(preview.stem.positions), preview.stem.seatZ)]);

  const doExport = async () => {
    setConfirm(false);
    setBusy(true);
    setMsg(null);
    try {
      const { files, result } = await callWorker((g) => g.exportFiles(params), 120_000);
      if (result.level === 'red') {
        setMsg(t('exportRed'));
      } else {
        // 複数ファイルはブラウザが 2 本目をブロックするので zip 1 つにまとめる
        if (files.length > 1) download(zipStore(files.map((f) => ({ name: `${name}${f.suffix}`, data: f.data }))), `${name}.zip`, 'application/zip');
        else if (files[0].suffix === '.3mf') download(files[0].data, `${name}.3mf`, 'model/3mf');
        else download(files[0].data, `${name}.stl`, 'model/stl');
        setMsg(t('exportDone', { n: result.stats.triangles.toLocaleString(), s: (result.stats.ms / 1000).toFixed(1) }));
      }
    } catch (e) {
      setMsg(e instanceof WorkerTimeout ? t('exportTimeout') : t('exportFail', { e: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export">
      {preview && (
        <ul className="file-list" aria-label={t('files')}>
          {files.map(([f, [w, d, h]]) => (
            <li key={f}>
              <span className="file-name">{f}</span>
              <span>{t('sizeMm', { w: w.toFixed(0), d: d.toFixed(0), h: h.toFixed(0) })}</span>
            </li>
          ))}
        </ul>
      )}
      <button className="primary" disabled={busy || red || !preview} onClick={() => setConfirm(true)}>
        {busy ? t('generating') : red ? t('blocked') : t(inlay ? 'download3mf' : 'download')}
      </button>
      {msg && <p className="hint">{msg}</p>}
      <p className="hint">{t('exportHint')}</p>
      {preview && (
        <details className="advanced" open={preview.level !== 'green'} key={preview.level}>
          <summary>
            {t('checksTitle')} — {t(`level.${preview.level}`)}
          </summary>
          <CheckList />
        </details>
      )}
      {confirm && (
        <dialog ref={dialog} className="modal" aria-labelledby="led-title" onClose={() => setConfirm(false)}>
          <h3 id="led-title">{t('beforeDownload')}</h3>
          <LedNotice />
          <p>{t('useLed')}</p>
          <div className="modal-actions">
            <button ref={cancel} onClick={() => setConfirm(false)}>
              {t('cancel')}
            </button>
            <button className="primary" onClick={doExport}>
              {t('agree')}
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
