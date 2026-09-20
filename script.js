// e-Sia · FIT Vietnam 2026 · main script
// - i18n rendering (EN / VI), lang carried by URL query param
// - Dynamic list rendering (services, KPIs, cases, partners, sectors, help, docs, modes)
// - Presenter mode: 'P' toggle, keyboard nav, hides nav+footer+docs
// - Scroll reveal via IntersectionObserver

(function () {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const I18N = window.I18N;
  const SUPPORTED = ["en", "vi"];

  // In-memory language state — no browser storage (URL param carries state across reloads)
  let currentLang = "en";

  function getInitialLang() {
    const url = new URL(window.location.href);
    const q = url.searchParams.get("lang");
    if (q && SUPPORTED.includes(q)) return q;
    const nav = (navigator.language || "en").toLowerCase();
    if (nav.startsWith("vi")) return "vi";
    return "en";
  }

  function setLang(lang, opts = {}) {
    if (!SUPPORTED.includes(lang)) lang = "en";
    currentLang = lang;
    document.documentElement.setAttribute("lang", lang);
    document.body.setAttribute("data-lang", lang);
    if (!opts.skipUrl) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("lang", lang);
        history.replaceState(null, "", url);
      } catch (_) { /* replaceState may fail in some sandboxes */ }
    }
    render(lang);
  }

  // -------- Path-based getter: 'nav.what' → I18N[lang].nav.what --------
  function get(lang, path) {
    return path.split(".").reduce((o, k) => (o == null ? o : o[k]), I18N[lang]);
  }

  function render(lang) {
    const t = I18N[lang];

    // Meta tags
    document.title =
      lang === "vi"
        ? "e-Sia Learning — Kỹ năng chứng minh được."
        : "e-Sia Learning — Skills you can prove.";

    // Static [data-i18n]
    $$("[data-i18n]").forEach((el) => {
      const path = el.getAttribute("data-i18n");
      const value = get(lang, path);
      if (typeof value === "string") el.textContent = value;
    });

    // Lang toggle labels
    $("#langCurrent").textContent = t.lang;
    $("#langOther").textContent = lang === "en" ? "VI" : "EN";
    $("#langToggle").setAttribute("aria-label", `Language: ${t.langLabel} — switch to ${t.otherLang}`);

    // Hero modes
    const heroModes = $("#heroModes");
    heroModes.innerHTML = t.hero.modes
      .map((m, i, arr) => `<span>${m}</span>${i < arr.length - 1 ? '<em>·</em>' : ''}`)
      .join("");

    // Services
    const svc = $("#serviceGrid");
    svc.innerHTML = t.what.services
      .map(
        (s) => `
      <article class="service reveal">
        <div class="service__num">${s.n}</div>
        <h3>${s.h}</h3>
        <p>${s.p}</p>
        <div class="service__for">${s.f}</div>
      </article>`
      )
      .join("");

    // KPIs
    const kpi = $("#kpiRow");
    kpi.innerHTML = t.proof.kpis
      .map(
        (k) => `
      <div class="kpi reveal">
        <div class="kpi__num">${formatKpi(k.n)}</div>
        <div class="kpi__cap">${k.c}</div>
      </div>`
      )
      .join("");

    // Cases
    const cg = $("#caseGrid");
    cg.innerHTML = t.proof.cases
      .map((c) => {
        const media = c.img
          ? `<div class="case__media"><img src="${c.img}" alt="" loading="lazy" /></div>`
          : "";
        return `<article class="case case--rich reveal">${media}<div class="case__body"><h4>${c.h}</h4><p>${c.p}</p></div></article>`;
      })
      .join("");

    // Partner grid
    const pg = $("#partnerGrid");
    pg.innerHTML = t.partners.groups
      .map(
        (g) => `
      <div class="partner-group reveal">
        <h4>${g.h}</h4>
        <div class="chips">${g.items.map((i) => `<span>${i}</span>`).join("")}</div>
      </div>`
      )
      .join("");

    // Sector chips
    const sc = $("#sectorChips");
    sc.innerHTML = t.partners.sectors.map((s) => `<span>${s}</span>`).join("");

    // Help grid
    const hg = $("#helpGrid");
    hg.innerHTML = t.help.cards
      .map(
        (c) => `
      <div class="help-card reveal">
        <h4>${c.h}</h4>
        <ul>${c.items.map((i) => `<li>${i}</li>`).join("")}</ul>
      </div>`
      )
      .join("");

    // Docs grid
    const dg = $("#docsGrid");
    dg.innerHTML = t.docs.items
      .map(
        (d) => `
      <a class="doc-card reveal" href="${d.file}" download>
        <div class="doc-card__icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div class="doc-card__body">
          <div class="doc-card__title">${d.h}</div>
          <div class="doc-card__desc">${d.p}</div>
        </div>
        <div class="doc-card__tag">${d.tag}</div>
        <div class="doc-card__arrow">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        </div>
      </a>`
      )
      .join("");

    // Modes row
    const mr = $("#modesRow");
    mr.innerHTML = t.thanks.modes.map((m) => `<div>${m}</div>`).join("");

    // Presenter brand
    $("#presenterBrand").textContent = t.presenter.brand;

    // Presenter hint text: refresh separators
    $("#hintBefore").textContent = t.presenter.hintBefore;
    $("#hintAfter").textContent = t.presenter.hintAfter;
    $("#hintExit").textContent = t.presenter.hintExit;

    // Re-attach reveal observer to newly injected nodes
    observeReveals();
    // Update presenter total slide count (excluding docs which is hidden in present mode)
    $("#pTot").textContent = String(getPresenterSlides().length);
  }

  // Format KPI numbers: split trailing + into a smaller <span>+</span>
  function formatKpi(n) {
    if (typeof n !== "string") return n;
    return n.replace(/\+$/, '<span>+</span>');
  }

  // -------- Scroll reveal --------
  let revealObserver;
  function observeReveals() {
    if (revealObserver) revealObserver.disconnect();
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            revealObserver.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    $$(".reveal:not(.is-in)").forEach((el) => revealObserver.observe(el));
  }

  // -------- Presenter mode --------
  function getPresenterSlides() {
    // All .slide elements except .slide--docs (docs is website-only)
    return $$(".slide").filter((el) => !el.classList.contains("slide--docs"));
  }
  function currentPresenterIndex() {
    const slides = getPresenterSlides();
    const scrollY = window.scrollY + window.innerHeight * 0.35;
    for (let i = slides.length - 1; i >= 0; i--) {
      if (slides[i].offsetTop <= scrollY) return i;
    }
    return 0;
  }
  function updatePresenterCounter() {
    if (!document.body.classList.contains("presenting")) return;
    const i = currentPresenterIndex();
    $("#pCur").textContent = String(i + 1);
  }
  function goSlide(delta) {
    const slides = getPresenterSlides();
    const i = currentPresenterIndex();
    const next = Math.max(0, Math.min(slides.length - 1, i + delta));
    slides[next].scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(updatePresenterCounter, 400);
  }
  // Presenter mode is a CSS overlay — no fullscreen API (blocked in sandboxed iframes).
  // On the public GitHub Pages site the overlay fills the viewport just like fullscreen.
  function enterPresent() {
    document.body.classList.add("presenting");
    $("#presenter").setAttribute("aria-hidden", "false");
    setTimeout(() => {
      const i = currentPresenterIndex();
      getPresenterSlides()[i].scrollIntoView({ behavior: "auto", block: "start" });
      updatePresenterCounter();
    }, 50);
  }
  function exitPresent() {
    document.body.classList.remove("presenting");
    $("#presenter").setAttribute("aria-hidden", "true");
  }
  function togglePresent() {
    if (document.body.classList.contains("presenting")) exitPresent();
    else enterPresent();
  }

  // -------- Init --------
  document.addEventListener("DOMContentLoaded", () => {
    const lang = getInitialLang();
    setLang(lang, { skipUrl: false });

    // Language toggle
    $("#langToggle").addEventListener("click", () => {
      const cur = document.body.getAttribute("data-lang") || "en";
      setLang(cur === "en" ? "vi" : "en");
    });

    // Presenter button
    $("#presentBtn").addEventListener("click", togglePresent);
    $("#presenterExit").addEventListener("click", exitPresent);
    $("#pPrev").addEventListener("click", () => goSlide(-1));
    $("#pNext").addEventListener("click", () => goSlide(1));

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      // Skip if user is typing (there are no inputs on this page, but future-proof)
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      // 'P' toggles presenter mode (any time)
      if (e.key.toLowerCase() === "p" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        togglePresent();
        return;
      }

      if (!document.body.classList.contains("presenting")) return;

      if (e.key === "Escape") { e.preventDefault(); exitPresent(); }
      else if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); goSlide(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); goSlide(-1); }
      else if (e.key === "Home") { e.preventDefault(); getPresenterSlides()[0].scrollIntoView({ behavior: "smooth" }); }
      else if (e.key === "End") { e.preventDefault(); const s = getPresenterSlides(); s[s.length-1].scrollIntoView({ behavior: "smooth" }); }
    });

    // Scroll updates presenter counter
    let scrollTimer;
    window.addEventListener("scroll", () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(updatePresenterCounter, 100);
    }, { passive: true });

    // Auto-enter presenter mode if ?present=1
    const url = new URL(window.location.href);
    if (url.searchParams.get("present") === "1") {
      setTimeout(enterPresent, 200);
    }
  });
})();
