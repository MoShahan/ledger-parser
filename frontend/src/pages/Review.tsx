import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fetchInvoice, saveInvoice } from '../api';
import FieldRow from '../components/FieldRow';
import StatusChip from '../components/StatusChip';
import { useToast } from '../toast';
import { errorMessage, fieldText, type FieldKey, type Invoice, type InvoiceFields } from '../types';

const FIELD_LABELS: [FieldKey, string, boolean][] = [
  ['vendor', 'Vendor', false],
  ['invoiceNumber', 'Invoice #', false],
  ['invoiceDate', 'Invoice date', false],
  ['currency', 'Currency', false],
  ['subtotal', 'Subtotal', false],
  ['tax', 'Tax', false],
  ['total', 'Total', false],
  ['lineItems', 'Line items', true],
];

export default function Review() {
  const { id } = useParams();
  const toast = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [draft, setDraft] = useState<InvoiceFields | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchInvoice(id)
      .then((data) => {
        setInvoice(data);
        setDraft(data.fields);
      })
      .catch((err: unknown) => {
        console.error('[review] load failed', err);
        const message = errorMessage(err);
        setError(message);
        toast.error(message);
      });
  }, [id, toast]);

  const mismatch = useMemo(
    () => (invoice?.issues || []).find((issue) => issue.code === 'TOTAL_MISMATCH'),
    [invoice],
  );

  function onChange(key: FieldKey, value: unknown) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        [key]: { ...current[key], value },
      };
    });
    setSaved(false);
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!id || !draft) return;
    setSaving(true);
    setError('');
    try {
      const fields: Partial<Record<FieldKey, unknown>> = {};
      for (const [key] of FIELD_LABELS) {
        fields[key] = draft[key].value;
      }
      const updated = await saveInvoice(id, fields);
      setInvoice(updated);
      setDraft(updated.fields);
      setSaved(true);
      toast.success('Saved. Your values are the source of truth.');
    } catch (err) {
      console.error('[review] save failed', err);
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !invoice) {
    return <p className="banner error">{error}</p>;
  }

  if (!invoice || !draft) {
    return <p className="muted">Loading invoice…</p>;
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Link to="/">Invoices</Link>
            <span className="crumb-sep">/</span>
            {fieldText(draft.invoiceNumber?.value) || invoice.filename}
          </p>
          <h1>Review extract</h1>
          <p className="lede">Confirm uncertain fields. Your edit becomes the source of truth.</p>
        </div>
        <StatusChip status={invoice.status} />
      </header>

      {mismatch ? <p className="banner warn">{mismatch.message}</p> : null}
      {error ? <p className="banner error">{error}</p> : null}
      {saved ? <p className="banner ok">Saved. Your values are the source of truth.</p> : null}

      <div className="review-grid">
        <section className="preview-card">
          <div className="card-label">Source document</div>
          <iframe title="Invoice PDF" src={invoice.previewUrl} />
        </section>
        <form className="fields-card" onSubmit={onSave}>
          <div className="card-label">Extracted fields</div>
          {FIELD_LABELS.map(([key, label, isJson]) => (
            <FieldRow
              key={key}
              label={label}
              fieldKey={key}
              field={draft[key]}
              isJson={isJson}
              onChange={onChange}
            />
          ))}
          <div className="actions">
            <Link to="/" className="ghost">
              Skip for now
            </Link>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? 'Saving…' : 'Confirm & save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
