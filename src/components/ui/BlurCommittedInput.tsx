import { type InputHTMLAttributes, useEffect, useState } from 'react';

type OmitValueProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'>;

/** String field: edits locally; commits to parent on blur when value changed. */
export function BlurCommittedInput({
  value,
  onCommit,
  className,
  onBlur,
  ...rest
}: OmitValueProps & {
  value: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      {...rest}
      className={className}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        if (draft !== value) onCommit(draft);
        onBlur?.(e);
      }}
    />
  );
}
