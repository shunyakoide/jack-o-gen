import { useState } from 'react';
import { useStore } from '../../state/store';
import { geometry } from '../../worker/client';
import { LEVEL_TEXT } from '../CheckBadge';
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
  const params = useStore((s) => s.params);
  const preview = useStore((s) => s.preview);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const red = preview?.level === 'red';
  const name = `jack-o-gen-${params.mode === 'lantern' ? 'lantern' : 'sealed'}-${params.seed}.stl`;

  const doExport = async () => {
    setConfirm(false);
    setBusy(true);
    setMsg(null);
    try {
      const { stl, result } = await geometry().exportStl(params);
      if (result.level === 'red') {
        setMsg('高解像度の生成結果が出力不可の判定になりました。チェック結果を確認してください。');
      } else {
        download(stl, name);
        setMsg(`書き出しました（${result.stats.triangles.toLocaleString()} 面、${(result.stats.ms / 1000).toFixed(1)} 秒）`);
      }
    } catch (e) {
      setMsg(`書き出しに失敗しました：${String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export">
      {preview && (
        <dl className="stats">
          <dt>サイズ</dt>
          <dd>
            {preview.stats.width.toFixed(0)} × {preview.stats.depth.toFixed(0)} × {preview.stats.height.toFixed(0)} mm
          </dd>
          <dt>判定</dt>
          <dd className={preview.level}>{LEVEL_TEXT[preview.level]}</dd>
        </dl>
      )}
      <p className="hint">書き出し時は高解像度で作り直してから CSG を実行します（数秒かかります）。想定：Bambu Lab A1・ノズル0.4mm・PLA。</p>
      <button className="primary" disabled={busy || red || !preview} onClick={() => (params.mode === 'lantern' ? setConfirm(true) : doExport())}>
        {busy ? '生成中…' : red ? '出力不可の項目があります' : 'STLをダウンロード'}
      </button>
      {msg && <p className="hint">{msg}</p>}
      {confirm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="led-title">
          <div className="modal">
            <h3 id="led-title">ダウンロードの前に</h3>
            <LedNotice />
            <p>中には必ず LED キャンドルを使ってください。</p>
            <div className="modal-actions">
              <button onClick={() => setConfirm(false)}>キャンセル</button>
              <button className="primary" onClick={doExport}>
                理解してダウンロード
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
