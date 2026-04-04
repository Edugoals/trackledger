/**
 * Server-side HTML for agreement document (same content shape as client AgreementPreview).
 * Used for PDF generation; keep in sync with client/src/components/AgreementPreview.vue.
 */

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STATUS_LABELS = {
  NOT_STARTED: 'Niet gestart',
  IN_PROGRESS: 'Bezig',
  DONE: 'Afgerond',
};

function statusLabel(s) {
  return STATUS_LABELS[s] || escapeHtml(s);
}

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString('nl-NL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return escapeHtml(iso);
  }
}

function formatPeriod(start, end) {
  try {
    const a = new Date(start).toLocaleDateString('nl-NL', { dateStyle: 'medium' });
    const b = new Date(end).toLocaleDateString('nl-NL', { dateStyle: 'medium' });
    return `${a} – ${b}`;
  } catch {
    return '';
  }
}

function producerLine(agreement) {
  const p = agreement.producer;
  if (!p) return '—';
  const name = (p.name || '').trim();
  const email = p.email ? ` (${p.email.trim()})` : '';
  const t = (name + email).trim();
  return t || '—';
}

function customerLine(agreement) {
  const c = agreement.customer;
  if (!c) return '—';
  if (c.email) return `${c.name} (${c.email.trim()})`;
  return c.name;
}

function moneyLine(agreement) {
  const f = agreement.track?.financial;
  if (!f || f.agreedPrice == null) return '—';
  try {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: f.currency || 'EUR',
    }).format(f.agreedPrice);
  } catch {
    return `${escapeHtml(String(f.agreedPrice))} ${escapeHtml(f.currency || 'EUR')}`;
  }
}

const DOC_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #111827; line-height: 1.45; font-size: 14px; }
  .agreement-preview { max-width: 720px; margin: 0 auto; padding: 1.5rem 1.25rem 2rem; }
  .doc-header { border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 1.25rem; }
  .doc-header h1 { margin: 0 0 0.5rem; font-size: 1.5rem; font-weight: 600; }
  .generated { margin: 0; font-size: 0.875rem; color: #6b7280; }
  .doc-section { margin-bottom: 1.5rem; }
  .doc-section h2 { margin: 0 0 0.65rem; font-size: 1rem; font-weight: 600; color: #374151; }
  .pairs { margin: 0; display: grid; grid-template-columns: 10rem 1fr; gap: 0.35rem 1rem; font-size: 0.9rem; }
  .pairs dt { color: #6b7280; font-weight: 500; }
  .pairs dd { margin: 0; }
  .doc-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  .doc-table th, .doc-table td { border: 1px solid #e5e7eb; padding: 0.45rem 0.5rem; text-align: left; vertical-align: top; }
  .doc-table th { background: #f9fafb; font-weight: 600; color: #4b5563; }
  .notes { max-width: 14rem; word-break: break-word; }
  .block-text { margin: 0; white-space: pre-wrap; font-size: 0.9rem; }
`;

/**
 * @param {object} agreement - same shape as buildAgreementPreviewData output
 */
export function renderAgreementDocumentHtml(agreement) {
  const scopeRows = (agreement.scopeItems || [])
    .map(
      (row) => `
    <tr>
      <td>${escapeHtml(String(row.position))}</td>
      <td>${escapeHtml(row.title)}</td>
      <td>${statusLabel(row.status)}</td>
      <td>${row.deadlineAt ? formatWhen(row.deadlineAt) : '—'}</td>
      <td>${row.estimatedHours != null ? escapeHtml(String(row.estimatedHours)) : '—'}</td>
      <td class="notes">${row.notes ? escapeHtml(row.notes) : '—'}</td>
    </tr>`
    )
    .join('');

  const planning = agreement.planningEvents || [];
  const planningSection =
    planning.length > 0
      ? `
    <section class="doc-section">
      <h2>Planning (gekoppelde agenda)</h2>
      <table class="doc-table">
        <thead>
          <tr><th>Titel</th><th>Start</th><th>Einde</th><th>Taak</th></tr>
        </thead>
        <tbody>
          ${planning
            .map(
              (ev) => `
            <tr>
              <td>${escapeHtml(ev.title)}</td>
              <td>${formatWhen(ev.start)}</td>
              <td>${formatWhen(ev.end)}</td>
              <td>${ev.assignedToTaskTitle ? escapeHtml(ev.assignedToTaskTitle) : '—'}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>`
      : '';

  const general =
    agreement.generalNotes && String(agreement.generalNotes).trim()
      ? `
    <section class="doc-section">
      <h2>Algemene notities</h2>
      <p class="block-text">${escapeHtml(agreement.generalNotes)}</p>
    </section>`
      : '';

  const inner = `
    <header class="doc-header">
      <h1>Projectovereenkomst</h1>
      <p class="generated">Gegenereerd: ${formatWhen(agreement.generatedAt)}</p>
    </header>
    <section class="doc-section">
      <h2>Partijen</h2>
      <dl class="pairs">
        <dt>Producer / studio</dt>
        <dd>${escapeHtml(producerLine(agreement))}</dd>
        <dt>Klant</dt>
        <dd>${escapeHtml(customerLine(agreement))}</dd>
      </dl>
    </section>
    <section class="doc-section">
      <h2>Project &amp; track</h2>
      <dl class="pairs">
        <dt>Project (job)</dt>
        <dd>${escapeHtml(agreement.job.name)}</dd>
        <dt>Periode</dt>
        <dd>${formatPeriod(agreement.job.periodStart, agreement.job.periodEnd)}</dd>
        <dt>Track</dt>
        <dd>${escapeHtml(agreement.track.name)}</dd>
      </dl>
    </section>
    <section class="doc-section">
      <h2>Scope / taken</h2>
      <table class="doc-table">
        <thead>
          <tr>
            <th>#</th><th>Taak</th><th>Status</th><th>Deadline</th><th>Est. uren</th><th>Notities</th>
          </tr>
        </thead>
        <tbody>${scopeRows}</tbody>
      </table>
    </section>
    ${planningSection}
    <section class="doc-section">
      <h2>Financieel</h2>
      <dl class="pairs">
        <dt>Afgesproken bedrag</dt>
        <dd>${moneyLine(agreement)}</dd>
        <dt>Definitieve prijs</dt>
        <dd>${agreement.track.financial.isPriceFinal ? 'Ja' : 'Nee (voorlopig)'}</dd>
        <dt>Prijsnotities</dt>
        <dd>${agreement.track.financial.pricingNotes ? escapeHtml(agreement.track.financial.pricingNotes) : '—'}</dd>
      </dl>
    </section>
    ${general}
  `;

  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Projectovereenkomst</title>
  <style>${DOC_STYLES}</style>
</head>
<body>
  <article class="agreement-preview document">${inner}</article>
</body>
</html>`;
}
