import { useState } from 'react';
import { useStore } from '../state/store';
import { useT } from '../i18n';
import type { TabId } from '../model/params';

export function CheckBadge() {
  const t = useT();
  const preview = useStore((s) => s.preview);
  const setTab = useStore((s) => s.setTab);
  if (!preview) return <span className="badge pending">{t('checking')}</span>;
  return (
    <button className={`badge ${preview.level}`} onClick={() => setTab('print')} title={t('seeChecks')}>
      <span className="dot" aria-hidden />
      {t(`level.${preview.level}`)}
    </button>
  );
}

/** 警告ごとに、直し方に書いた操作があるタブ。ここにない判定は形タブ */
const FIX_TAB: Record<string, TabId> = {
  'manifold.parts': 'face',
  'base.ledTooBig': 'print',
  'hole.tiny': 'face',
  'hole.thin': 'face',
  'link.merged': 'face',
  'link.narrow': 'face',
};

/** problems=true は黄・赤だけを出す（プレビューの右上に常に重ねる用）。押すと直し方のあるタブへ移る */
export function CheckList({ problems = false }: { problems?: boolean }) {
  const t = useT();
  const preview = useStore((s) => s.preview);
  const setTab = useStore((s) => s.setTab);
  const selectPart = useStore((s) => s.selectPart);
  const symmetric = useStore((s) => s.params.face.symmetric);
  // スマホでは項目名だけにたたみ、押すたびに直し方の表示を開閉する（かぼちゃを隠さないため）
  const [open, setOpen] = useState(false);
  const items = preview?.checks.filter((c) => !problems || c.level !== 'green') ?? [];
  if (!items.length) return null;
  return (
    <ul className={problems ? `checks floating${open ? ' open' : ''}` : 'checks'} aria-label={problems ? t('checksTitle') : undefined}>
      {items.map((c) => {
        const body = (
          <>
            <span className="dot" aria-hidden />
            <div>
              <div className="check-label">{t(`check.${c.id}`, c.vars)}</div>
              <div className="check-detail">
                {t(`check.${c.id}.${c.detail}`, c.vars)}
                {!!c.parts?.length && (
                  <span className="check-parts">
                    {[...new Set(c.parts.map((k) => (k[0] === 'd' ? 'part.drawn' : symmetric && k.startsWith('eye') ? 'part.eyes' : `part.${k}`)))].map((k) => t(k)).join('・')}
                  </span>
                )}
              </div>
              {c.level !== 'green' && <div className="check-fix">{t(`check.${c.id}.${c.detail}.fix`, c.vars)}</div>}
            </div>
          </>
        );
        return (
          <li key={c.id} className={c.level}>
            {problems ? (
              <button
                type="button"
                onClick={() => {
                  setTab(FIX_TAB[`${c.id}.${c.detail}`] ?? 'shape');
                  // 原因が複数あれば押すたびに次のパーツを選ぶ。対称のときは右目を左目（両目のボタン）として扱う
                  const ps = [...new Set((c.parts ?? []).map((k) => (symmetric && k === 'eyeR' ? 'eyeL' : k)))];
                  if (ps.length) selectPart(ps[(ps.indexOf(useStore.getState().selectedPart) + 1) % ps.length]);
                  setOpen(!open);
                }}
              >
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
