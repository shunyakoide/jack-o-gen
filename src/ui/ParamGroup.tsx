import type { ReactNode } from 'react';
import { NUM_DEFS, type NumParams, type TabId } from '../model/params';
import { ParamSlider } from './ParamSlider';

/** タブの基本項目を表示し、残りは「詳細」に畳む */
export function ParamGroup({ tab, exclude = [], extraAdvanced }: { tab: TabId; exclude?: (keyof NumParams)[]; extraAdvanced?: ReactNode }) {
  const defs = NUM_DEFS.filter((d) => d.tab === tab && !exclude.includes(d.key));
  const basic = defs.filter((d) => !d.advanced);
  const adv = defs.filter((d) => d.advanced);
  return (
    <>
      {basic.map((d) => (
        <ParamSlider key={d.key} k={d.key} />
      ))}
      {(adv.length > 0 || extraAdvanced) && (
        <details className="advanced">
          <summary>詳細</summary>
          {adv.map((d) => (
            <ParamSlider key={d.key} k={d.key} />
          ))}
          {extraAdvanced}
        </details>
      )}
    </>
  );
}
