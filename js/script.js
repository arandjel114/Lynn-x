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

  // Hero logo parallax
  const heroLogo = document.getElementById("heroLogo");
  const hero = document.querySelector(".hero");
  if (heroLogo && hero) {
    hero.addEventListener("mousemove", (e) => {
      const rect = hero.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rx = (0.5 - py) * 16;
      const ry = (px - 0.5) * 16;
      heroLogo.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    hero.addEventListener("mouseleave", () => {
      heroLogo.style.transform = "";
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
}
