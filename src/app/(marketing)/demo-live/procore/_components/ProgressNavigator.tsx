/**
 * Compact progress navigator + optional presenter guide.
 * Steps: Project snapshot → Policy review → Authorization → Confirmation.
 */
import { Check } from 'lucide-react';

const STEPS = ['Project snapshot', 'Policy review', 'Authorization', 'Confirmation'];

const GUIDE: Record<number, string> = {
  1: 'Procore remains the project system of record; Vektrum imports a governed, read-only snapshot for external lender review.',
  2: "Vektrum applies the lender's release policy to the snapshot — AI informs; the deterministic gate decides.",
  3: 'An authorized funder explicitly records the release authorization. Vektrum executes no payment.',
  4: 'Payment execution remains in the selected external process, which returns confirmation evidence.',
};

export function ProgressNavigator({
  chapter, showGuide, onToggleGuide,
}: { chapter: number; showGuide: boolean; onToggleGuide: () => void }) {
  return (
    <div className="rounded-2xl border border-vektrum-border bg-vektrum-surface p-3">
      <ol className="flex flex-wrap items-center gap-2" aria-label="Demo progress">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < chapter;
          const active = n === chapter;
          return (
            <li key={label} className="flex items-center gap-2">
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
              {n < STEPS.length && <span aria-hidden={true} className="text-vektrum-faint">→</span>}
            </li>
          );
        })}
        <li className="ml-auto">
          <button
            type="button"
            onClick={onToggleGuide}
            aria-pressed={showGuide}
            className="rounded-full border border-vektrum-border px-3 py-1.5 text-[12px] font-semibold text-vektrum-muted hover:bg-vektrum-surface-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-vektrum-blue"
          >
            {showGuide ? 'Hide presenter guide' : 'Presenter guide'}
          </button>
        </li>
      </ol>
      {showGuide && (
        <p className="mt-3 rounded-xl bg-vektrum-blue-subtle px-4 py-2.5 text-[13px] text-vektrum-blue">
          <span className="font-semibold">Presenter guide — </span>{GUIDE[chapter]}
        </p>
      )}
    </div>
  );
}
