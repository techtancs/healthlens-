import { useEffect, useState } from 'react';

// Saves a value in the browser (localStorage) so it survives refreshes.
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage full or blocked: ignore */
    }
  }, [key, value]);
  return [value, setValue];
}

// Pointer light, card spotlight, 3D tilt, parallax and button ripple + zoom.
export function usePointerEffects() {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    let last = null;
    let lastTilt = null;
    const resetTilt = (el) => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    };

    const onMove = (e) => {
      last = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const ev = last;
        root.style.setProperty('--mx', ev.clientX + 'px');
        root.style.setProperty('--my', ev.clientY + 'px');
        root.style.setProperty('--px', ((ev.clientX / window.innerWidth - 0.5) * 2).toFixed(3));
        root.style.setProperty('--py', ((ev.clientY / window.innerHeight - 0.5) * 2).toFixed(3));

        const target = ev.target instanceof Element ? ev.target : null;
        const spot = target && target.closest('.spot');
        if (spot) {
          const r = spot.getBoundingClientRect();
          spot.style.setProperty('--sx', ev.clientX - r.left + 'px');
          spot.style.setProperty('--sy', ev.clientY - r.top + 'px');
        }
        const tilt = target && target.closest('.tilt');
        if (lastTilt && lastTilt !== tilt) resetTilt(lastTilt);
        if (tilt) {
          const r = tilt.getBoundingClientRect();
          const x = (ev.clientX - r.left) / r.width - 0.5;
          const y = (ev.clientY - r.top) / r.height - 0.5;
          tilt.style.setProperty('--ry', (x * 6).toFixed(2) + 'deg');
          tilt.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg');
        }
        lastTilt = tilt;
      });
    };

    const onDown = (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const btn = target && target.closest('.btn');
      if (!btn || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2;
      const dot = document.createElement('span');
      dot.className = 'ripple';
      dot.style.width = dot.style.height = size + 'px';
      dot.style.left = e.clientX - r.left - size / 2 + 'px';
      dot.style.top = e.clientY - r.top - size / 2 + 'px';
      btn.appendChild(dot);
      setTimeout(() => dot.remove(), 650);
      btn.classList.remove('pop');
      void btn.offsetWidth; // restart the animation
      btn.classList.add('pop');
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      cancelAnimationFrame(raf);
    };
  }, []);
}

// Fades sections in once as they enter the screen (subtle, runs once).
export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('in');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
