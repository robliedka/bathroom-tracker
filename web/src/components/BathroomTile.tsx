import { useMemo, useRef, useState } from 'react';
import type { BathroomReport, BathroomSummary } from '../types';
import { Chart24h } from './Chart24h';

type Props = {
  bathroom: BathroomSummary;
  onReport: (bathroomId: string, status: 'available' | 'unavailable', notes?: string) => Promise<void>;
  onToggleSubscription: (bathroomId: string, subscribe: boolean) => Promise<void>;
  onViewReports: (bathroomId: string) => Promise<BathroomReport[]>;
  onDelete: (bathroomId: string) => Promise<void>;
};

export function BathroomTile({ bathroom, onReport, onToggleSubscription, onViewReports, onDelete }: Props) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [reportsBusy, setReportsBusy] = useState(false);
  const [reports, setReports] = useState<BathroomReport[]>([]);
  const hoverTimerRef = useRef<number | null>(null);
  const lastRequestIdRef = useRef(0);

  const statusClass = useMemo(() => `status-dot status-${bathroom.statusColor}`, [bathroom.statusColor]);

  function formatReportTime(utcIso: string) {
    const date = new Date(utcIso);
    return date.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  async function submit(status: 'available' | 'unavailable') {
    setBusy(true);
    try {
      await onReport(bathroom.id, status, notes);
      setNotes('');
    } finally {
      setBusy(false);
    }
  }

  async function loadReports() {
    const requestId = ++lastRequestIdRef.current;
    setReportsBusy(true);
    try {
      const loaded = await onViewReports(bathroom.id);
      if (requestId !== lastRequestIdRef.current) return;
      setReports(loaded);
    } finally {
      if (requestId !== lastRequestIdRef.current) return;
      setReportsBusy(false);
    }
  }

  function openReportsSoon() {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = window.setTimeout(() => {
      setReportsOpen(true);
      loadReports().catch(() => undefined);
    }, 160);
  }

  function closeReports() {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setReportsOpen(false);
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
            onMouseEnter={openReportsSoon}
            onMouseLeave={closeReports}
            onFocus={() => {
              setReportsOpen(true);
              loadReports().catch(() => undefined);
            }}
            onBlur={closeReports}
            onClick={() => {
              setReportsOpen((prev) => {
                const next = !prev;
                if (next) {
                  loadReports().catch(() => undefined);
                }
                return next;
              });
            }}
            className="reports-btn"
            title="View recent reports"
            aria-expanded={reportsOpen}
          >
            Reports
          </button>
          {reportsOpen && (
            <div className="reports-popover" role="tooltip" onMouseEnter={openReportsSoon} onMouseLeave={closeReports}>
              <div className="reports-title">Last 5 reports</div>
              {reportsBusy ? (
                <div className="reports-muted">Loading...</div>
              ) : reports.length === 0 ? (
                <div className="reports-muted">No recent reports.</div>
              ) : (
                <div className="reports-list">
                  {[...reports].reverse().map((report) => (
                    <div key={report.id} className="reports-item">
                      <div className="reports-item-head">
                        <span className={report.status === 'unavailable' ? 'reports-pill reports-pill-bad' : 'reports-pill reports-pill-good'}>
                          {report.status}
                        </span>
                        <span className="reports-time">{formatReportTime(report.createdAtUtc)}</span>
                      </div>
                      <div className="reports-who">by {report.reporterName}</div>
                      {report.notes ? <div className="reports-notes">{report.notes}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
