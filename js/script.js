document.getElementById("year").textContent = new Date().getFullYear();

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

const form = document.getElementById("contactForm");
const formNote = document.getElementById("formNote");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formNote.textContent = "Danke! Deine Nachricht wurde erfasst. Wir melden uns in Kürze bei dir.";
  form.reset();
});

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Count-up numbers (hero stats)
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

// Preloader
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

    // Animated percentage counter synced to the loading bar
    const countDuration = 2600;
    const countStart = performance.now() + 250;
    function tickCount(now) {
      if (preloaderDismissed) return;
      const p = Math.min(Math.max((now - countStart) / countDuration, 0), 1);
      if (preloaderCount) preloaderCount.textContent = Math.round(p * 100) + "%";
      if (p < 1) requestAnimationFrame(tickCount);
    }
    requestAnimationFrame(tickCount);

    // Cursor-reactive spotlight + subtle ring/logo parallax inside the intro
    if (preloader) {
      preloader.addEventListener("mousemove", (e) => {
        if (preloaderSpotlight) {
          preloaderSpotlight.classList.add("active");
          preloaderSpotlight.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        }
        if (preloaderStage) {
          const rect = preloaderStage.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = (e.clientX - cx) / window.innerWidth;
          const dy = (e.clientY - cy) / window.innerHeight;
          preloaderStage.style.transform = `translate(${dx * 18}px, ${dy * 18}px)`;
        }
      });
    }

    if (preloaderSkip) {
      preloaderSkip.addEventListener("click", dismissPreloader);
    }

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

// Scroll reveal
const revealEls = document.querySelectorAll(".reveal");
if (reduceMotion) {
  revealEls.forEach((el) => el.classList.add("in-view"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("in-view", entry.isIntersecting);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
  );
  revealEls.forEach((el) => revealObserver.observe(el));
}

// Header scroll behaviour + scroll progress bar
const siteHeader = document.getElementById("siteHeader");
const scrollProgress = document.getElementById("scrollProgress");
let lastScrollY = window.scrollY;

function onScroll() {
  const y = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (y / docHeight) * 100 : 0;
  if (scrollProgress) scrollProgress.style.width = pct + "%";

  if (siteHeader) {
    siteHeader.classList.toggle("is-scrolled", y > 20);
    if (y > lastScrollY && y > 140) {
      siteHeader.classList.add("is-hidden");
    } else {
      siteHeader.classList.remove("is-hidden");
    }
  }
  lastScrollY = y;
}
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Header logo click ripple
const headerLogo = document.getElementById("headerLogo");
if (headerLogo) {
  headerLogo.addEventListener("click", () => {
    headerLogo.classList.remove("is-clicked");
    void headerLogo.offsetWidth;
    headerLogo.classList.add("is-clicked");
  });
}

if (!reduceMotion) {
  // 3D tilt on cards / steps / values / form
  const tiltEls = document.querySelectorAll(".tilt");
  tiltEls.forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rx = (0.5 - py) * 10;
      const ry = (px - 0.5) * 10;
      el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
    });
    el.addEventListener("mouseleave", () => {
      el.style.transform = "";
    });
  });

  // Hero logo parallax tilt
  const heroLogo = document.getElementById("heroLogo");
  const hero = document.querySelector(".hero");
  if (heroLogo && hero) {
    hero.addEventListener("mousemove", (e) => {
      const rect = hero.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rx = (0.5 - py) * 16;
      const ry = (px - 0.5) * 16;
      heroLogo.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    hero.addEventListener("mouseleave", () => {
      heroLogo.style.transform = "";
    });
    heroLogo.addEventListener("click", () => {
      heroLogo.style.transition = "transform .6s var(--ease)";
      heroLogo.style.transform = "perspective(900px) rotateY(360deg)";
      setTimeout(() => {
        heroLogo.style.transition = "transform .15s ease-out";
        heroLogo.style.transform = "";
      }, 620);
    });
  }

  // Ambient background parallax + hero depth on scroll
  const bgFx = document.querySelector(".bg-fx");
  const heroInner = document.querySelector(".hero-inner");

  // Continuous scroll-linked parallax (runs on scroll up AND down)
  const parallaxEls = Array.from(document.querySelectorAll(".card-icon, .step-num, .value strong"));
  let ticking = false;
  function updateParallax() {
    const y = window.scrollY;
    const vh = window.innerHeight;

    if (bgFx) bgFx.style.transform = `translateY(${y * 0.15}px)`;
    if (heroInner && y < vh) {
      heroInner.style.transform = `translateY(${y * -0.08}px)`;
    }

    parallaxEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.bottom < -100 || rect.top > vh + 100) return;
      const center = rect.top + rect.height / 2 - vh / 2;
      el.style.transform = `translateY(${center * -0.06}px)`;
    });

    ticking = false;
  }
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateParallax);
      }
    },
    { passive: true }
  );
  updateParallax();

  // Magnetic buttons
  document.querySelectorAll(".magnetic").forEach((el) => {
    const inner = el.querySelector("span") || el;
    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const dx = e.clientX - (rect.left + rect.width / 2);
      const dy = e.clientY - (rect.top + rect.height / 2);
      inner.style.transform = `translate(${dx * 0.25}px, ${dy * 0.35}px)`;
    });
    el.addEventListener("mouseleave", () => {
      inner.style.transform = "";
    });
  });

  // Custom cursor (dot + trailing ring)
  const cursorDot = document.getElementById("cursorDot");
  const cursorRing = document.getElementById("cursorRing");
  const cursorGlow = document.getElementById("cursorGlow");
  if (cursorDot && cursorRing) {
    document.documentElement.classList.add("custom-cursor");
    let ringX = window.innerWidth / 2;
    let ringY = window.innerHeight / 2;
    let targetX = ringX;
    let targetY = ringY;

    window.addEventListener("mousemove", (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      cursorDot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      cursorDot.classList.add("active");
      cursorRing.classList.add("active");
      if (cursorGlow) {
        cursorGlow.classList.add("active");
        cursorGlow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }
    });
    document.addEventListener("mouseleave", () => {
      cursorDot.classList.remove("active");
      cursorRing.classList.remove("active");
      if (cursorGlow) cursorGlow.classList.remove("active");
    });

    function animateRing() {
      ringX += (targetX - ringX) * 0.18;
      ringY += (targetY - ringY) * 0.18;
      cursorRing.style.transform = `translate(${ringX}px, ${ringY}px)`;
      requestAnimationFrame(animateRing);
    }
    animateRing();

    const hoverTargets = "a, button, .tilt, input, textarea, select";
    document.querySelectorAll(hoverTargets).forEach((el) => {
      el.addEventListener("mouseenter", () => cursorRing.classList.add("is-hovering"));
      el.addEventListener("mouseleave", () => cursorRing.classList.remove("is-hovering"));
    });
  }
}
