import { fieldText, type ExtractedField, type FieldKey } from '../types';

import StatusChip from './StatusChip';

type FieldRowProps = {
  label: string;
  fieldKey: FieldKey;
  field: ExtractedField;
  onChange: (key: FieldKey, value: unknown) => void;
  isJson?: boolean;
};

export default function FieldRow({ label, fieldKey, field, onChange, isJson }: FieldRowProps) {
  const display = isJson ? JSON.stringify(field.value ?? [], null, 2) : fieldText(field.value);
  const snippet = fieldText(field.sourceSnippet);

  return (
    <label className={`field-row ${field.status === 'needs_review' ? 'needs-review' : ''}`}>
      <div className="field-head">
        <span>{label}</span>
        <StatusChip status={field.status} />
      </div>
      {isJson ? (
        <textarea
          rows={5}
          value={display}
          onChange={(event) => {
            try {
              onChange(fieldKey, JSON.parse(event.target.value));
            } catch {
              onChange(fieldKey, field.value);
            }
          }}
        />
      ) : (
        <input value={display} onChange={(event) => onChange(fieldKey, event.target.value)} />
      )}
      <div className="field-meta">
        <span>Confidence {Math.round((field.confidence || 0) * 100)}%</span>
        {field.sourceOfTruth === 'user' ? <span>Edited by you</span> : null}
      </div>
      {snippet ? <p className="snippet">Source: {snippet}</p> : null}
    </label>
  );
}
