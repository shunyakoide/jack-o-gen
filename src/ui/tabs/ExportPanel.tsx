import { useState } from 'react';
import { useT } from '../../i18n';
import { useStore } from '../../state/store';
import { geometry } from '../../worker/client';
import { CheckList } from '../CheckBadge';
import { LedNotice } from './LedNotice';

function download(buf: ArrayBuffer, name: string) {
  const url = URL.createObjectURL(new Blob([buf], { type: 'model/stl' }));
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
  const red = preview?.level === 'red';
  const name = `jack-o-gen-${params.mode === 'lantern' ? 'lantern' : 'sealed'}-${params.seed}`;

  const doExport = async () => {
    setConfirm(false);
    setBusy(true);
    setMsg(null);
    try {
      const { files, result } = await geometry().exportStl(params);
      if (result.level === 'red') {
        setMsg(t('exportRed'));
      } else {
        for (const f of files) download(f.stl, `${name}${f.suffix}.stl`);
        setMsg(t('exportDone', { n: result.stats.triangles.toLocaleString(), s: (result.stats.ms / 1000).toFixed(1) }));
      }
    } catch (e) {
      setMsg(t('exportFail', { e: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export">
      {preview && (
        <p className="size-line">
          {t('size')}: {preview.stats.width.toFixed(0)} × {preview.stats.depth.toFixed(0)} × {preview.stats.height.toFixed(0)} mm
        </p>
      )}
      <button className="primary" disabled={busy || red || !preview} onClick={() => (params.mode === 'lantern' ? setConfirm(true) : doExport())}>
        {busy ? t('generating') : red ? t('blocked') : t('download')}
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
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="led-title">
          <div className="modal">
            <h3 id="led-title">{t('beforeDownload')}</h3>
            <LedNotice />
            <p>{t('useLed')}</p>
            <div className="modal-actions">
              <button onClick={() => setConfirm(false)}>{t('cancel')}</button>
              <button className="primary" onClick={doExport}>
                {t('agree')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
