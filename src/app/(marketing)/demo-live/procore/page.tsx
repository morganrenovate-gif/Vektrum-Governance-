/**
 * /demo-live/procore — Procore × Vektrum partnership prototype (route entry).
 *
 * SIMULATED INTEGRATION CONCEPT — fictional demo data only. No external system
 * is connected and no funds are moved. Loads without authentication, uses only
 * local TypeScript fixtures, and imports no production logic.
 */
import type { Metadata } from 'next';
import { ProcoreDemoWorkspace } from './ProcoreDemoWorkspace';

export const metadata: Metadata = {
  title: 'Procore × Vektrum — Integration Concept (Simulated) | Vektrum',
  description:
    'Simulated integration concept. Procore remains the project system of record; Vektrum applies an external lender’s construction-loan release policy to a governed project snapshot. Fictional demo data only — no external system is connected and no funds are moved.',
  robots: { index: false, follow: false },
  alternates: { canonical: 'https://vektrum.io/demo-live/procore' },
};

export default function ProcoreDemoPage() {
  return <ProcoreDemoWorkspace />;
}
