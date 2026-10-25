import { Link } from 'react-router-dom';

interface Props { emoji: string; title: string; text: string; to?: string; cta?: string }

export function EmptyState({ emoji, title, text, to, cta }: Props) {
  return (
    <div className="empty">
      <div className="empty-emoji" aria-hidden="true">{emoji}</div>
      <h2>{title}</h2>
      <p className="muted">{text}</p>
      {to && cta && <Link className="btn primary" to={to}>{cta}</Link>}
    </div>
  );
}
