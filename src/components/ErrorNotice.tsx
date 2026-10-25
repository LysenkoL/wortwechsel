import { Link } from 'react-router-dom';
import { ruAiError } from '../i18n/ru';
import type { DescribedError } from '../features/aiErrorText';

export function ErrorNotice({ error, onRetry }: { error: DescribedError; onRetry?: () => void }) {
  return (
    <div className="card" role="alert">
      <p className="error">{error.text}</p>
      {error.detail && <p className="muted small">{error.detail}</p>}
      <div className="row">
        {error.toSettings && <Link className="btn" to="/settings">{ruAiError.toSettings}</Link>}
        {error.retryable && onRetry && <button type="button" className="btn" onClick={onRetry}>{ruAiError.retry}</button>}
      </div>
    </div>
  );
}
