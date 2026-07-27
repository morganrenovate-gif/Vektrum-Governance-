/**
 * Compact progress navigator for the ~90-second walkthrough.
 * Steps: Project workspace → Policy evaluation → Resolve at source →
 * Authorization → External confirmation.
 */
import { Check } from 'lucide-react';

const STEPS = [
  'Project workspace',
  'Policy evaluation',
  'Resolve at source',
  'Authorization',
  'External confirmation',
];

export function ProgressNavigator({ step }: { step: number }) {
  return (
    <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-3">
      <ol className="flex flex-wrap items-center gap-2" aria-label="Demo progress">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <li key={label}>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  active
                    ? 'bg-vektrum-blue text-white'
                    : done
                    ? 'bg-vektrum-blue-subtle text-vektrum-blue'
                    : 'bg-vektrum-surface-alt text-vektrum-muted'
                }`}
                aria-current={active ? 'step' : undefined}
              >
                <span className="grid h-4 w-4 place-items-center rounded-full border border-current text-[9px]">
                  {done ? <Check size={10} aria-hidden={true} /> : n}
                </span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
