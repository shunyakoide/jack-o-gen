import { useT } from '../../i18n';

export function LedNotice() {
  const t = useT();
  return (
    <p className="notice warn">
      ⚠ <b>{t('ledNoticeStrong')}</b> {t('ledNotice')}
    </p>
  );
}
