const GITHUB_USER = "maMai20";
const GITHUB_API = "https://api.github.com";
const languageColors = {
  JavaScript: "#f7df1e",
  TypeScript: "#3178c6",
  CSS: "#38bdf8",
  HTML: "#f97316",
  React: "#61dafb",
  Python: "#a7f3d0",
  "C++": "#f9a8d4",
  Other: "#94a3b8"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function compactNumber(value) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

async function getJson(path) {
  const response = await fetch(GITHUB_API + path, {
    headers: { Accept: "application/vnd.github+json" }
  });
  if (!response.ok) throw new Error("GitHub API request failed");
  return response.json();
}

function renderLanguages(repositories) {
  const counts = {};
  repositories.forEach((repo) => {
    const language = repo.language || "Other";
    counts[language] = (counts[language] || 0) + 1;
  });

  const entries = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (!entries.length) return;

  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const stops = [];
  let cursor = 0;
  entries.forEach(([language, count]) => {
    const next = cursor + (count / total) * 100;
    stops.push((languageColors[language] || languageColors.Other) + " " + cursor + "% " + next + "%");
    cursor = next;
  });

  const donut = $("[data-language-donut]");
  if (donut) donut.style.background = "conic-gradient(" + stops.join(", ") + ")";

  const legend = $("[data-language-legend]");
  if (legend) {
    legend.innerHTML = entries.map(([language, count]) => {
      const color = languageColors[language] || languageColors.Other;
      return '<span class="legend-item"><i class="legend-dot" style="background:' + color + '"></i>' +
        language + '<small>' + count + '</small></span>';
    }).join("");
  }
}

function renderActivity(events) {
  const chart = $("[data-activity-chart]");
  if (!chart) return;

  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - (6 - index));
    return date;
  });

  const counts = days.map((day) => {
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);
    return events.reduce((total, event) => {
      const created = new Date(event.created_at);
      if (created >= day && created < nextDay) {
        return total + (event.type === "PushEvent" ? Math.max(event.payload?.commits?.length || 1, 1) : 1);
      }
      return total;
    }, 0);
  });

  const max = Math.max(...counts, 1);
  chart.innerHTML = counts.map((count, index) => {
    const height = Math.max(12, Math.round((count / max) * 100));
    return '<span class="bar" title="' + count + ' event' + (count === 1 ? "" : "s") + '" style="height:' + height + '%;animation-delay:' + index * 70 + 'ms"></span>';
  }).join("");
}

function projectMarkup(repo, index) {
  const description = repo.description || "A practical project exploring useful interfaces and thoughtful user flows.";
  const language = repo.language || "frontend";
  return '<article class="project-card">' +
    '<span class="project-number">' + String(index + 1).padStart(2, "0") + '</span>' +
    '<div><h3><a href="' + repo.html_url + '" target="_blank" rel="noreferrer">' + repo.name + ' ↗</a></h3>' +
    '<p>' + description.replace(/[<>]/g, "") + '</p></div>' +
    '<div class="project-meta"><span>' + language + '</span><span>★ ' + compactNumber(repo.stargazers_count) + '</span><span>⑂ ' + compactNumber(repo.forks_count) + '</span></div>' +
    '</article>';
}

function renderProjects(repositories) {
  const list = $("[data-project-list]");
  if (!list) return;

  const ranked = [...repositories]
    .filter((repo) => !repo.fork)
    .sort((a, b) => {
      if (a.name.toLowerCase() === "sucktv2") return -1;
      if (b.name.toLowerCase() === "sucktv2") return 1;
      return new Date(b.pushed_at) - new Date(a.pushed_at);
    })
    .slice(0, 4);

  if (!ranked.length) {
    list.innerHTML = '<article class="project-card"><span class="project-number">01</span><div><h3>No public projects yet</h3><p>The next project can live here.</p></div></article>';
    return;
  }

  list.innerHTML = ranked.map(projectMarkup).join("");
  setText("[data-featured-count]", String(ranked.length).padStart(2, "0"));
}

async function loadProfile() {
  const status = $("[data-sync-status]");
  try {
    const [profile, repositories, events] = await Promise.all([
      getJson("/users/" + GITHUB_USER),
      getJson("/users/" + GITHUB_USER + "/repos?per_page=100&sort=updated"),
      getJson("/users/" + GITHUB_USER + "/events/public?per_page=100")
    ]);

    const stars = repositories.reduce((total, repo) => total + repo.stargazers_count, 0);
    const forks = repositories.reduce((total, repo) => total + repo.forks_count, 0);

    setText("[data-followers]", compactNumber(profile.followers));
    setText("[data-repos]", compactNumber(profile.public_repos));
    setText("[data-stars]", compactNumber(stars));
    setText("[data-forks]", compactNumber(forks));
    setText("[data-visits]", "live");
    setText("[data-last-sync]", "synced just now");
    if (status) {
      status.textContent = "live · GitHub data synced";
      status.style.color = "var(--mint)";
    }

    renderLanguages(repositories);
    renderActivity(events);
    renderProjects(repositories);
  } catch (error) {
    if (status) {
      status.textContent = "visual mode · GitHub data unavailable";
      status.style.color = "var(--yellow)";
    }
    setText("[data-last-sync]", "visual mode");
    renderActivity([]);
  }
}

function setupNavigation() {
  const menuToggle = $(".menu-toggle");
  const nav = $(".main-nav");
  if (menuToggle && nav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.textContent = isOpen ? "×" : "☰";
    });
  }

  $$(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      $$(".nav-link").forEach((item) => item.classList.remove("is-active"));
      link.classList.add("is-active");
      nav?.classList.remove("is-open");
      menuToggle?.setAttribute("aria-expanded", "false");
      if (menuToggle) menuToggle.textContent = "☰";
    });
  });

  const sections = $$("main section[id]");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          $$(".nav-link").forEach((link) => {
            link.classList.toggle("is-active", link.getAttribute("href") === "#" + entry.target.id);
          });
        }
      });
    }, { rootMargin: "-35% 0px -55% 0px" });
    sections.forEach((section) => observer.observe(section));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setText("[data-year]", new Date().getFullYear());
  setupNavigation();
  loadProfile();
});
