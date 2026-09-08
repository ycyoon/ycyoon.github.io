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
  const chips = document.querySelectorAll(".pub-filters .chip");
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

// ===== Project status filter (independent of publications) =====
(function () {
  const buttons = document.querySelectorAll("[data-project-filter]");
  const projects = document.querySelectorAll(".project");
  const result = document.getElementById("project-filter-result");

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      const filter = button.dataset.projectFilter;
      let visible = 0;
      buttons.forEach(function (item) {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      projects.forEach(function (project) {
        project.hidden = filter !== "all" && project.dataset.status !== filter;
        if (!project.hidden) visible += 1;
      });
      result.textContent = "Showing " + visible + (filter === "all" ? "" : " " + filter) + " projects.";
    });
  });
})();

// ===== Footer year =====
(function () {
  const el = document.getElementById("year");
  if (el) el.textContent = String(new Date().getFullYear());
})();
