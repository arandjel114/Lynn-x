document.getElementById("year").textContent = new Date().getFullYear();

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- Navigation ---------- */
const navToggle = document.getElementById("navToggle");
const nav = document.getElementById("nav");

navToggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

nav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

/* ---------- Contact form ---------- */
const form = document.getElementById("contactForm");
const formNote = document.getElementById("formNote");

/* The site is statically hosted, so there is no server to post to. The form
   therefore hands the message to the visitor's own mail client, addressed to
   us. Previously it only printed a thank-you and discarded the input, which
   meant enquiries were silently lost. */
const CONTACT_ADDRESS = "kontakt-lynq-x@outlook.de";

/* ---------- Fragebogen: eine Frage pro Schritt ----------
   Fünf Auswahlfragen, danach die Kontaktdaten. Der Verlauf bleibt im Browser;
   abgeschickt wird am Ende eine fertig formulierte E-Mail. */
if (form) {
  const steps = Array.from(form.querySelectorAll(".quiz-step"));
  const last = steps.length - 1;
  const bar = document.getElementById("quizBar");
  const count = document.getElementById("quizCount");
  const back = document.getElementById("quizBack");
  const next = document.getElementById("quizNext");
  const send = document.getElementById("quizSend");
  let current = 0;

  const questionCount = steps.filter((s) => s.querySelector(".quiz-options")).length;

  function render() {
    steps.forEach((step, i) => step.classList.toggle("is-active", i === current));
    bar.style.transform = `scaleX(${(current + 1) / steps.length})`;
    count.textContent =
      current < questionCount
        ? `Frage ${current + 1} von ${questionCount}`
        : "Nur noch deine Kontaktdaten";
    back.hidden = current === 0;
    next.hidden = current === last;
    send.hidden = current !== last;
    formNote.textContent = "";
  }

  /* Erst prüfen, dann weiter. Ohne Antwort bringt die nächste Frage nichts. */
  function stepAnswered() {
    const group = steps[current].querySelector('input[type="radio"]');
    if (!group) return true;
    return !!form.querySelector(`input[name="${group.name}"]:checked`);
  }

  function goNext() {
    if (!stepAnswered()) {
      formNote.textContent = "Bitte wähl eine Antwort aus.";
      return;
    }
    if (current < last) {
      current += 1;
      render();
      /* Damit die nächste Frage nicht außerhalb des Bildes auftaucht. */
      steps[current].scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }
  }

  next.addEventListener("click", goNext);
  back.addEventListener("click", () => {
    if (current > 0) {
      current -= 1;
      render();
    }
  });

  /* Eine Auswahl ist eine Antwort: direkt weiterspringen, kurz verzögert,
     damit man die getroffene Wahl noch sieht. */
  form.addEventListener("change", (event) => {
    if (event.target.type !== "radio") return;
    formNote.textContent = "";
    window.setTimeout(goNext, reduceMotion ? 0 : 260);
  });

  /* Enter soll im Fragebogen weiterblättern statt abzuschicken. */
  form.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && current < last && event.target.tagName !== "TEXTAREA") {
      event.preventDefault();
      goNext();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    if (!name || !email) {
      formNote.textContent = "Bitte trag noch Name und E-Mail ein, sonst können wir nicht antworten.";
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      formNote.textContent = "Diese E-Mail-Adresse sieht nicht vollständig aus.";
      return;
    }

    const antwort = (feld) => {
      const checked = form.querySelector(`input[name="${feld}"]:checked`);
      return checked ? checked.value : "keine Angabe";
    };
    const nachricht = form.nachricht.value.trim();

    const subject = `Projektanfrage von ${name}`;
    const body =
      `Name: ${name}\n` +
      `E-Mail: ${email}\n\n` +
      `Worum es geht: ${antwort("projekt")}\n` +
      `Branche: ${antwort("branche")}\n` +
      `Ziel: ${antwort("ziel")}\n` +
      `Vorhanden: ${antwort("bestand")}\n` +
      `Zeitrahmen: ${antwort("zeit")}\n` +
      `Budget: ${antwort("budget")}\n` +
      (nachricht ? `\nAnmerkung:\n${nachricht}\n` : "");

    window.location.href =
      `mailto:${CONTACT_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    formNote.textContent =
      "Dein E-Mail-Programm öffnet sich mit der fertigen Anfrage. Bitte dort auf Senden klicken.";

    /* Nicht auf jedem Gerät ist ein Mailprogramm eingerichtet. Wer sonst vor
       einer leeren Seite säße, kann die Anfrage hier kopieren. */
    const fallback = document.getElementById("quizFallback");
    const summary = document.getElementById("quizSummary");
    if (fallback && summary) {
      summary.value = body;
      fallback.hidden = false;
    }
  });

  const copyBtn = document.getElementById("quizCopy");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const summary = document.getElementById("quizSummary");
      try {
        await navigator.clipboard.writeText(summary.value);
      } catch {
        /* Ältere Browser und unsichere Verbindungen kennen die Zwischenablage
           nicht. Dann wenigstens alles markieren. */
        summary.select();
        summary.setSelectionRange(0, summary.value.length);
      }
      copyBtn.textContent = "Kopiert";
      window.setTimeout(() => { copyBtn.textContent = "Text kopieren"; }, 2200);
    });
  }

  render();
}

/* ---------- Count-up numbers ---------- */
function runCountUp() {
  document.querySelectorAll("[data-count-to]").forEach((el) => {
    const to = parseInt(el.getAttribute("data-count-to"), 10);
    const prefix = el.getAttribute("data-prefix") || "";
    const suffix = el.getAttribute("data-suffix") || "";
    if (reduceMotion) {
      el.textContent = prefix + to + suffix;
      return;
    }
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(to * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

/* ---------- Preloader ---------- */
const preloader = document.getElementById("preloader");
const preloaderFill = document.getElementById("preloaderFill");
const preloaderCount = document.getElementById("preloaderCount");
const preloaderSkip = document.getElementById("preloaderSkip");
const preloaderSpotlight = document.getElementById("preloaderSpotlight");
const preloaderStage = document.querySelector(".preloader-stage");
let preloaderDismissed = false;

function dismissPreloader() {
  if (preloaderDismissed) return;
  preloaderDismissed = true;
  document.body.classList.remove("is-loading");
  if (preloader) preloader.classList.add("is-done");
  runCountUp();
  setTimeout(() => {
    if (preloader && preloader.parentNode) preloader.parentNode.removeChild(preloader);
  }, 1000);
}

if (preloader) {
  if (reduceMotion) {
    dismissPreloader();
  } else {
    setTimeout(() => {
      if (preloaderFill) preloaderFill.style.width = "100%";
    }, 250);

    const countDuration = 2600;
    const countStart = performance.now() + 250;
    function tickCount(now) {
      if (preloaderDismissed) return;
      const p = Math.min(Math.max((now - countStart) / countDuration, 0), 1);
      if (preloaderCount) preloaderCount.textContent = Math.round(p * 100) + "%";
      if (p < 1) requestAnimationFrame(tickCount);
    }
    requestAnimationFrame(tickCount);

    // Smoothed pointer parallax inside the intro
    let introTX = 0, introTY = 0, introX = 0, introY = 0, introRAF = null;
    preloader.addEventListener("mousemove", (e) => {
      if (preloaderSpotlight) {
        preloaderSpotlight.classList.add("active");
        preloaderSpotlight.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
      introTX = (e.clientX / window.innerWidth - 0.5) * 26;
      introTY = (e.clientY / window.innerHeight - 0.5) * 26;
      if (!introRAF) introRAF = requestAnimationFrame(introLoop);
    });
    function introLoop() {
      introX = lerp(introX, introTX, 0.1);
      introY = lerp(introY, introTY, 0.1);
      if (preloaderStage) {
        preloaderStage.style.transform =
          `perspective(900px) translate3d(${introX}px, ${introY}px, 0) rotateY(${introX * 0.35}deg) rotateX(${-introY * 0.35}deg)`;
      }
      if (preloaderDismissed) { introRAF = null; return; }
      introRAF = requestAnimationFrame(introLoop);
    }

    if (preloaderSkip) preloaderSkip.addEventListener("click", dismissPreloader);

    const minDelay = new Promise((resolve) => setTimeout(resolve, 3200));
    const pageLoad = new Promise((resolve) => {
      if (document.readyState === "complete") resolve();
      else window.addEventListener("load", resolve, { once: true });
    });
    Promise.all([minDelay, pageLoad]).then(dismissPreloader);
    setTimeout(dismissPreloader, 5000);
  }
} else {
  document.body.classList.remove("is-loading");
  runCountUp();
}

/* ---------- Section headings: split into words for a 3D flip-in ---------- */
if (!reduceMotion) {
  document.querySelectorAll(".section-title").forEach((title) => {
    const words = title.textContent.trim().split(/\s+/);
    // data-accent lists the single words that get the metallic gold fill,
    // the same way only "vorn." is gold in the hero headline.
    const accents = (title.dataset.accent || "")
      .split("|")
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);

    title.textContent = "";
    title.classList.add("ht-split");
    words.forEach((w, i) => {
      const outer = document.createElement("span");
      outer.className = "ht-word";
      const inner = document.createElement("span");
      inner.className = "ht-inner";
      if (accents.includes(w.toLowerCase())) inner.classList.add("ht-gold");
      inner.textContent = w;
      inner.style.transitionDelay = i * 0.055 + "s";
      outer.appendChild(inner);
      title.appendChild(outer);
      if (i < words.length - 1) title.appendChild(document.createTextNode(" "));
    });
  });

  const headingObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("ht-in");
          headingObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.25 }
  );
  document.querySelectorAll(".ht-split").forEach((el) => headingObserver.observe(el));
}

/* ---------- Scroll reveal ---------- */
const revealEls = document.querySelectorAll(".reveal");
if (reduceMotion) {
  revealEls.forEach((el) => el.classList.add("in-view"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          el.classList.add("in-view");
          revealObserver.unobserve(el);
          // Hand transform control over to the render loop once the
          // reveal transition has played out, so scroll-linked 3D stays snappy.
          if (el.hasAttribute("data-scene3d") || el.hasAttribute("data-depth")) {
            setTimeout(() => el.classList.add("motion-ready"), 620);
          }
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
  );
  revealEls.forEach((el) => revealObserver.observe(el));
}

/* ---------- Process path connector ---------- */
const pathEl = document.querySelector(".path");
if (pathEl) {
  if (reduceMotion) {
    pathEl.classList.add("in-view");
  } else {
    const pathObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            pathEl.classList.add("in-view");
            pathObserver.unobserve(pathEl);
          }
        });
      },
      { threshold: 0.3 }
    );
    pathObserver.observe(pathEl);
  }
}

/* ---------- FAQ accordion ---------- */
document.querySelectorAll(".faq-question").forEach((btn) => {
  btn.addEventListener("click", () => {
    const isOpen = btn.getAttribute("aria-expanded") === "true";
    document.querySelectorAll(".faq-question").forEach((b) => b.setAttribute("aria-expanded", "false"));
    btn.setAttribute("aria-expanded", String(!isOpen));
  });
});

/* ---------- Header logo click ---------- */
const headerLogo = document.getElementById("headerLogo");
if (headerLogo) {
  headerLogo.addEventListener("click", () => {
    headerLogo.classList.remove("is-clicked");
    void headerLogo.offsetWidth;
    headerLogo.classList.add("is-clicked");
  });
}

if (!reduceMotion) {
  /* =======================================================================
     Unified render loop.
     All scroll/pointer driven motion is interpolated here, once per frame.
     Layout is read only on resize, never inside the loop, so scrolling
     never triggers a forced reflow.
     ======================================================================= */

  const siteHeader = document.getElementById("siteHeader");
  const scrollProgress = document.getElementById("scrollProgress");
  const heroInner = document.querySelector(".hero-inner");
  const heroLogoTilt = document.getElementById("heroLogo");
  const hero = document.querySelector(".hero");
  const cursorGlow = document.getElementById("cursorGlow");

  // Elements that drift vertically with the scroll position
  const depthEls = Array.from(document.querySelectorAll("[data-depth]"));
  // Elements that rotate in 3D as they pass through the viewport
  const scene3dEls = Array.from(document.querySelectorAll("[data-scene3d]"));

  let vh = window.innerHeight;
  let docHeight = document.documentElement.scrollHeight - vh;
  let layout = [];

  function measure() {
    vh = window.innerHeight;
    docHeight = Math.max(1, document.documentElement.scrollHeight - vh);
    const sy = window.scrollY;
    layout = [...depthEls, ...scene3dEls].map((el) => {
      const rect = el.getBoundingClientRect();
      return { el, top: rect.top + sy, height: rect.height };
    });
  }

  // Pointer state (smoothed)
  let ptrTX = 0, ptrTY = 0, ptrX = 0, ptrY = 0;
  let glowTX = -400, glowTY = -400, glowX = -400, glowY = -400;
  // Per-tilt-card state
  const tiltState = new Map();

  document.querySelectorAll(".tilt").forEach((el) => {
    tiltState.set(el, { tx: 0, ty: 0, x: 0, y: 0, active: false, mx: 50, my: 50 });
    el.addEventListener("mouseenter", () => { tiltState.get(el).active = true; });
    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const s = tiltState.get(el);
      s.tx = (px - 0.5) * 16;
      s.ty = (0.5 - py) * 16;
      s.mx = px * 100;
      s.my = py * 100;
    });
    el.addEventListener("mouseleave", () => {
      const s = tiltState.get(el);
      s.active = false;
      s.tx = 0;
      s.ty = 0;
    });
  });

  /* Editorial rows: the row stays put and stays hoverable; only the inner
     layer leans in 3D toward the cursor, so hit-testing never flickers. */
  const rowState = new Map();
  document.querySelectorAll("[data-svc], .creed-row").forEach((row) => {
    const inner = row.querySelector(".svc-inner, .creed-inner");
    if (!inner) return;
    rowState.set(inner, { tx: 0, ty: 0, x: 0, y: 0, active: false });
    row.addEventListener("mouseenter", () => { rowState.get(inner).active = true; });
    row.addEventListener("mousemove", (e) => {
      const rect = row.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const s = rowState.get(inner);
      s.tx = (px - 0.5) * 9;
      s.ty = (0.5 - py) * 6;
      row.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
    });
    row.addEventListener("mouseleave", () => {
      const s = rowState.get(inner);
      s.active = false;
      s.tx = 0;
      s.ty = 0;
    });
  });

  window.addEventListener("mousemove", (e) => {
    glowTX = e.clientX;
    glowTY = e.clientY;
    if (cursorGlow) cursorGlow.classList.add("active");
    if (hero) {
      const rect = hero.getBoundingClientRect();
      if (e.clientY < rect.bottom) {
        ptrTX = (e.clientX / window.innerWidth - 0.5) * 2;
        ptrTY = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
      }
    }
  }, { passive: true });

  document.addEventListener("mouseleave", () => {
    if (cursorGlow) cursorGlow.classList.remove("active");
    ptrTX = 0;
    ptrTY = 0;
  });

  let lastScrollY = window.scrollY;
  let headerHidden = false;

  let prevSy = -1;
  let prevPtrX = 0, prevPtrY = 0;

  function frame() {
    const sy = window.scrollY;
    const scrollChanged = sy !== prevSy;
    prevSy = sy;

    /* --- Header + progress --- */
    if (scrollChanged && scrollProgress) scrollProgress.style.width = (sy / docHeight) * 100 + "%";
    if (siteHeader) {
      siteHeader.classList.toggle("is-scrolled", sy > 20);
      const goingDown = sy > lastScrollY;
      if (goingDown && sy > 160 && !headerHidden) {
        siteHeader.classList.add("is-hidden");
        headerHidden = true;
      } else if (!goingDown && headerHidden) {
        siteHeader.classList.remove("is-hidden");
        headerHidden = false;
      }
    }
    lastScrollY = sy;

    /* --- Smoothed pointer --- */
    ptrX = lerp(ptrX, ptrTX, 0.08);
    ptrY = lerp(ptrY, ptrTY, 0.08);
    glowX = lerp(glowX, glowTX, 0.14);
    glowY = lerp(glowY, glowTY, 0.14);
    if (cursorGlow) cursorGlow.style.transform = `translate3d(${glowX}px, ${glowY}px, 0)`;

    const ptrMoved = Math.abs(ptrX - prevPtrX) > 0.0005 || Math.abs(ptrY - prevPtrY) > 0.0005;
    prevPtrX = ptrX;
    prevPtrY = ptrY;

    /* --- Hero: text drifts up, logo tilts toward the pointer --- */
    if (scrollChanged && heroInner && sy < vh) {
      heroInner.style.transform = `translate3d(0, ${sy * -0.07}px, 0)`;
    }
    if (ptrMoved && heroLogoTilt) {
      heroLogoTilt.style.transform =
        `perspective(900px) rotateY(${ptrX * 9}deg) rotateX(${-ptrY * 9}deg) translate3d(${ptrX * 8}px, ${ptrY * 8}px, 0)`;
    }

    /* --- Scroll-linked depth + 3D, using cached layout --- */
    if (scrollChanged) {
      for (let i = 0; i < layout.length; i++) {
        const item = layout[i];
        const el = item.el;
        // Don't fight the reveal transition: wait until it has finished.
        if (el.classList.contains("reveal") && !el.classList.contains("motion-ready")) continue;
        const center = item.top + item.height / 2 - sy - vh / 2;
        if (center < -vh * 1.2 || center > vh * 1.2) continue;

        const depth = el.dataset.depth;
        let value;
        if (depth) {
          value = Math.round(center * -parseFloat(depth) * 100) / 100;
          if (value === item.last) continue;
          el.style.transform = `translate3d(0, ${value}px, 0)`;
        } else {
          const strength = parseFloat(el.dataset.scene3d) || 1;
          const clamped = Math.max(-1, Math.min(1, center / (vh / 2)));
          value = Math.round(clamped * 1000) / 1000;
          if (value === item.last) continue;
          el.style.transform =
            `perspective(1400px) rotateX(${(value * 6 * strength).toFixed(3)}deg) scale(${(1 - Math.abs(value) * 0.035 * strength).toFixed(4)})`;
        }
        item.last = value;
      }
    }

    /* --- Remaining tilt surfaces (contact form) --- */
    tiltState.forEach((s, el) => {
      if (!s.active && Math.abs(s.x) < 0.01 && Math.abs(s.y) < 0.01) return;
      s.x = lerp(s.x, s.tx, 0.16);
      s.y = lerp(s.y, s.ty, 0.16);
      const lift = s.active ? -6 : 0;
      el.style.transform =
        `perspective(900px) rotateY(${s.x}deg) rotateX(${s.y}deg) translate3d(0, ${lift}px, 0)`;
      el.style.setProperty("--mx", s.mx + "%");
      el.style.setProperty("--my", s.my + "%");
      if (!s.active && Math.abs(s.x) < 0.01 && Math.abs(s.y) < 0.01) {
        s.x = 0; s.y = 0;
        el.style.transform = "";
      }
    });

    /* --- Editorial rows lean into 3D under the cursor --- */
    rowState.forEach((s, el) => {
      if (!s.active && Math.abs(s.x) < 0.01 && Math.abs(s.y) < 0.01) return;
      s.x = lerp(s.x, s.tx, 0.14);
      s.y = lerp(s.y, s.ty, 0.14);
      if (!s.active && Math.abs(s.x) < 0.01 && Math.abs(s.y) < 0.01) {
        s.x = 0; s.y = 0;
        el.style.transform = "";
        return;
      }
      el.style.transform =
        `rotateY(${s.x.toFixed(3)}deg) rotateX(${s.y.toFixed(3)}deg)`;
    });

    requestAnimationFrame(frame);
  }

  measure();
  requestAnimationFrame(frame);

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(measure, 150);
  });
  window.addEventListener("load", measure);
  // Re-measure once reveals have settled so cached offsets stay accurate
  setTimeout(measure, 1200);
  setTimeout(measure, 4200);

  /* ---------- CTA: leans in 3D toward the pointer ---------- */
  document.querySelectorAll(".cta").forEach((cta) => {
    const state = { tx: 0, ty: 0, x: 0, y: 0, active: false };
    let raf = null;
    function loop() {
      state.x = lerp(state.x, state.tx, 0.16);
      state.y = lerp(state.y, state.ty, 0.16);
      cta.style.transform =
        `perspective(600px) rotateX(${state.y.toFixed(2)}deg) rotateY(${state.x.toFixed(2)}deg)`;
      if (!state.active && Math.abs(state.x) < 0.02 && Math.abs(state.y) < 0.02) {
        cta.style.transform = "";
        raf = null;
        return;
      }
      raf = requestAnimationFrame(loop);
    }
    cta.addEventListener("mouseenter", () => {
      state.active = true;
      if (!raf) raf = requestAnimationFrame(loop);
    });
    cta.addEventListener("mousemove", (e) => {
      const r = cta.getBoundingClientRect();
      state.tx = ((e.clientX - r.left) / r.width - 0.5) * 18;
      state.ty = (0.5 - (e.clientY - r.top) / r.height) * 12;
    });
    cta.addEventListener("mouseleave", () => {
      state.active = false;
      state.tx = 0;
      state.ty = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    });
  });

  /* ---------- Magnetic buttons ---------- */
  document.querySelectorAll(".magnetic").forEach((el) => {
    const inner = el.querySelector("span") || el;
    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      inner.style.transform = `translate3d(${dx * 0.25}px, ${dy * 0.35}px, 0)`;
    });
    el.addEventListener("mouseleave", () => {
      inner.style.transform = "";
    });
  });

  /* ---------- Button click ripple ---------- */
  document.querySelectorAll(".btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.8;
      const ripple = document.createElement("span");
      ripple.className = "btn-ripple";
      ripple.style.width = ripple.style.height = size + "px";
      ripple.style.left = e.clientX - rect.left - size / 2 + "px";
      ripple.style.top = e.clientY - rect.top - size / 2 + "px";
      btn.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    });
  });
}
