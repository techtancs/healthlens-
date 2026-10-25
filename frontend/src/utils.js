export const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const today = () => new Date().toISOString().slice(0, 10);

export const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

// Links are search links built by this app. Nothing here is a live "doctors found" count.
export function careLinks(specialist, city) {
  const spec = specialist || 'doctor';
  const where = city ? `in ${city}` : 'near me';
  const q = encodeURIComponent(`${spec} ${where}`);
  return [
    { label: `${spec} on Google Maps`, url: `https://www.google.com/maps/search/${q}`, icon: 'map' },
    { label: 'Practo listings (web search)', url: `https://www.google.com/search?q=${encodeURIComponent(`site:practo.com ${spec} ${city || ''}`)}`, icon: 'search' },
    { label: 'Online consultation options', url: `https://www.google.com/search?q=${encodeURIComponent(`online consultation ${spec}`)}`, icon: 'globe' },
    { label: 'e-Sanjeevani (government telemedicine)', url: 'https://esanjeevaniopd.in/', icon: 'phone' },
  ];
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function analysisToText(a) {
  if (!a) return '';
  const lines = [`HealthLens AI summary (educational only)`, '', a.reply, ''];
  if (a.probable_conditions?.length) lines.push('Possible things to discuss with a doctor:', ...a.probable_conditions.map((c) => `- ${c.name}${c.note ? `: ${c.note}` : ''}`), '');
  if (a.needed_reports?.length) lines.push('Tests a doctor may consider:', ...a.needed_reports.map((r) => `- ${r.test}${r.reason ? `: ${r.reason}` : ''}`), '');
  if (a.suggested_questions?.length) lines.push('Questions to ask your doctor:', ...a.suggested_questions.map((q) => `- ${q}`), '');
  lines.push(a.safety_warning || '');
  return lines.join('\n');
}

export function printSummary(a) {
  if (!a) return;
  const list = (items, fn) => (items?.length ? `<ul>${items.map(fn).join('')}</ul>` : '<p class="m">None.</p>');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>HealthLens AI summary</title>
<style>body{font:15px/1.6 system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#1b1e22}
h1{font-size:1.4rem}h2{font-size:1.05rem;margin-top:1.6rem;border-bottom:1px solid #ddd;padding-bottom:.2rem}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:.35rem .5rem;text-align:left;font-size:.9rem}
.m{color:#666}.w{border:1px solid #bbb;padding:.7rem;border-radius:8px;margin-top:1.6rem;font-size:.9rem}</style></head><body>
<h1>HealthLens AI summary</h1><p class="m">AI-generated educational summary. Not a medical certificate or diagnosis. ${esc(new Date().toLocaleString())}</p>
<h2>Explanation</h2>${esc(a.reply).split('\n').filter(Boolean).map((p) => `<p>${p}</p>`).join('')}
${a.extracted_values?.length ? `<h2>Values read from the report (check against the original)</h2><table><tr><th>Test</th><th>Value</th><th>Unit</th><th>Lab range</th><th>Flag on report</th></tr>${a.extracted_values.map((v) => `<tr><td>${esc(v.test)}</td><td>${esc(v.value)}</td><td>${esc(v.unit)}</td><td>${esc(v.reference_range)}</td><td>${esc(v.flag)}</td></tr>`).join('')}</table>` : ''}
<h2>Possible things to discuss with a doctor</h2>${list(a.probable_conditions, (c) => `<li><b>${esc(c.name)}</b> ${esc(c.note)}</li>`)}
<h2>Tests a doctor may consider</h2>${list(a.needed_reports, (r) => `<li><b>${esc(r.test)}</b> ${esc(r.reason)}</li>`)}
<h2>Questions to ask your doctor</h2>${list(a.suggested_questions, (q) => `<li>${esc(q)}</li>`)}
<div class="w">${esc(a.safety_warning)}</div></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}
