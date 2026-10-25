import { useState } from 'react';
import Icon from './Icon.jsx';
import { careLinks, copyText } from './utils.js';

const SPECIALTIES = ['General Physician', 'Cardiologist', 'Endocrinologist', 'Dermatologist', 'Gastroenterologist', 'Neurologist', 'Orthopedist', 'Pulmonologist', 'Gynecologist', 'Pediatrician', 'ENT Specialist', 'Psychiatrist'];

export function FindCare({ specialist, setSpecialist, city, setCity, doctorCount }) {
  const links = careLinks(specialist, city);
  return (
    <div className="two-col find">
      <div className="glass pad spot">
        <h3>Search for care</h3>
        <label className="form-l">Type of doctor
          <select className="input" value={specialist} onChange={(e) => setSpecialist(e.target.value)}>
            {SPECIALTIES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="form-l">City or area
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Leave empty for near me" />
        </label>
        <div className="links">
          {links.map((l) => (
            <a key={l.url} className="link-card lift" href={l.url} target="_blank" rel="noreferrer noopener">
              <Icon name={l.icon} size={16} /><span>{l.label}</span><Icon name="link" size={14} />
            </a>
          ))}
        </div>
        <p className="muted tiny">Each button opens a live search in a new tab, so you see current listings on those sites. HealthLens AI does not count, rank or verify doctors. You have {doctorCount} saved in your own list.</p>
      </div>
      <div className="glass pad spot">
        <h3>Before you book</h3>
        <ul className="plain steps">
          <li><b>Check registration.</b> Registered doctors appear in the National Medical Register of the National Medical Commission.</li>
          <li><b>Bring your records.</b> Previous reports, a list of medicines, and your symptom log from this app.</li>
          <li><b>Ask the agent first.</b> It can prepare a question list for the exact specialty you chose.</li>
          <li><b>Consider telemedicine.</b> For non-urgent issues, e-Sanjeevani offers government-run video consultations.</li>
        </ul>
      </div>
    </div>
  );
}

export function Emergency({ notify }) {
  const [locating, setLocating] = useState(false);

  const shareLocation = () => {
    if (!navigator.geolocation) { notify('Location is not supported here.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const url = `https://www.google.com/maps?q=${p.coords.latitude},${p.coords.longitude}`;
        setLocating(false);
        if (navigator.share) { try { await navigator.share({ title: 'My location', text: 'I need help. My location:', url }); return; } catch { return; } }
        notify((await copyText(`I need help. My location: ${url}`)) ? 'Location link copied. Paste it in a message.' : url);
      },
      () => { setLocating(false); notify('Location permission was denied.'); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="emergency glass spot">
      <div className="em-main">
        <span className="eyebrow">Works without the AI or the backend</span>
        <h2>In an emergency, call 112</h2>
        <p>112 is India's single emergency number (ERSS) for police, fire and ambulance. Call first. Do not wait for an app.</p>
        <div className="row gap wrap">
          <a className="btn danger big" href="tel:112"><Icon name="phone" size={18} />Call 112</a>
          <a className="btn ghost big" href="tel:108"><Icon name="phone" size={18} />Ambulance 108</a>
          <button className="btn ghost big" onClick={shareLocation} disabled={locating}><Icon name="pin" size={18} />{locating ? 'Finding location' : 'Share my location'}</button>
        </div>
        <p className="muted tiny">108 is the ambulance number in many states but not all, and numbers can change. Confirm local numbers on the official site of your state health department.</p>
      </div>
      <div className="em-side">
        <h3>Get help right away if there is</h3>
        <ul className="plain">
          <li>Chest pain, pressure or tightness, especially with sweating or pain spreading to the arm or jaw</li>
          <li>Trouble breathing or speaking in full sentences</li>
          <li>Face drooping, arm weakness or slurred speech</li>
          <li>Heavy bleeding that does not stop, or a serious injury</li>
          <li>Fainting, a seizure, or confusion that is new</li>
          <li>Thoughts of harming yourself</li>
        </ul>
        <div className="soft-box">
          <b>Feeling overwhelmed or unsafe?</b> Tele-MANAS is India's free mental health helpline: <a href="tel:14416"><b>14416</b></a>, 24 hours.
        </div>
      </div>
    </div>
  );
}
