import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { fetchInbox, startSample, uploadPdf, type SampleKey } from '../api';
import StatusChip from '../components/StatusChip';
import { useToast } from '../toast';
import type { InboxItem } from '../types';
import { errorMessage, fieldText, formatWhen } from '../utils';

const SAMPLES: {
  key: SampleKey;
  title: string;
  body: string;
  accent?: boolean;
}[] = [
  {
    key: 'clean',
    title: 'Clean invoice',
    body: 'Totals already match - the happy path.',
  },
  {
    key: 'mismatch',
    title: 'Totals mismatch',
    body: 'Wrong total on purpose so you can review and fix it.',
    accent: true,
  },
  {
    key: 'missing',
    title: 'Missing invoice #',
    body: 'No invoice number. The validator should flag it.',
  },
  {
    key: 'euro',
    title: 'Euro vendor',
    body: 'A Paris studio invoice in EUR, different vendor and tax.',
  },
  {
    key: 'baddate',
    title: 'Bad date',
    body: 'Date is “next Friday” - not a real date.',
  },
];

const PAGE_SIZE = 10;

export default function Inbox() {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [ready, setReady] = useState(false);
  const sentinelRef = useRef<HTMLLIElement | null>(null);
  const loadingRef = useRef(false);
  const offsetRef = useRef(0);
  const hasMoreRef = useRef(true);

  const loadPage = useCallback(
    async (replace = false) => {
      if (loadingRef.current) return;
      if (!replace && !hasMoreRef.current) return;
      loadingRef.current = true;
      setLoadingMore(true);
      const nextOffset = replace ? 0 : offsetRef.current;
      try {
        const data = await fetchInbox({ limit: PAGE_SIZE, offset: nextOffset });
        const page = data.items || [];
        setItems((current) => (replace ? page : [...current, ...page]));
        offsetRef.current = nextOffset + page.length;
        setTotal(data.total || 0);
        hasMoreRef.current = offsetRef.current < (data.total || 0);
        setHasMore(hasMoreRef.current);
        setError('');
      } catch (err) {
        console.error('[inbox] load failed', err);
        const message = errorMessage(err);
        setError(message);
        toast.error(message);
      } finally {
        loadingRef.current = false;
        setLoadingMore(false);
        setReady(true);
      }
    },
    [toast],
  );

  useEffect(() => {
    loadPage(true);
  }, [loadPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadPage(false);
      },
      { rootMargin: '120px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadPage, items.length, ready]);

  async function onSample(key: SampleKey) {
    setBusy(true);
    setError('');
    try {
      const result = await startSample(key);
      toast.info(`Started ${key} sample`);
      navigate(`/jobs/${result.job.id}`);
    } catch (err) {
      console.error('[inbox] sample failed', err);
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const result = await uploadPdf(file);
      toast.info(`Uploaded ${file.name}`);
      navigate(`/jobs/${result.job.id}`);
    } catch (err) {
      console.error('[inbox] upload failed', err);
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Inbox</p>
          <h1>Invoices</h1>
          <p className="lede">Extract, review uncertain fields, then trust the record.</p>
        </div>
      </header>

      <section className="action-block">
        <p className="action-help">
          Use a built-in sample to see the product, or upload your own digital invoice PDF.
        </p>
        <div className="action-grid">
          {SAMPLES.map((sample) => (
            <button
              key={sample.key}
              type="button"
              className={`action-card${sample.accent ? ' action-card-accent' : ''}`}
              disabled={busy}
              title={`Run the ${sample.title} sample`}
              onClick={() => onSample(sample.key)}
            >
              <span className="action-kicker">Sample</span>
              <strong>{sample.title}</strong>
              <p>{sample.body}</p>
            </button>
          ))}
          <label
            className={`action-card upload ${busy ? 'is-disabled' : ''}`}
            title="Choose a PDF from your computer"
          >
            <span className="action-kicker">Your file</span>
            <strong>Upload PDF</strong>
            <p>Pick an invoice from your computer. Digital PDF, max 10MB.</p>
            <input type="file" accept="application/pdf" onChange={onUpload} disabled={busy} />
          </label>
        </div>
      </section>

      {error ? <p className="banner error">{error}</p> : null}

      {!ready ? (
        <p className="muted">Loading recent invoices…</p>
      ) : items.length === 0 ? (
        <div className="empty">
          <p className="eyebrow">Get started</p>
          <h2>No invoices yet</h2>
          <p>
            Start with a sample. Mismatch, missing number, and bad date show why a person has to
            review.
          </p>
        </div>
      ) : (
        <section className="list-panel">
          <div className="list-panel-head">
            <h2>Recent</h2>
            <span className="muted">
              {items.length}
              {total > items.length ? ` of ${total}` : ''} record
              {total === 1 ? '' : 's'} · newest first
            </span>
          </div>
          <ul className="invoice-list">
            {items.map((item) => {
              const when = formatWhen(item.createdAt);
              const title = fieldText(item.vendor) || item.filename;
              const subtitle =
                item.vendor && item.vendor !== item.filename
                  ? item.filename
                  : item.source === 'sample'
                    ? 'Built-in sample'
                    : 'Uploaded PDF';
              return (
                <li key={`${item.type}-${item.id}`}>
                  <button
                    type="button"
                    className="invoice-row"
                    onClick={() =>
                      navigate(
                        item.type === 'invoice' ? `/invoices/${item.id}` : `/jobs/${item.jobId}`,
                      )
                    }
                  >
                    <span className="invoice-avatar" aria-hidden="true">
                      {(title || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <div className="invoice-copy">
                      <strong>{title}</strong>
                      <p>{subtitle}</p>
                      {item.errorMessage ? <p className="muted">{item.errorMessage}</p> : null}
                    </div>
                    <time
                      className="invoice-when"
                      dateTime={item.createdAt}
                      title={when.time ? `${when.date} ${when.time}` : undefined}
                    >
                      <span>{when.date}</span>
                      <span>{when.time}</span>
                    </time>
                    <span className="invoice-status">
                      <StatusChip status={item.status} />
                    </span>
                  </button>
                </li>
              );
            })}
            {hasMore || loadingMore ? (
              <li ref={sentinelRef} className="list-more">
                {loadingMore ? 'Loading more…' : 'Scroll for more'}
              </li>
            ) : (
              <li className="list-more">End of list</li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
