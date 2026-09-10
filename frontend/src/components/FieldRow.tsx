import type { ExtractedField, FieldKey } from '../types';
import { fieldText } from '../utils';

import StatusChip from './StatusChip';

type FieldRowProps = {
  label: string;
  fieldKey: FieldKey;
  field: ExtractedField;
  onChange: (key: FieldKey, value: unknown) => void;
  onAccept?: (key: FieldKey) => void;
  isJson?: boolean;
};

export default function FieldRow({
  label,
  fieldKey,
  field,
  onChange,
  onAccept,
  isJson,
}: FieldRowProps) {
  const display = isJson ? JSON.stringify(field.value ?? [], null, 2) : fieldText(field.value);
  const snippet = fieldText(field.sourceSnippet);
  const showAccept =
    Boolean(onAccept) && field.status === 'needs_review' && field.sourceOfTruth !== 'user';

  return (
    <div className={`field-row ${field.status === 'needs_review' ? 'needs-review' : ''}`}>
      <div className="field-head">
        <span>{label}</span>
        <StatusChip status={field.status} />
      </div>
      {isJson ? (
        <textarea
          rows={5}
          value={display}
          aria-label={label}
          onChange={(event) => {
            try {
              onChange(fieldKey, JSON.parse(event.target.value));
            } catch {
              onChange(fieldKey, field.value);
            }
          }}
        />
      ) : (
        <input
          value={display}
          aria-label={label}
          onChange={(event) => onChange(fieldKey, event.target.value)}
        />
      )}
      <div className="field-meta">
        <span>Confidence {Math.round((field.confidence || 0) * 100)}%</span>
        {field.sourceOfTruth === 'user' ? <span>Confirmed by you</span> : null}
        {showAccept ? (
          <button
            type="button"
            className="field-accept"
            title="Keep this prefilled value as correct"
            onClick={() => onAccept?.(fieldKey)}
          >
            Looks correct
          </button>
        ) : null}
      </div>
      {snippet ? <p className="snippet">Source: {snippet}</p> : null}
    </div>
  );
}
