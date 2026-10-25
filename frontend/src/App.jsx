import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import Agent from './Agent.jsx';
import Vault from './Vault.jsx';
import { FindCare, Emergency } from './Care.jsx';
import { useLocalStorage, usePointerEffects, useReveal } from './hooks.js';
import { API, uid } from './utils.js';

const T = {
  en: {
    nav: ['Home', 'Agent', 'My health', 'Find care', 'Emergency', 'Privacy'],
    eyebrow: 'Health report and symptom assistant',
    h1: 'Understand your symptoms and lab reports before you see a doctor.',
    sub: 'Type or speak your problem, attach a lab report or prescription photo, and get a plain-language explanation, the tests to ask about, and a list of questions for your doctor. Save your doctors, medicines and symptoms in one place.',
    cta1: 'Talk to the agent',
    cta2: 'Upload a report',
    skip: 'Opening the agent',
    skipBtn: 'Stay here',
    features: [
      ['upload', 'Reads reports and photos', 'PDF, image or text lab reports and prescriptions'],
      ['mic', 'Speaks and listens', 'Voice input and spoken answers, English and Hindi'],
      ['steth', 'Prepares your visit', 'Tests to ask about and questions for your doctor'],
      ['shield', 'Stays on your device', 'Your saved data lives in this browser only'],
    ],
    agentTitle: 'Ask the agent',
    agentSub: 'One conversation for symptoms, reports, prescriptions and doctor questions.',
    healthTitle: 'My health',
    healthSub: 'Your symptom log, doctors, medicines and saved summaries. Stored in this browser only.',
    careTitle: 'Find care',
    careSub: 'Jump straight to live doctor searches for the specialty you need.',
    emTitle: 'Emergency help',
    emSub: 'Always available, no AI involved.',
    privTitle: 'Privacy and how this works',
  },
  hi: {
    nav: ['होम', 'एजेंट', 'मेरा स्वास्थ्य', 'डॉक्टर खोजें', 'आपातकाल', 'गोपनीयता'],
    eyebrow: 'रिपोर्ट और लक्षण समझने वाला सहायक',
    h1: 'डॉक्टर से मिलने से पहले अपने लक्षण और लैब रिपोर्ट समझें।',
    sub: 'अपनी समस्या लिखें या बोलें, लैब रिपोर्ट या प्रिस्क्रिप्शन की फोटो जोड़ें, और पाएं सरल भाषा में व्याख्या, पूछने लायक जांचें और डॉक्टर के लिए सवालों की सूची। अपने डॉक्टर, दवाइयां और लक्षण एक जगह सहेजें।',
    cta1: 'एजेंट से बात करें',
    cta2: 'रिपोर्ट अपलोड करें',
    skip: 'एजेंट खुल रहा है',
    skipBtn: 'यहीं रुकें',
    features: [
      ['upload', 'रिपोर्ट और फोटो पढ़ता है', 'PDF, इमेज या टेक्स्ट लैब रिपोर्ट और प्रिस्क्रिप्शन'],
      ['mic', 'बोलता और सुनता है', 'आवाज़ से लिखें और जवाब सुनें, हिन्दी और English'],
      ['steth', 'आपकी विज़िट तैयार करता है', 'पूछने लायक जांचें और डॉक्टर के सवाल'],
      ['shield', 'आपके डिवाइस पर रहता है', 'सहेजा गया डेटा सिर्फ इस ब्राउज़र में रहता है'],
    ],
    agentTitle: 'एजेंट से पूछें',
    agentSub: 'लक्षण, रिपोर्ट, प्रिस्क्रिप्शन और डॉक्टर के सवालों के लिए एक ही बातचीत।',
    healthTitle: 'मेरा स्वास्थ्य',
    healthSub: 'आपका लक्षण लॉग, डॉक्टर, दवाइयां और सहेजे गए सारांश। सिर्फ इस ब्राउज़र में रखे जाते हैं।',
    careTitle: 'डॉक्टर खोजें',
    careSub: 'ज़रूरी विशेषज्ञ के लिए सीधे लाइव खोज खोलें।',
    emTitle: 'आपातकालीन सहायता',
    emSub: 'हमेशा उपलब्ध, इसमें AI शामिल नहीं है।',
    privTitle: 'गोपनीयता और यह कैसे काम करता है',
  },
};

const IDS = ['home', 'agent', 'health', 'care', 'emergency', 'privacy'];

export default function App() {
  usePointerEffects();
  useReveal();

  const [theme, setTheme] = useLocalStorage('hl-theme', 'dark');
  const [lang, setLang] = useLocalStorage('hl-lang', 'en');
  const [symptoms, setSymptoms] = useLocalStorage('hl-symptoms', []);
  const [doctors, setDoctors] = useLocalStorage('hl-doctors', []);
  const [meds, setMeds] = useLocalStorage('hl-meds', []);
  const [saved, setSaved] = useLocalStorage('hl-saved', []);
  const [city, setCity] = useLocalStorage('hl-city', '');

  const [input, setInput] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [specialist, setSpecialist] = useState('General Physician');
  const [backend, setBackend] = useState({ ok: false, ai: false });
  const [active, setActive] = useState('home');
  const [intro, setIntro] = useState(true);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(0);

  const t = T[lang];

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const notify = useCallback((msg) => {
    setToast({ id: uid(), msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // Backend health check
  useEffect(() => {
    fetch(`${API}/api/health`)
      .then((r) => r.json())
      .then((d) => setBackend({ ok: true, ai: Boolean(d.aiConfigured) }))
      .catch(() => setBackend({ ok: false, ai: false }));
  }, []);

  // Intro: show the hero for a few seconds, then glide to the agent (cancelled by any user input)
  useEffect(() => {
    let done = false;
    const stop = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      setIntro(false);
    };
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      setIntro(false);
      document.getElementById('agent')?.scrollIntoView({ behavior: 'smooth' });
    }, 6000);
    const evs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    evs.forEach((e) => window.addEventListener(e, stop, { passive: true }));
    return () => { clearTimeout(timer); evs.forEach((e) => window.removeEventListener(e, stop)); };
  }, []);

  // Highlight the current section in the nav
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); }),
      { rootMargin: '-45% 0px -50% 0px' }
    );
    IDS.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const askAgent = (text) => {
    setInput(text);
    go('agent');
    setTimeout(() => document.getElementById('agent-input')?.focus({ preventScroll: true }), 700);
  };

  const addMed = (m) => {
    setMeds((cur) => [{ id: uid(), name: m.name, dosage: m.dosage, frequency: 'As prescribed', notes: m.notes, takenOn: '' }, ...cur]);
    notify(`${m.name} added to Prescriptions.`);
  };

  const saveSummary = (a) => {
    setSaved((cur) => [{ ...a, id: uid() }, ...cur].slice(0, 30));
    notify('Summary saved in My health.');
  };

  const openSaved = (s) => { setAnalysis(s); go('agent'); };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ symptoms, doctors, meds, saved }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'healthlens-my-data.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const eraseAll = () => {
    if (!window.confirm('Delete all saved symptoms, doctors, medicines and summaries from this browser?')) return;
    setSymptoms([]); setDoctors([]); setMeds([]); setSaved([]); setCity('');
    notify('All saved data erased.');
  };

  return (
    <>
      <div className="bg" aria-hidden="true"><i className="blob b1" /><i className="blob b2" /><i className="blob b3" /></div>
      <div className="grain" aria-hidden="true" />
      <div className="pointer-light" aria-hidden="true" />

      {/* ---------- Floating navigation ---------- */}
      <header className="nav glass">
        <button className="brand" onClick={() => go('home')} aria-label="HealthLens AI home">
          <span className="logo"><Icon name="plus" size={16} /></span>
          <span className="brand-name">HealthLens <b>AI</b></span>
        </button>
        <nav className="nav-links">
          {IDS.map((id, i) => (
            <button key={id} className={`nav-link ${active === id ? 'active' : ''} ${id === 'emergency' ? 'em' : ''}`} onClick={() => go(id)}>{t.nav[i]}</button>
          ))}
        </nav>
        <div className="row gap-s">
          <div className="seg" role="group" aria-label="Language">
            <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
            <button className={lang === 'hi' ? 'on' : ''} onClick={() => setLang('hi')}>हिन्दी</button>
          </div>
          <button className="btn ghost icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" title="Toggle light and dark"><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section id="home" className="hero">
          <div className="hero-copy">
            <span className="eyebrow rise" style={{ '--d': '0ms' }}>{t.eyebrow}</span>
            <h1 className="rise" style={{ '--d': '120ms' }}>{t.h1}</h1>
            <p className="lead rise" style={{ '--d': '240ms' }}>{t.sub}</p>
            <div className="row gap wrap rise" style={{ '--d': '360ms' }}>
              <button className="btn big" onClick={() => go('agent')}><Icon name="chat" size={18} />{t.cta1}</button>
              <button className="btn ghost big" onClick={() => { go('agent'); setTimeout(() => document.querySelector('.composer .btn.icon')?.click(), 800); }}><Icon name="upload" size={18} />{t.cta2}</button>
            </div>
            <ul className="feature-list">
              {t.features.map(([icon, title, text], i) => (
                <li key={title} className="feature lift spot rise" style={{ '--d': `${480 + i * 90}ms` }}>
                  <span className="f-icon"><Icon name={icon} size={18} /></span>
                  <div><b>{title}</b><p className="muted small">{text}</p></div>
                </li>
              ))}
            </ul>
            {intro && (
              <div className="intro-bar rise" style={{ '--d': '900ms' }}>
                <span className="small muted">{t.skip}</span>
                <span className="bar"><i /></span>
                <button className="btn ghost sm" onClick={() => setIntro(false)}>{t.skipBtn}</button>
              </div>
            )}
          </div>

          <div className="stage" aria-hidden="true">
            <div className="stage-inner">
              <div className="layer l1 glass">
                <span className="eyebrow">Example preview</span>
                <div className="mini-row"><span className="mini-ic"><Icon name="file" size={15} /></span><div><b>Lab report</b><p className="muted small">Hemoglobin, glucose, lipids</p></div></div>
                <div className="mini-table">
                  <div><span>Test</span><span>Value</span><span>Lab range</span></div>
                  <div><span>Read from file</span><span>as printed</span><span>as printed</span></div>
                </div>
                <p className="muted tiny">Values are copied from your file, never guessed.</p>
              </div>
              <div className="layer l2 glass">
                <div className="bubble-a">I have had a headache and fever for two days.</div>
                <div className="bubble-b">Here is what is commonly associated with that, and what to ask a doctor.</div>
                <div className="typing-dots"><span /><span /><span /></div>
              </div>
              <div className="layer l3 glass">
                <span className="eyebrow">Next steps</span>
                <ul className="plain small">
                  <li><Icon name="flask" size={14} /> Tests to ask about</li>
                  <li><Icon name="steth" size={14} /> Which doctor to see</li>
                  <li><Icon name="list" size={14} /> Questions to bring</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Agent ---------- */}
        <section id="agent" className="section">
          <SectionHead title={t.agentTitle} sub={t.agentSub} />
          <Agent
            lang={lang}
            vault={{ meds, symptoms, doctors }}
            input={input}
            setInput={setInput}
            analysis={analysis}
            setAnalysis={(a) => { setAnalysis(a); if (a?.specialist) setSpecialist(a.specialist); }}
            addMed={addMed}
            saveSummary={saveSummary}
            notify={notify}
            city={city}
            setCity={setCity}
            backend={backend}
          />
        </section>

        {/* ---------- My health ---------- */}
        <section id="health" className="section reveal">
          <SectionHead title={t.healthTitle} sub={t.healthSub} />
          <Vault
            symptoms={symptoms} setSymptoms={setSymptoms}
            doctors={doctors} setDoctors={setDoctors}
            meds={meds} setMeds={setMeds}
            saved={saved} setSaved={setSaved}
            askAgent={askAgent} openSaved={openSaved} notify={notify}
          />
        </section>

        {/* ---------- Find care ---------- */}
        <section id="care" className="section reveal">
          <SectionHead title={t.careTitle} sub={t.careSub} />
          <FindCare specialist={specialist} setSpecialist={setSpecialist} city={city} setCity={setCity} doctorCount={doctors.length} />
        </section>

        {/* ---------- Emergency ---------- */}
        <section id="emergency" className="section reveal">
          <SectionHead title={t.emTitle} sub={t.emSub} danger />
          <Emergency notify={notify} />
        </section>

        {/* ---------- Privacy ---------- */}
        <section id="privacy" className="section reveal">
          <SectionHead title={t.privTitle} sub="Plain answers about where your information goes." />
          <div className="privacy-grid">
            <div className="glass pad spot lift">
              <h3><Icon name="shield" size={16} /> What stays on your device</h3>
              <p className="muted small">Symptoms, doctors, medicines, saved summaries and your city are kept in your browser's local storage. Nothing is uploaded to an account. Clearing browser data or pressing erase below removes it.</p>
            </div>
            <div className="glass pad spot lift">
              <h3><Icon name="globe" size={16} /> What is sent to the AI</h3>
              <p className="muted small">When you press Send, your message, recent chat turns and any files you attached go to this app's backend, which forwards them to Google's Gemini API to write the answer. Saved data is included only if you switch on "Use my saved data". The backend does not store messages or files.</p>
            </div>
            <div className="glass pad spot lift">
              <h3><Icon name="alert" size={16} /> What this is not</h3>
              <p className="muted small">HealthLens AI is educational. It does not diagnose, prescribe or replace a doctor, and AI can misread a file or be wrong. Check values against your original report. In an emergency call 112.</p>
            </div>
            <div className="glass pad spot lift">
              <h3><Icon name="download" size={16} /> Your data controls</h3>
              <div className="row gap-s wrap">
                <button className="btn ghost" onClick={exportData}><Icon name="download" size={16} />Download my data</button>
                <button className="btn danger" onClick={eraseAll}><Icon name="trash" size={16} />Erase everything</button>
              </div>
            </div>
          </div>
          <p className="muted small credits">Built with React, Vite, Node.js, Express, the Google Gemini API and the browser Web Speech API. Fonts: Bricolage Grotesque, Manrope, IBM Plex Mono (Google Fonts).</p>
        </section>
      </main>

      {toast && <div key={toast.id} className="toast glass" role="status">{toast.msg}</div>}
    </>
  );
}

function SectionHead({ title, sub, danger }) {
  return (
    <div className={`section-head ${danger ? 'danger' : ''}`}>
      <h2>{title}</h2>
      <p className="muted">{sub}</p>
    </div>
  );
}
