import type { ReactNode } from 'react';
import { useT } from '../i18n';
import { NUM_DEFS, type GroupId, type NumParams } from '../model/params';
import { ParamSlider } from './ParamSlider';

/** グループの基本項目を並べ、残りは「More」に畳む */
export function ParamGroup({ group, exclude = [], title, children }: { group: GroupId; exclude?: (keyof NumParams)[]; title?: boolean; children?: ReactNode }) {
  const t = useT();
  const defs = NUM_DEFS.filter((d) => d.group === group && !d.hidden && !exclude.includes(d.key));
  const basic = defs.filter((d) => !d.advanced);
  const adv = defs.filter((d) => d.advanced);
  return (
    <section className="group">
      {title && <h3 className="group-title">{t(`group.${group}`)}</h3>}
      {children}
      {basic.map((d) => (
        <ParamSlider key={d.key} k={d.key} />
      ))}
      {adv.length > 0 && (
        <details className="advanced">
          <summary>{t('more')}</summary>
          {adv.map((d) => (
            <ParamSlider key={d.key} k={d.key} />
          ))}
        </details>
      )}
    </section>
  );
}
