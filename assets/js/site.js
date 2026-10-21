/* THE MEASURE – Interaktion und Scroll-Inszenierung
   Ohne JavaScript und bei "Bewegung reduzieren" ist alles vollständig lesbar. */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var desktop = window.matchMedia("(min-width: 821px)");
  var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  var motion = !reduce && hasGsap;
  if (motion) root.classList.add("motion");

  /* ---------- Minuterie: 60 Striche, jeder fünfte länger, genau einer hervorgehoben ---------- */
  var svgNS = "http://www.w3.org/2000/svg";
  function minuterie(el, active, n) {
    n = n || 60;
    var w = 600, step = w / n, lines = [];
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + w + " 16");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    for (var i = 0; i <= n; i++) {
      var l = document.createElementNS(svgNS, "line");
      l.setAttribute("x1", i * step); l.setAttribute("x2", i * step); l.setAttribute("y1", 0);
      l.setAttribute("vector-effect", "non-scaling-stroke");
      svg.appendChild(l); lines.push(l);
    }
    el.replaceChildren(svg);
    function style(l, i, hi) {
      l.setAttribute("y2", hi ? 16 : (i % 5 === 0 ? 8 : 4));
      l.setAttribute("stroke", hi ? "var(--tm-velvet)" : "currentColor");
      l.setAttribute("stroke-width", hi ? 1.6 : 1);
      l.classList.toggle("is-hi", hi);
    }
    var api = { lines: lines, current: null, set: function (a) {
      if (a === api.current) return;
      if (api.current !== null && lines[api.current]) style(lines[api.current], api.current, false);
      api.current = a;
      if (a !== null && lines[a]) style(lines[a], a, true);
    } };
    lines.forEach(function (l, i) { style(l, i, false); });
    api.set(active == null ? null : active);
    return api;
  }
  document.querySelectorAll("[data-minuterie]").forEach(function (el) {
    var a = el.getAttribute("data-active");
    el._tm = minuterie(el, a === null ? null : parseInt(a, 10));
  });

  /* ---------- Footer-Uhr: zuerst die Zeit, wo man die Seite gerade ansieht, daneben Wien ---------- */
  var CITY_DE = { Vienna: "Wien", Rome: "Rom", Prague: "Prag", Warsaw: "Warschau", Moscow: "Moskau", Lisbon: "Lissabon", Copenhagen: "Kopenhagen", Brussels: "Brüssel", Athens: "Athen", Bucharest: "Bukarest", Belgrade: "Belgrad", Zurich: "Zürich", Kiev: "Kiew", Kyiv: "Kiew", Luxembourg: "Luxemburg", Nicosia: "Nikosia", Sofia: "Sofia", Tallinn: "Tallinn", Vilnius: "Vilnius", Riga: "Riga", Mexico_City: "Mexiko-Stadt", Tokyo: "Tokio", Singapore: "Singapur", Calcutta: "Kalkutta", Kolkata: "Kalkutta" };
  var EN = document.documentElement.lang === "en";
  var T = EN
    ? { vienna: "Vienna", yourTime: "Your time", open: "Open until 3 am", opens: "Opens today at 6 pm", menu: "Menu", close: "Close" }
    : { vienna: "Wien", yourTime: "Deine Zeit", open: "Geöffnet bis 3 Uhr", opens: "Öffnet heute um 18 Uhr", menu: "Menü", close: "Schließen" };
  function cityFromZone(tz) {
    if (!tz || tz.indexOf("/") < 0) return T.yourTime;
    var c = tz.split("/").pop();
    return (!EN && CITY_DE[c]) || c.replace(/_/g, " ");
  }
  function timeIn(tz) {
    try {
      var parts = new Intl.DateTimeFormat("de-AT", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      var h = 0, m = 0;
      parts.forEach(function (p) { if (p.type === "hour") h = parseInt(p.value, 10); if (p.type === "minute") m = parseInt(p.value, 10); });
      return { h: h, m: m };
    } catch (e) { var d = new Date(); return { h: d.getHours(), m: d.getMinutes() }; }
  }
  function pad(x) { return (x < 10 ? "0" : "") + x; }
  var localZone = "";
  try { localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  var inVienna = localZone === "Europe/Vienna";
  var zones = document.querySelector("[data-clock-zones]");
  var clockEl = document.querySelector("[data-clock]");
  var clock = clockEl ? minuterie(clockEl, null) : null;
  if (zones) {
    zones.querySelector("[data-zone-local-name]").textContent = inVienna ? T.vienna : cityFromZone(localZone);
    if (inVienna) {
      zones.querySelector("[data-zone-vienna]").remove();
      zones.querySelector(".zone--left").classList.add("zone--single");
    }
  }
  var barStatus = document.querySelector("[data-bar-status]");
  function tick() {
    var loc = localZone ? timeIn(localZone) : timeIn(undefined);
    var vie = timeIn("Europe/Vienna");
    if (clock) clock.set(loc.m);
    if (zones) {
      zones.querySelector("[data-zone-local-time]").textContent = pad(loc.h) + ":" + pad(loc.m);
      var v = zones.querySelector("[data-zone-vienna-time]");
      if (v) v.textContent = pad(vie.h) + ":" + pad(vie.m);
    }
    if (barStatus) {
      var open = vie.h >= 18 || vie.h < 3;
      barStatus.classList.toggle("is-closed", !open);
      barStatus.lastElementChild.textContent = open ? T.open : T.opens;
    }
  }
  tick(); setInterval(tick, 15000);

  /* ---------- Header und Menü ---------- */
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".menu-toggle");
  var menu = document.getElementById("mobile-menu");
  function closeMenu() {
    root.classList.remove("menu-open");
    if (toggle) { toggle.setAttribute("aria-expanded", "false"); toggle.querySelector(".label").textContent = T.menu; }
    if (window.__lenis) window.__lenis.start();
  }
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = !root.classList.contains("menu-open");
      root.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.querySelector(".label").textContent = open ? T.close : T.menu;
      if (window.__lenis) { open ? window.__lenis.stop() : window.__lenis.start(); }
    });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) closeMenu(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  }

  var sections = Array.prototype.slice.call(document.querySelectorAll("[data-header]"));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav a[data-nav]"));
  var chapters = Array.prototype.slice.call(document.querySelectorAll("[data-chapter]"));
  var navMap = { idee: "idee", erleben: "erleben", anfang: "erleben", ueber: "ueber", wissen: "ueber", josef: "josef", kontakt: "kontakt" };
  var lastY = window.scrollY;
  function sectionAt(y) {
    for (var i = 0; i < sections.length; i++) {
      var r = sections[i].getBoundingClientRect();
      if (r.top <= y && r.bottom > y) return sections[i];
    }
    return null;
  }
  function onScroll() {
    var y = window.scrollY;
    if (header && sections.length) {
      var probe = (header.offsetHeight || 64) * 0.5;
      var current = sectionAt(probe);
      var theme = current ? current.getAttribute("data-header") : "paper";
      if (current && current.id === "top") {
        var hm = current.querySelector("[data-hero-media]");
        var heroEnd = (desktop.matches ? current : hm).getBoundingClientRect().bottom;
        theme = heroEnd > header.offsetHeight + 2 ? "hero" : "dark";
      }
      header.setAttribute("data-theme", theme);
      // aktiver Menüpunkt: letztes Kapitel, dessen Anfang über der Bildschirmmitte liegt
      var mid = window.innerHeight * 0.5, activeId = null;
      chapters.forEach(function (c) { if (c.getBoundingClientRect().top < mid) activeId = navMap[c.id] || activeId; });
      navLinks.forEach(function (a) {
        if (a.getAttribute("data-nav") === "journal") return;
        if (a.getAttribute("data-nav") === activeId) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      });
    }
    if (header && desktop.matches && window.innerWidth >= 1100) {
      var past = y > window.innerHeight * 1.4;
      if (!root.classList.contains("menu-open")) header.classList.toggle("is-hidden", past && y > lastY + 4);
      if (y < lastY - 4 || !past) header.classList.remove("is-hidden");
    }
    lastY = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Reveals (einmalig) ---------- */
  function observe(sel, cls, margin, viaParent) {
    var els = document.querySelectorAll(sel);
    if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add(cls); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        (en.target._tmTarget || en.target).classList.add(cls);
        io.unobserve(en.target);
      });
    }, { rootMargin: margin || "0px 0px -10% 0px", threshold: 0.05 });
    els.forEach(function (e) { var t = viaParent ? e.parentElement : e; t._tmTarget = e; io.observe(t); });
  }
  if (motion) {
    observe("[data-reveal]", "is-in");
    observe("[data-reveal-lines]", "is-in");
    observe("[data-shutter]", "is-in", "0px 0px -8% 0px", true);
  }

  /* ---------- Neueste Journal-Beiträge live nachladen (auf Netlify, ohne Deploy) ---------- */
  var jc = document.querySelector("[data-journal-cards]");
  if (jc && window.fetch) {
    fetch("/api/journal.json", { headers: { accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.count) return;
        jc.innerHTML = d.html;
        jc.querySelectorAll("[data-reveal]").forEach(function (e) { e.classList.add("is-in"); });
      })
      .catch(function () {});
  }

  /* ---------- Journal: Teilen und Instagram-Story-Bild ----------
     "Link teilen" öffnet am Handy das Teilen-Menü (sonst Link kopieren).
     "Als Instagram-Story teilen" zeichnet ein 1080×1920-Bild (Foto, Titel, Autor, Logo) und teilt es
     als Datei. Das Bild wird vorab erzeugt, damit der Klick sofort das Teilen-Menü öffnen darf. */
  document.querySelectorAll("[data-share]").forEach(function (box) {
    var d = box.dataset, note = box.querySelector("[data-share-note]"), timer;
    function say(t) { if (!note) return; note.textContent = t; note.hidden = false; clearTimeout(timer); timer = setTimeout(function () { note.hidden = true; }, 7000); }
    function copy(text) { try { return navigator.clipboard.writeText(text); } catch (e) { return Promise.reject(e); } }

    box.querySelectorAll("[data-share-link]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (navigator.share) { navigator.share({ title: d.title + " – The Measure", url: d.url }).catch(function () {}); return; }
        copy(d.url).then(function () { say("Link kopiert."); }, function () { say(d.url); });
      });
    });

    function loadImg(src) {
      return new Promise(function (res, rej) { var i = new Image(); i.decoding = "async"; i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
    }
    function wrap(ctx, text, max, maxLines) {
      var words = text.split(/\s+/), lines = [], line = "";
      words.forEach(function (w) { var t = line ? line + " " + w : w; if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t; });
      if (line) lines.push(line);
      if (lines.length > maxLines) { lines = lines.slice(0, maxLines); var l = lines[maxLines - 1]; while (ctx.measureText(l + " …").width > max && l.indexOf(" ") > 0) l = l.slice(0, l.lastIndexOf(" ")); lines[maxLines - 1] = l + " …"; }
      return lines;
    }
    function storyImage() {
      var W = 1080, H = 1920, PH = 1300, L = 96;
      var sym = document.getElementById("logo-full");
      var logoSrc = sym ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.8 324.2 100.8" fill="#FAF9F5">' + sym.innerHTML + "</svg>") : null;
      return Promise.all([
        document.fonts ? document.fonts.load('500 76px "PP Frama"') : null,
        document.fonts ? document.fonts.load('400 30px "PP Frama Text"') : null,
        d.img ? loadImg(d.img).catch(function () { return null; }) : null,
        logoSrc ? loadImg(logoSrc).catch(function () { return null; }) : null
      ]).then(function (r) {
        var photo = r[2], logo = r[3];
        var c = document.createElement("canvas"); c.width = W; c.height = H;
        var x = c.getContext("2d");
        x.fillStyle = "#232323"; x.fillRect(0, 0, W, H);
        if (photo) {
          var s = Math.max(W / photo.naturalWidth, PH / photo.naturalHeight), w = photo.naturalWidth * s, h = photo.naturalHeight * s;
          x.drawImage(photo, (W - w) / 2, (PH - h) / 2, w, h);
          var g = x.createLinearGradient(0, 0, 0, 480); g.addColorStop(0, "rgba(35,35,35,.8)"); g.addColorStop(1, "rgba(35,35,35,0)"); x.fillStyle = g; x.fillRect(0, 0, W, 480);
          g = x.createLinearGradient(0, PH - 420, 0, PH); g.addColorStop(0, "rgba(35,35,35,0)"); g.addColorStop(1, "#232323"); x.fillStyle = g; x.fillRect(0, PH - 420, W, 420);
        }
        if (logo) { var lw = 340; x.drawImage(logo, (W - lw) / 2, 250, lw, lw * 100.8 / 324.2); }
        // Text von unten nach oben aufbauen, damit unten Platz für Instagram bleibt
        x.textBaseline = "alphabetic";
        x.font = '500 76px "PP Frama", "Helvetica Neue", Arial, sans-serif';
        var lines = wrap(x, d.title, W - 2 * L, 4);
        var by = 1610, ty = by - 74 - (lines.length - 1) * 86, oy = ty - 104;
        x.fillStyle = "#FAF9F5"; x.fillRect(L, oy - 22, 3, 24);
        x.font = '400 26px "PP Frama Text", "Helvetica Neue", Arial, sans-serif';
        if ("letterSpacing" in x) x.letterSpacing = "5px";
        x.fillStyle = "#C9C5BA"; x.fillText(("Journal · " + d.date).toUpperCase(), L + 22, oy);
        if ("letterSpacing" in x) x.letterSpacing = "0px";
        x.font = '500 76px "PP Frama", "Helvetica Neue", Arial, sans-serif'; x.fillStyle = "#FAF9F5";
        lines.forEach(function (l, i) { x.fillText(l, L, ty + i * 86); });
        x.font = '400 30px "PP Frama Text", "Helvetica Neue", Arial, sans-serif'; x.fillStyle = "#C9C5BA";
        x.fillText(d.author, L, by);
        // Minuterie als Abschluss
        x.fillStyle = "rgba(250,249,245,.35)";
        for (var k = 0; k <= 60; k++) { var tx = L + k * (W - 2 * L) / 60, th = k % 5 ? 10 : 22; x.fillRect(tx, 1648, 2, th); }
        return new Promise(function (res) { c.toBlob(res, "image/png"); });
      });
    }

    var storyBtn = box.querySelector("[data-share-story]"), ready = null;
    if (!storyBtn) return;
    function prepare() { if (!ready) ready = storyImage().then(function (blob) { return new File([blob], (d.slug || "the-measure") + "-story.png", { type: "image/png" }); }); return ready; }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { prepare(); io.disconnect(); } }, { rootMargin: "600px" });
      io.observe(storyBtn);
    }
    var file = null;
    storyBtn.addEventListener("pointerenter", prepare);
    storyBtn.addEventListener("click", function () {
      var go = function (f) {
        copy(d.url).catch(function () {});
        if (navigator.canShare && navigator.canShare({ files: [f] })) {
          navigator.share({ files: [f] }).then(function () {
            say("In Instagram oben den Link-Sticker antippen und den Link einfügen, er ist schon kopiert.");
          }).catch(function () {});
        } else {
          var a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name;
          document.body.appendChild(a); a.click(); a.remove();
          say("Story-Bild gespeichert. Am Handy kannst du es direkt mit Instagram teilen. Link: " + d.url);
        }
      };
      if (file) return go(file);
      var label = storyBtn.textContent; storyBtn.disabled = true; storyBtn.textContent = "Bild wird erstellt …";
      prepare().then(function (f) { file = f; storyBtn.disabled = false; storyBtn.textContent = label; go(f); }, function () {
        storyBtn.disabled = false; storyBtn.textContent = label; say("Das Bild konnte nicht erstellt werden.");
      });
    });
    prepare().then(function (f) { file = f; }, function () {});
  });

  if (!motion) {
    document.querySelectorAll(".lines").forEach(function (e) { e.classList.add("is-in"); });
    return;
  }

  /* ================= Scroll-Inszenierung mit GSAP + Lenis ================= */
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  var lenis = null;
  if (typeof window.Lenis !== "undefined") {
    lenis = new Lenis({ duration: 1.25, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    window.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }
  function scrollToEl(target) {
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.8 });
    else target.scrollIntoView({ behavior: "smooth" });
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href*="#"]');
    if (!a) return;
    var url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    var target = document.querySelector(url.hash);
    if (!target) return;
    e.preventDefault();
    scrollToEl(target);
    history.replaceState(null, "", url.hash);
  });
  if (location.hash && lenis) {
    var t0 = document.querySelector(location.hash);
    if (t0) setTimeout(function () { lenis.scrollTo(t0, { immediate: true }); }, 80);
  }

  var mm = gsap.matchMedia();

  /* ---------- Einstieg: Logo tritt zurück, das Bild öffnet sich aus der Minuterie-Linie.
                Alle Werte sind explizit gesetzt, damit beim Hochscrollen das Logo wieder erscheint. ---------- */
  var hero = document.querySelector(".hero");
  if (hero) {
    var media = hero.querySelector("[data-hero-media]");
    var img = media.querySelector("img");
    var introLogo = hero.querySelector("[data-intro-logo]");
    var introTicks = hero.querySelector("[data-intro-ticks]");
    var heroText = hero.querySelector("[data-hero-text]");
    var heroH1 = hero.querySelector("h1.lines");
    var hint = hero.querySelector(".hero__scrollhint");
    var brand = document.querySelector(".brand");

    function heroIntro(o) {
      // Der Spalt liegt genau auf der Minuterie unter dem Logo und hat ihre Breite
      var closed = function () {
        var tr = introTicks.getBoundingClientRect(), mr = media.getBoundingClientRect();
        var x = Math.max(0, (window.innerWidth - (tr.width || 300)) / 2);
        var lineY = (tr.top + tr.height / 2) - mr.top;
        var top = Math.max(0, lineY), bottom = Math.max(0, mr.height - lineY);
        return "inset(" + top.toFixed(1) + "px " + x.toFixed(1) + "px " + bottom.toFixed(1) + "px " + x.toFixed(1) + "px)";
      };
      var OPEN = "inset(0px 0px 0px 0px)";

      gsap.set(media, { clipPath: closed() });
      gsap.set(img, { scale: o.from, transformOrigin: o.origin });
      gsap.set(heroText, { autoAlpha: 0, y: 40 });
      gsap.set(brand, { autoAlpha: 0 });

      // Auftakt beim Laden
      var tickLines = introTicks && introTicks._tm ? introTicks._tm.lines : [];
      var introWrap = hero.querySelector(".hero__intro-inner");
      gsap.fromTo(introWrap, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.6, ease: "power2.out", delay: 0.15 });
      gsap.fromTo(tickLines, { scaleY: 0, transformOrigin: "50% 0%" }, { scaleY: 1, duration: 0.7, stagger: 0.012, ease: "power2.out", delay: 0.4 });

      var tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: hero, start: "top top", end: o.end, scrub: 1, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: function (self) {
            if (self.progress > 0.62) heroH1.classList.add("is-in");
            else if (self.progress < 0.5) heroH1.classList.remove("is-in");
          }
        }
      });
      tl.fromTo(introLogo, { y: 0, autoAlpha: 1, scale: 1 }, { y: -50, autoAlpha: 0, scale: 0.92, duration: 0.35 }, 0)
        .fromTo(introTicks, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2 }, 0.08)
        .fromTo(hint, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.15 }, 0)
        .fromTo(media, { clipPath: closed }, { clipPath: OPEN, duration: 0.6, ease: "power2.inOut" }, 0.1)
        .fromTo(img, { scale: o.from }, { scale: o.to, duration: 0.88, ease: "power1.out" }, 0.1)
        .fromTo(brand, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0.35)
        .fromTo(heroText, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out" }, 0.62)
        .to({}, { duration: 0.08 });

      return function () { gsap.set([media, img, heroText, brand, hint, introLogo, introTicks, introWrap], { clearProps: "all" }); heroH1.classList.remove("is-in"); };
    }

    mm.add("(min-width: 821px)", function () { return heroIntro({ end: "+=140%", from: 1.3, to: 1.12, origin: "0% 60%" }); });
    // Mobil: dasselbe Prinzip, kürzer. Das Logo steht in der Bildschirmmitte, das Bild öffnet sich aus der Linie.
    mm.add("(max-width: 820px)", function () { return heroIntro({ end: "+=90%", from: 1.25, to: 1, origin: "50% 50%" }); });
  }

  /* ---------- Statement: Wörter füllen sich beim Lesen mit Tinte ---------- */
  document.querySelectorAll("[data-scrub-words]").forEach(function (p) {
    var text = p.textContent.trim();
    p.setAttribute("aria-label", text);
    p.innerHTML = text.split(/\s+/).map(function (w) { return '<span class="w" aria-hidden="true">' + w + "</span>"; }).join(" ");
    gsap.fromTo(p.querySelectorAll(".w"), { color: "#CFCBC0" }, {
      color: "#232323", ease: "none", stagger: 0.1,
      scrollTrigger: { trigger: p, start: "top 80%", end: "bottom 50%", scrub: 0.6 }
    });
  });

  /* ---------- Bilder driften leicht in ihrem Rahmen ---------- */
  document.querySelectorAll("[data-drift]").forEach(function (im) {
    var d = parseFloat(im.getAttribute("data-drift"));
    gsap.fromTo(im, { yPercent: -d }, { yPercent: d, ease: "none", scrollTrigger: { trigger: im.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
  });

  /* ---------- Josef Bar: Titelbild mit Parallax, der Titel gleitet leicht dagegen ---------- */
  document.querySelectorAll("[data-parallax]").forEach(function (box) {
    var img = box.querySelector("img"), txt = box.querySelector("[data-parallax-text]");
    var st = { trigger: box, start: "top bottom", end: "bottom top", scrub: true };
    if (img) gsap.fromTo(img, { yPercent: -9 }, { yPercent: 9, ease: "none", scrollTrigger: st });
    if (txt && desktop.matches) gsap.fromTo(txt, { y: 60 }, { y: -40, ease: "none", scrollTrigger: { trigger: box, start: "top bottom", end: "bottom top", scrub: true } });
  });

  /* ---------- Drei Schritte: beim Scrollen nach rechts (Desktop), mobil wischen ---------- */
  var stepsEl = document.querySelector("[data-steps]");
  if (stepsEl) {
    mm.add("(min-width: 821px)", function () {
      var track = stepsEl.querySelector("[data-steps-track]");
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      var tw = gsap.fromTo(track, { x: 0 }, {
        x: function () { return -dist(); }, ease: "none",
        scrollTrigger: { trigger: stepsEl, start: "center center", end: function () { return "+=" + dist(); }, scrub: 0.8, pin: true, anticipatePin: 1, invalidateOnRefresh: true }
      });
      return function () { tw.scrollTrigger && tw.scrollTrigger.kill(); gsap.set(track, { clearProps: "all" }); };
    });
  }

  /* ---------- Maßband: Desktop senkrecht rechts, mobil quer unter dem Header ---------- */
  var tape = document.querySelector("[data-tape]");
  if (tape) {
    var track = tape.querySelector("[data-tape-track]");
    var vertical = window.matchMedia("(min-width: 1100px)");
    var RATIO = 0.32, marks = [], built = false;
    function buildTape() {
      track.querySelectorAll(".tape__mark, .tape__num").forEach(function (n) { n.remove(); });
      marks = [];
      var v = vertical.matches;
      RATIO = v ? 0.32 : 0.26;
      var docH = document.documentElement.scrollHeight;
      var span = window.innerWidth;
      var len = Math.ceil(docH * RATIO + (v ? window.innerHeight : span));
      track.style.height = v ? len + "px" : "";
      track.style.width = v ? "" : len + "px";
      var prop = v ? "top" : "left";
      for (var t = 100, n = 10; t < docH * RATIO; t += 100, n += 10) {
        var num = document.createElement("span");
        num.className = "tape__num"; num.style[prop] = t + "px"; num.textContent = n;
        track.appendChild(num);
      }
      chapters.forEach(function (c) {
        var top = c.getBoundingClientRect().top + window.scrollY;
        var m = document.createElement("div");
        m.className = "tape__mark"; m.style[prop] = (top * RATIO) + "px";
        var a = document.createElement("a");
        a.href = "#" + (c.id || ""); a.textContent = c.getAttribute("data-chapter");
        a.addEventListener("click", function (e) { e.preventDefault(); scrollToEl(c); });
        m.appendChild(a); track.appendChild(m);
        marks.push({ el: m, t: top * RATIO });
      });
      built = true; updateTape();
    }
    function updateTape() {
      if (!built) return;
      var v = vertical.matches, y = window.scrollY, vh = window.innerHeight;
      var t = (y + vh * 0.5) * RATIO;
      var offset = (v ? vh : window.innerWidth) * 0.5 - t;
      track.style.transform = v ? "translate3d(0," + offset.toFixed(1) + "px,0)" : "translate3d(" + offset.toFixed(1) + "px,0,0)";
      var active = null;
      marks.forEach(function (m) { if (m.t <= t + 2) active = m; });
      marks.forEach(function (m) { m.el.classList.toggle("is-active", m === active); });
      var heroEl = document.querySelector(".hero");
      var heroOut = heroEl ? heroEl.getBoundingClientRect().bottom < vh * (v ? 0.5 : 0.3) : true;
      var footerIn = document.querySelector("main").getBoundingClientRect().bottom < vh * 0.85;
      tape.classList.toggle("is-on", heroOut && !footerIn);
      var probe = v ? vh * 0.5 : (header ? header.offsetHeight + 13 : 77);
      var sec = sectionAt(probe);
      tape.setAttribute("data-theme", !sec ? "paper" : sec.getAttribute("data-header") === "dark" ? "dark" : (v && sec.classList.contains("tm-white")) ? "white" : "paper");
    }
    ScrollTrigger.addEventListener("refresh", buildTape);
    window.addEventListener("scroll", updateTape, { passive: true });
    if (lenis) lenis.on("scroll", updateTape);
  }

  /* ---------- Aufklappen weich animieren ---------- */
  document.querySelectorAll("details.fold, details.readmore").forEach(function (d) {
    var sum = d.querySelector("summary"), body = d.querySelector(".fold__body");
    if (!sum || !body) return;
    sum.addEventListener("click", function (e) {
      e.preventDefault();
      if (d.open) {
        var h = body.offsetHeight;
        body.animate([{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 380, easing: "cubic-bezier(0.22,1,0.36,1)" }).onfinish = function () { d.open = false; ScrollTrigger.refresh(); };
      } else {
        // andere im selben Verbund schließen
        var name = d.getAttribute("name");
        if (name) document.querySelectorAll('details[name="' + name + '"][open]').forEach(function (o) { if (o !== d) o.open = false; });
        d.open = true;
        var h2 = body.offsetHeight;
        body.animate([{ height: "0px", opacity: 0 }, { height: h2 + "px", opacity: 1 }], { duration: 480, easing: "cubic-bezier(0.22,1,0.36,1)" }).onfinish = function () { ScrollTrigger.refresh(); };
      }
    });
  });

  window.addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
