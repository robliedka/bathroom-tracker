import { useMemo, useState } from 'react';
import type { BathroomSummary } from '../types';
import { Chart24h } from './Chart24h';

type Props = {
  bathroom: BathroomSummary;
  onReport: (bathroomId: string, status: 'available' | 'unavailable', notes?: string) => Promise<void>;
  onToggleSubscription: (bathroomId: string, subscribe: boolean) => Promise<void>;
  onDelete: (bathroomId: string) => Promise<void>;
};

export function BathroomTile({ bathroom, onReport, onToggleSubscription, onDelete }: Props) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const statusClass = useMemo(() => `status-dot status-${bathroom.statusColor}`, [bathroom.statusColor]);

  async function submit(status: 'available' | 'unavailable') {
    setBusy(true);
    try {
      await onReport(bathroom.id, status, notes);
      setNotes('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="tile">
      <header className="tile-header">
        <div>
          <h3>{bathroom.name}</h3>
          <p>{bathroom.location || 'No location details'}</p>
        </div>
        <div className="status-wrap">
          <span className={statusClass} />
          <span className="status-label">{bathroom.statusLabel}</span>
        </div>
      </header>

      <Chart24h points={bathroom.last24Hours} />

      <div className="tile-actions">
        <button disabled={busy} onClick={() => submit('available')} className="good-btn">Report Available</button>
        <button disabled={busy} onClick={() => submit('unavailable')} className="bad-btn">Report Unavailable</button>
      </div>

      <input
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Optional notes"
        className="notes"
      />

      <footer className="tile-footer">
        <div className="tile-footer-actions">
          <button
            onClick={() => onToggleSubscription(bathroom.id, !bathroom.isSubscribed)}
            className="sub-btn"
          >
            {bathroom.isSubscribed ? 'Unsubscribe' : 'Subscribe'}
          </button>
          <button
            disabled={busy}
            onClick={() => onDelete(bathroom.id)}
            className="danger-btn"
            title="Delete bathroom"
          >
            Delete
          </button>
        </div>
        <small>Updated {new Date(bathroom.lastUpdatedUtc).toLocaleTimeString()}</small>
      </footer>
    </article>
  );
}
