import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { API, uid, copyText, careLinks, analysisToText, printSummary, fmtDate } from './utils.js';

const STARTERS = {
  en: [
    'I have fever and body ache for 2 days. What could it be?',
    'Explain what a CBC blood test measures',
    'What questions should I ask a cardiologist?',
    'What does HbA1c mean on my report?',
  ],
  hi: [
    'मुझे दो दिन से बुखार और बदन दर्द है',
    'CBC ब्लड टेस्ट क्या बताता है?',
    'हृदय रोग विशेषज्ञ से कौन से सवाल पूछूं?',
    'रिपोर्ट में HbA1c का क्या मतलब है?',
  ],
};

const GREETING = {
  en: 'Hello. Describe your symptoms, attach a lab report or a photo of a prescription, or ask any health question. I will explain in plain language and tell you which tests and which kind of doctor to look for.',
  hi: 'नमस्ते। अपने लक्षण बताइए, लैब रिपोर्ट या प्रिस्क्रिप्शन की फोटो जोड़िए, या कोई भी स्वास्थ्य सवाल पूछिए। मैं सरल भाषा में समझाऊंगा और बताऊंगा कि कौन सी जांच और किस तरह के डॉक्टर से मिलना चाहिए।',
};

const URGENCY = {
  routine: { label: 'Routine', cls: 'ok' },
  soon: { label: 'See a doctor within days', cls: 'warn' },
  urgent: { label: 'Same-day medical review', cls: 'warn strong' },
  emergency: { label: 'Emergency: call 112', cls: 'bad' },
};

const MAX_FILE = 6 * 1024 * 1024;
const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'text/csv'];

function readFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read ' + file.name));
    const isText = file.type.startsWith('text/');
    fr.onload = () => {
      if (isText) resolve({ id: uid(), name: file.name, mimeType: file.type, text: String(fr.result) });
      else {
        const url = String(fr.result);
        resolve({
          id: uid(),
          name: file.name,
          mimeType: file.type,
          data: url.split(',')[1],
          preview: file.type.startsWith('image/') ? url : null,
        });
      }
    };
    isText ? fr.readAsText(file) : fr.readAsDataURL(file);
  });
}

export default function Agent({ lang, vault, input, setInput, analysis, setAnalysis, addMed, saveSummary, notify, city, setCity, backend }) {
  const [messages, setMessages] = useState([{ id: 'hello', role: 'ai', system: true, text: GREETING[lang] }]);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [share, setShare] = useState(false);
  const [drag, setDrag] = useState(false);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const recRef = useRef(null);

  // keep the greeting in the chosen language until the chat starts
  useEffect(() => {
    setMessages((m) => (m.length === 1 && m[0].system ? [{ ...m[0], text: GREETING[lang] }] : m));
  }, [lang]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  useEffect(() => () => { window.speechSynthesis?.cancel(); recRef.current?.stop?.(); }, []);

  async function addFiles(list) {
    const picked = Array.from(list || []);
    for (const f of picked) {
      if (files.length >= 3) { notify('You can attach up to 3 files.'); break; }
      if (!OK_TYPES.includes(f.type)) { notify(`${f.name}: use PDF, PNG, JPG, WEBP, TXT or CSV.`); continue; }
      if (f.size > MAX_FILE) { notify(`${f.name} is larger than 6 MB.`); continue; }
      try {
        const item = await readFile(f);
        setFiles((cur) => [...cur, item].slice(0, 3));
      } catch (e) { notify(e.message); }
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function send(text) {
    const content = (text ?? input).trim();
    if ((!content && files.length === 0) || loading) return;
    const sending = files;
    const history = messages.filter((m) => !m.system).slice(-12).map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { id: uid(), role: 'user', text: content || 'Please look at the attached file.', files: sending.map((f) => ({ name: f.name, preview: f.preview })) }]);
    setInput('');
    setFiles([]);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/master-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: content,
          history,
          language: lang,
          attachments: sending.map(({ name, mimeType, data, text: t }) => ({ name, mimeType, data, text: t })),
          context: share ? { medications: vault.meds.map((m) => `${m.name} ${m.dosage} ${m.frequency}`), symptom_log: vault.symptoms.slice(0, 8).map((s) => `${s.text} (${s.severity}, ${s.duration})`) } : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The server returned an error.');
      const msg = { id: uid(), role: 'ai', text: data.reply, data, at: new Date().toISOString(), question: content };
      setMessages((m) => [...m, msg]);
      setAnalysis({ ...data, at: msg.at, question: content || 'Attached file' });
      if (autoSpeak) speak(msg);
    } catch (err) {
      const offline = err instanceof TypeError;
      setMessages((m) => [...m, { id: uid(), role: 'ai', error: true, text: offline ? 'I cannot reach the backend server. Start it with "npm run dev" in the backend folder, then press retry.' : err.message, retry: content }]);
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    window.speechSynthesis?.cancel();
    setSpeakingId(null);
    setMessages([{ id: 'hello', role: 'ai', system: true, text: GREETING[lang] }]);
    setAnalysis(null);
    setFiles([]);
  }

  // ----- voice to text -----
  function toggleMic() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { notify('Voice input needs Chrome or Edge.'); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    const base = input ? input.trim() + ' ' : '';
    rec.onresult = (e) => {
      let t = '';
      for (const r of e.results) t += r[0].transcript;
      setInput(base + t);
    };
    rec.onerror = (e) => { setListening(false); if (e.error === 'not-allowed') notify('Microphone permission was blocked.'); };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }

  // ----- text to speech -----
  function speak(msg) {
    if (!('speechSynthesis' in window)) { notify('Speech output is not supported in this browser.'); return; }
    if (speakingId === msg.id) { window.speechSynthesis.cancel(); setSpeakingId(null); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(msg.text);
    u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    u.rate = 0.98;
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    setSpeakingId(msg.id);
    window.speechSynthesis.speak(u);
  }

  async function copy(msg) { notify((await copyText(msg.text)) ? 'Copied to clipboard.' : 'Copy failed.'); }
  async function shareMsg(msg) {
    if (navigator.share) { try { await navigator.share({ title: 'HealthLens AI', text: msg.text }); return; } catch { return; } }
    copy(msg);
  }

  const u = analysis ? URGENCY[analysis.urgency] || URGENCY.routine : null;
  const links = analysis?.specialist ? careLinks(analysis.specialist, city) : [];

  return (
    <div className="agent-grid">
      {/* ---------------- Chat panel ---------------- */}
      <div
        className={`glass chat spot ${drag ? 'dragging' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
      >
        <div className="chat-head">
          <div>
            <h2>Health agent</h2>
            <p className="muted small">
              <span className={`dot ${backend.ok ? (backend.ai ? 'on' : 'half') : 'off'}`} />
              {backend.ok ? (backend.ai ? 'AI model connected' : 'Backend online, AI key missing (demo mode)') : 'Backend offline'}
            </p>
          </div>
          <div className="row gap-s wrap">
            <label className="switch" title="Let the agent see your saved medicines and symptom log for this question">
              <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
              <span className="track"><span className="thumb" /></span>
              <span className="small">Use my saved data</span>
            </label>
            <label className="switch" title="Read answers aloud automatically">
              <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} />
              <span className="track"><span className="thumb" /></span>
              <span className="small">Read aloud</span>
            </label>
            <button className="btn ghost sm" onClick={newChat}><Icon name="refresh" size={15} />New chat</button>
          </div>
        </div>

        <div className="log" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`msg ${m.role} ${m.error ? 'err' : ''}`}>
              <div className="bubble">
                {m.files?.length > 0 && (
                  <div className="row gap-s wrap file-row">
                    {m.files.map((f, i) => (
                      <span className="chip static" key={i}>
                        {f.preview ? <img src={f.preview} alt="" /> : <Icon name="file" size={14} />}
                        {f.name}
                      </span>
                    ))}
                  </div>
                )}
                {m.text.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}

                {m.data?.urgency === 'emergency' && (
                  <div className="alert-box">
                    <Icon name="alert" /> This may be an emergency. Call <a href="tel:112"><b>112</b></a> now or go to the nearest hospital.
                  </div>
                )}
                {m.data?.follow_up_questions?.length > 0 && (
                  <div className="chips">
                    {m.data.follow_up_questions.map((q, i) => (
                      <button key={i} className="chip" onClick={() => setInput(q)}>{q}</button>
                    ))}
                  </div>
                )}
                {m.role === 'ai' && !m.system && !m.error && (
                  <div className="actions">
                    <button className="btn ghost sm" onClick={() => speak(m)}><Icon name={speakingId === m.id ? 'stop' : 'speaker'} size={15} />{speakingId === m.id ? 'Stop' : 'Speak'}</button>
                    <button className="btn ghost sm" onClick={() => copy(m)}><Icon name="copy" size={15} />Copy</button>
                    <button className="btn ghost sm" onClick={() => shareMsg(m)}><Icon name="share" size={15} />Share</button>
                  </div>
                )}
                {m.error && m.retry && (
                  <div className="actions"><button className="btn ghost sm" onClick={() => send(m.retry)}><Icon name="refresh" size={15} />Retry</button></div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="msg ai">
              <div className="bubble typing"><span /><span /><span /><em className="muted small">Reading and thinking</em></div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {messages.length === 1 && (
          <div className="chips starters">
            {STARTERS[lang].map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}

        {files.length > 0 && (
          <div className="row gap-s wrap file-row">
            {files.map((f) => (
              <span className="chip static" key={f.id}>
                {f.preview ? <img src={f.preview} alt="" /> : <Icon name="file" size={14} />}
                {f.name}
                <button className="x" onClick={() => setFiles((c) => c.filter((x) => x.id !== f.id))} aria-label={`Remove ${f.name}`}><Icon name="x" size={13} /></button>
              </span>
            ))}
          </div>
        )}

        <div className={`composer ${listening ? 'live' : ''}`}>
          <input ref={fileRef} type="file" hidden multiple accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv" onChange={(e) => addFiles(e.target.files)} />
          <button className="btn ghost icon" onClick={() => fileRef.current?.click()} title="Attach report, photo or prescription"><Icon name="clip" /></button>
          <textarea
            id="agent-input"
            rows={1}
            value={input}
            placeholder={listening ? 'Listening, speak now' : lang === 'hi' ? 'अपनी समस्या या लक्षण लिखें' : 'Describe your problem, symptoms, or ask a question'}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button className={`btn ghost icon mic ${listening ? 'rec' : ''}`} onClick={toggleMic} title="Voice to text">
            {listening ? <span className="wave"><i /><i /><i /><i /></span> : <Icon name="mic" />}
          </button>
          <button className="btn" onClick={() => send()} disabled={loading}><Icon name="send" size={16} />Send</button>
        </div>
        <p className="muted tiny">Drop files anywhere on this panel. PDF, PNG, JPG, WEBP, TXT, CSV up to 6 MB. Files are sent to the AI service for this question only and are not stored by this app.</p>
      </div>

      {/* ---------------- Summary panel ---------------- */}
      <aside className="summary">
        <div className="glass pad spot">
          <div className="row between">
            <h3>Case summary</h3>
            {u && <span className={`badge ${u.cls}`}>{u.label}</span>}
          </div>
          {!analysis ? (
            <div className="empty">
              <div className="skeleton" /><div className="skeleton short" /><div className="skeleton" />
              <p className="muted small">Your first answer fills this panel with possible conditions to discuss, tests to ask about, questions for your doctor and where to find one.</p>
            </div>
          ) : (
            <p className="muted small">From: {analysis.question?.slice(0, 80) || 'your message'} · {fmtDate(analysis.at)}</p>
          )}
        </div>

        {analysis && (
          <>
            {analysis.extracted_values?.length > 0 && (
              <div className="glass pad rise">
                <h3><Icon name="flask" size={16} /> Values read from your report</h3>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Test</th><th>Value</th><th>Lab range</th><th>Flag</th></tr></thead>
                    <tbody>
                      {analysis.extracted_values.map((v, i) => (
                        <tr key={i}><td>{v.test}</td><td>{v.value} {v.unit}</td><td>{v.reference_range || '-'}</td><td>{v.flag || '-'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="muted tiny">Read by AI from your file. Check against the original. Flags are only what the report itself prints.</p>
              </div>
            )}

            <div className="glass pad rise">
              <h3><Icon name="activity" size={16} /> Possible things to discuss</h3>
              {analysis.probable_conditions.length ? (
                <ul className="plain">{analysis.probable_conditions.map((c, i) => <li key={i}><b>{c.name}</b>{c.note && <span className="muted"> {c.note}</span>}</li>)}</ul>
              ) : <p className="muted small">Nothing specific to list yet. Add more detail in chat.</p>}
            </div>

            <div className="glass pad rise">
              <h3><Icon name="flask" size={16} /> Reports and tests to ask about</h3>
              {analysis.needed_reports.length ? (
                <ul className="plain">{analysis.needed_reports.map((r, i) => <li key={i}><b>{r.test}</b>{r.reason && <span className="muted"> {r.reason}</span>}</li>)}</ul>
              ) : <p className="muted small">No tests suggested for this question.</p>}
            </div>

            <div className="glass pad rise">
              <div className="row between"><h3><Icon name="steth" size={16} /> Questions for your doctor</h3>
                {analysis.suggested_questions.length > 0 && (
                  <button className="btn ghost sm" onClick={async () => notify((await copyText(analysis.suggested_questions.map((q) => '- ' + q).join('\n'))) ? 'Questions copied.' : 'Copy failed.')}><Icon name="copy" size={14} />Copy</button>
                )}
              </div>
              {analysis.suggested_questions.length ? (
                <ul className="plain">{analysis.suggested_questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
              ) : <p className="muted small">None yet.</p>}
            </div>

            {analysis.medications_found.length > 0 && (
              <div className="glass pad rise">
                <h3><Icon name="pill" size={16} /> Medicines read from your file</h3>
                <ul className="plain">
                  {analysis.medications_found.map((m, i) => (
                    <li key={i} className="row between gap-s">
                      <span><b>{m.name}</b> <span className="muted">{m.dosage} {m.notes}</span></span>
                      <button className="btn ghost sm" onClick={() => addMed(m)}><Icon name="plus" size={14} />Add</button>
                    </li>
                  ))}
                </ul>
                <p className="muted tiny">Check each one against the paper prescription before adding.</p>
              </div>
            )}

            <div className="glass pad rise">
              <h3><Icon name="map" size={16} /> Find a doctor{analysis.specialist ? `: ${analysis.specialist}` : ''}</h3>
              <div className="field-row">
                <input className="input" placeholder="Your city (optional)" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              {links.length ? (
                <div className="links">
                  {links.map((l) => (
                    <a key={l.url} className="link-card lift" href={l.url} target="_blank" rel="noreferrer noopener">
                      <Icon name={l.icon} size={16} /><span>{l.label}</span><Icon name="link" size={14} />
                    </a>
                  ))}
                </div>
              ) : <p className="muted small">The agent has not suggested a specialist for this question.</p>}
              <p className="muted tiny">These open searches in a new tab. This app does not count or verify doctors online.</p>
            </div>

            <div className="glass pad rise">
              <div className="row gap-s wrap">
                <button className="btn" onClick={() => { saveSummary(analysis); }}><Icon name="save" size={16} />Save summary</button>
                <button className="btn ghost" onClick={async () => notify((await copyText(analysisToText(analysis))) ? 'Summary copied.' : 'Copy failed.')}><Icon name="copy" size={16} />Copy</button>
                <button className="btn ghost" onClick={() => { if (!printSummary(analysis)) notify('Allow pop-ups to print.'); }}><Icon name="print" size={16} />Print</button>
              </div>
              <p className="muted tiny">{analysis.safety_warning}</p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
