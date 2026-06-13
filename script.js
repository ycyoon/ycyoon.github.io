// ===== Theme toggle (persisted, respects system preference) =====
(function () {
  const root = document.documentElement;
  const toggle = document.getElementById("themeToggle");
  const stored = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initial = stored || (prefersDark ? "dark" : "light");
  root.setAttribute("data-theme", initial);

  toggle.addEventListener("click", function () {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });
})();

// ===== Publication filter =====
(function () {
  const chips = document.querySelectorAll(".chip");
  const pubs = document.querySelectorAll(".pub");

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      chips.forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      const filter = chip.dataset.filter;

      pubs.forEach(function (pub) {
        const type = pub.dataset.type;
        const show = filter === "all" || type === filter;
        pub.classList.toggle("is-hidden", !show);
      });
    });
  });
})();

// ===== Footer year =====
(function () {
  const el = document.getElementById("year");
  if (el) el.textContent = String(new Date().getFullYear());
})();
