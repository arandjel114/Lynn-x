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

// Preloader
const preloader = document.getElementById("preloader");
const preloaderFill = document.getElementById("preloaderFill");
function dismissPreloader() {
  document.body.classList.remove("is-loading");
  if (preloader) preloader.classList.add("is-done");
}
if (preloader) {
  if (reduceMotion) {
    dismissPreloader();
  } else {
    requestAnimationFrame(() => {
      if (preloaderFill) preloaderFill.style.width = "100%";
    });
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1600));
    const pageLoad = new Promise((resolve) => {
      if (document.readyState === "complete") resolve();
      else window.addEventListener("load", resolve, { once: true });
    });
    Promise.all([minDelay, pageLoad]).then(dismissPreloader);
    setTimeout(dismissPreloader, 3500);
  }
} else {
  document.body.classList.remove("is-loading");
}

// Scroll reveal
const revealEls = document.querySelectorAll(".reveal");
if (reduceMotion) {
  revealEls.forEach((el) => el.classList.add("in-view"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
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
    // force reflow to restart animation
    void headerLogo.offsetWidth;
    headerLogo.classList.add("is-clicked");
  });
}

// 3D tilt on cards / steps / values / form
if (!reduceMotion) {
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

  // Hero logo parallax tilt (nested inside the idle-float wrapper)
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

  // Cursor glow spotlight
  const cursorGlow = document.getElementById("cursorGlow");
  if (cursorGlow) {
    let raf = null;
    window.addEventListener("mousemove", (e) => {
      cursorGlow.classList.add("active");
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        cursorGlow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      });
    });
    document.addEventListener("mouseleave", () => cursorGlow.classList.remove("active"));
  }

  // Ambient background parallax on scroll
  const bgFx = document.querySelector(".bg-fx");
  if (bgFx) {
    window.addEventListener(
      "scroll",
      () => {
        const y = window.scrollY;
        bgFx.style.transform = `translateY(${y * 0.15}px)`;
      },
      { passive: true }
    );
  }
}
