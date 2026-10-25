import { useState } from 'react';
import Icon from './Icon.jsx';
import { uid, today, fmtDate, copyText, printSummary } from './utils.js';

const TABS = [
  { id: 'symptoms', label: 'Symptom log', icon: 'activity' },
  { id: 'doctors', label: 'My doctors', icon: 'steth' },
  { id: 'meds', label: 'Prescriptions', icon: 'pill' },
  { id: 'saved', label: 'Saved summaries', icon: 'save' },
];

export default function Vault({ symptoms, setSymptoms, doctors, setDoctors, meds, setMeds, saved, setSaved, askAgent, openSaved, notify }) {
  const [tab, setTab] = useState('symptoms');
  const counts = { symptoms: symptoms.length, doctors: doctors.length, meds: meds.length, saved: saved.length };

  return (
    <div className="glass vault spot">
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={16} />{t.label}<span className="count">{counts[t.id]}</span>
          </button>
        ))}
      </div>
      <div className="tab-body" key={tab}>
        {tab === 'symptoms' && <Symptoms {...{ symptoms, setSymptoms, askAgent }} />}
        {tab === 'doctors' && <Doctors {...{ doctors, setDoctors, askAgent, notify }} />}
        {tab === 'meds' && <Meds {...{ meds, setMeds, askAgent }} />}
        {tab === 'saved' && <Saved {...{ saved, setSaved, openSaved, notify }} />}
      </div>
    </div>
  );
}

function Empty({ icon, title, text }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={22} /></div>
      <b>{title}</b>
      <p className="muted small">{text}</p>
    </div>
  );
}

/* ---------------- Symptoms ---------------- */
function Symptoms({ symptoms, setSymptoms, askAgent }) {
  const [text, setText] = useState('');
  const [severity, setSeverity] = useState('Mild');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');

  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSymptoms([{ id: uid(), text: text.trim(), severity, duration: duration.trim() || 'not noted', notes: notes.trim(), at: new Date().toISOString() }, ...symptoms]);
    setText(''); setDuration(''); setNotes('');
  };

  return (
    <div className="two-col">
      <form onSubmit={add} className="form">
        <h3>Record a symptom</h3>
        <label>What are you feeling?<input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. headache behind the eyes" /></label>
        <div className="field-row">
          <label>Severity
            <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option>Mild</option><option>Moderate</option><option>Severe</option>
            </select>
          </label>
          <label>How long?<input className="input" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="2 days" /></label>
        </div>
        <label>Notes (optional)<textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Worse at night, no fever" /></label>
        <button className="btn" type="submit"><Icon name="plus" size={16} />Add to log</button>
      </form>

      <div className="list">
        {symptoms.length === 0 ? (
          <Empty icon="activity" title="No symptoms recorded" text="A written log helps your doctor. Add what you feel, then ask the agent to explain it." />
        ) : symptoms.map((s) => (
          <div className="item lift" key={s.id}>
            <div className="grow">
              <div className="row gap-s wrap"><b>{s.text}</b><span className={`badge ${s.severity === 'Severe' ? 'bad' : s.severity === 'Moderate' ? 'warn' : 'ok'}`}>{s.severity}</span></div>
              <p className="muted small">{s.duration} · {fmtDate(s.at)}{s.notes ? ` · ${s.notes}` : ''}</p>
            </div>
            <div className="row gap-s">
              <button className="btn ghost sm" onClick={() => askAgent(`I have been experiencing ${s.text} (${s.severity.toLowerCase()}, ${s.duration}). ${s.notes} What could this mean, and what should I do next?`)}><Icon name="chat" size={14} />Ask agent</button>
              <button className="btn ghost sm icon" aria-label="Delete" onClick={() => setSymptoms(symptoms.filter((x) => x.id !== s.id))}><Icon name="trash" size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Doctors ---------------- */
function Doctors({ doctors, setDoctors, askAgent, notify }) {
  const [f, setF] = useState({ name: '', specialty: '', phone: '', clinic: '', notes: '' });
  const [q, setQ] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const add = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    setDoctors([{ id: uid(), ...f, name: f.name.trim() }, ...doctors]);
    setF({ name: '', specialty: '', phone: '', clinic: '', notes: '' });
  };
  const shown = doctors.filter((d) => `${d.name} ${d.specialty} ${d.clinic}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="two-col">
      <form onSubmit={add} className="form">
        <h3>Save a doctor or consultant</h3>
        <label>Name<input className="input" value={f.name} onChange={set('name')} placeholder="Dr. Full Name" /></label>
        <div className="field-row">
          <label>Specialty<input className="input" value={f.specialty} onChange={set('specialty')} placeholder="Cardiologist" /></label>
          <label>Phone<input className="input" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="+91 ..." /></label>
        </div>
        <label>Clinic or hospital<input className="input" value={f.clinic} onChange={set('clinic')} placeholder="Clinic name, area" /></label>
        <label>Notes<input className="input" value={f.notes} onChange={set('notes')} placeholder="Visits Mon and Thu, 5 to 8 pm" /></label>
        <button className="btn" type="submit"><Icon name="plus" size={16} />Save contact</button>
      </form>

      <div className="list">
        {doctors.length > 0 && <input className="input" placeholder="Search saved doctors" value={q} onChange={(e) => setQ(e.target.value)} />}
        {doctors.length === 0 ? (
          <Empty icon="steth" title="No doctors saved" text="Save the doctors you already see so their number is one tap away." />
        ) : shown.length === 0 ? <p className="muted small">No match.</p> : shown.map((d) => (
          <div className="item lift" key={d.id}>
            <div className="grow">
              <b>{d.name}</b>
              <p className="muted small">{[d.specialty, d.clinic].filter(Boolean).join(' · ') || 'No details'}</p>
              {d.notes && <p className="muted small">{d.notes}</p>}
            </div>
            <div className="row gap-s wrap end">
              {d.phone && <a className="btn sm" href={`tel:${d.phone.replace(/[^\d+]/g, '')}`}><Icon name="phone" size={14} />Call</a>}
              {d.phone && <button className="btn ghost sm icon" aria-label="Copy number" onClick={async () => notify((await copyText(d.phone)) ? 'Number copied.' : 'Copy failed.')}><Icon name="copy" size={14} /></button>}
              <button className="btn ghost sm" onClick={() => askAgent(`I have an appointment with ${d.name}${d.specialty ? ` (${d.specialty})` : ''}. Prepare a list of questions I should ask.`)}><Icon name="chat" size={14} />Prepare</button>
              <button className="btn ghost sm icon" aria-label="Delete" onClick={() => setDoctors(doctors.filter((x) => x.id !== d.id))}><Icon name="trash" size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Prescriptions ---------------- */
function Meds({ meds, setMeds, askAgent }) {
  const [f, setF] = useState({ name: '', dosage: '', frequency: 'Once daily', notes: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const add = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    setMeds([{ id: uid(), ...f, name: f.name.trim(), takenOn: '' }, ...meds]);
    setF({ name: '', dosage: '', frequency: 'Once daily', notes: '' });
  };
  const toggle = (id) => setMeds(meds.map((m) => (m.id === id ? { ...m, takenOn: m.takenOn === today() ? '' : today() } : m)));

  return (
    <div className="two-col">
      <form onSubmit={add} className="form">
        <h3>Add a prescription</h3>
        <label>Medicine<input className="input" value={f.name} onChange={set('name')} placeholder="Name as printed on the strip" /></label>
        <div className="field-row">
          <label>Dose<input className="input" value={f.dosage} onChange={set('dosage')} placeholder="500 mg" /></label>
          <label>How often
            <select className="input" value={f.frequency} onChange={set('frequency')}>
              <option>Once daily</option><option>Twice daily</option><option>Three times daily</option><option>Weekly</option><option>As needed</option>
            </select>
          </label>
        </div>
        <label>Notes<input className="input" value={f.notes} onChange={set('notes')} placeholder="After food, prescribed by Dr. ..." /></label>
        <button className="btn" type="submit"><Icon name="plus" size={16} />Add medicine</button>
        <p className="muted tiny">Tip: attach a photo of the prescription in the agent chat and it will offer to add the medicines it can read.</p>
      </form>

      <div className="list">
        {meds.length === 0 ? (
          <Empty icon="pill" title="No medicines saved" text="Keep your active prescriptions in one place and tick them off each day." />
        ) : meds.map((m) => {
          const done = m.takenOn === today();
          return (
            <div className={`item lift ${done ? 'done' : ''}`} key={m.id}>
              <button className={`check ${done ? 'on' : ''}`} onClick={() => toggle(m.id)} aria-pressed={done} aria-label={`Mark ${m.name} taken today`}>{done && <Icon name="check" size={14} />}</button>
              <div className="grow">
                <b>{m.name}</b>
                <p className="muted small">{[m.dosage, m.frequency, m.notes].filter(Boolean).join(' · ')}</p>
                <p className="muted tiny">{done ? 'Marked taken today' : 'Not marked today'}</p>
              </div>
              <div className="row gap-s">
                <button className="btn ghost sm" onClick={() => askAgent(`Explain in simple terms what ${m.name} ${m.dosage} is generally used for and common things to ask my doctor or pharmacist about it. Do not change my dose.`)}><Icon name="chat" size={14} />Learn</button>
                <button className="btn ghost sm icon" aria-label="Delete" onClick={() => setMeds(meds.filter((x) => x.id !== m.id))}><Icon name="trash" size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Saved summaries ---------------- */
function Saved({ saved, setSaved, openSaved, notify }) {
  if (saved.length === 0) {
    return <Empty icon="save" title="No saved summaries" text="After the agent answers, press Save summary in the case panel. Summaries stay in this browser only." />;
  }
  return (
    <div className="list wide">
      {saved.map((s) => (
        <div className="item lift" key={s.id}>
          <div className="grow">
            <b>{s.question?.slice(0, 70) || 'Summary'}</b>
            <p className="muted small">{fmtDate(s.at)}{s.specialist ? ` · ${s.specialist}` : ''} · {s.probable_conditions?.length || 0} items to discuss · {s.needed_reports?.length || 0} tests</p>
          </div>
          <div className="row gap-s">
            <button className="btn ghost sm" onClick={() => openSaved(s)}><Icon name="file" size={14} />Open</button>
            <button className="btn ghost sm" onClick={() => { if (!printSummary(s)) notify('Allow pop-ups to print.'); }}><Icon name="print" size={14} />Print</button>
            <button className="btn ghost sm icon" aria-label="Delete" onClick={() => setSaved(saved.filter((x) => x.id !== s.id))}><Icon name="trash" size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
