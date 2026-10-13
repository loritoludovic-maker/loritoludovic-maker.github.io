/* QCM interactifs TSSR — correction immédiate, scores dans localStorage */
(function () {
  "use strict";
  var STORE = "tssr-scores-v1";

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
  }
  function save(db) {
    try { localStorage.setItem(STORE, JSON.stringify(db)); } catch (e) { /* stockage indisponible */ }
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function pct(s, t) { return t ? Math.round((100 * s) / t) : 0; }
  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " +
      d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  function level(p) { return p >= 80 ? "good" : p >= 60 ? "mid" : "low"; }

  /* ------------------------------------------------------------------ quiz */
  function Quiz(root, data) {
    this.root = root; this.data = data;
    this.opts = { shuffleQ: false };
    this.start(data.questions, true);
  }

  Quiz.prototype.start = function (questions, full) {
    this.full = full;
    this.qs = this.opts.shuffleQ ? shuffle(questions) : questions.slice();
    this.answers = {}; // n -> {ok, picked}
    this.t0 = Date.now();
    this.render();
    if (!full) this.root.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  Quiz.prototype.render = function () {
    var self = this, root = this.root;
    root.innerHTML = "";

    var bar = el("div", "tq-bar");
    bar.innerHTML =
      '<div class="tq-progress"><span></span></div>' +
      '<div class="tq-bar-row"><span class="tq-count"></span>' +
      '<span class="tq-tools">' +
      '<label><input type="checkbox" class="tq-shuf"' + (this.opts.shuffleQ ? " checked" : "") + "> Mélanger les questions</label>" +
      '<button type="button" class="md-button tq-finish">Terminer</button>' +
      "</span></div>";
    root.appendChild(bar);
    this.bar = bar;
    bar.querySelector(".tq-shuf").addEventListener("change", function (e) {
      self.opts.shuffleQ = e.target.checked;
      self.start(self.full ? self.data.questions : self.qs, self.full);
    });
    bar.querySelector(".tq-finish").addEventListener("click", function () { self.finish(true); });

    if (!this.full) {
      root.appendChild(el("div", "admonition info",
        '<p class="admonition-title">Refaire mes erreurs</p><p>' + this.qs.length +
        " question(s) ratée(s) à retravailler. Ce passage n'est pas compté dans les scores.</p>"));
    }

    var lastSection = null;
    this.qs.forEach(function (q, i) {
      if (!self.opts.shuffleQ && self.full && q.section && q.section !== lastSection) {
        root.appendChild(el("h2", "tq-section", q.section.replace(/^[#\s]+/, "")));
        lastSection = q.section;
      }
      root.appendChild(self.card(q, i));
    });

    this.summary = el("div", "tq-summary");
    root.appendChild(this.summary);
    this.update();
  };

  Quiz.prototype.card = function (q, i) {
    var self = this;
    var multi = q.answer.length > 1;
    var card = el("section", "tq-card");
    card.id = "q" + q.n;
    var head = '<div class="tq-head"><span class="tq-num">' + (i + 1) + "/" + this.qs.length + "</span>" +
      (q.title ? '<span class="tq-title">' + q.title + "</span>" : "") +
      '<span class="tq-orig">Q' + q.n + "</span></div>";
    card.innerHTML = head + '<div class="tq-text">' + q.html + "</div>" +
      (multi ? '<p class="tq-multi">Plusieurs bonnes réponses : coche-les toutes puis valide.</p>' : "");
    var list = el("div", "tq-options");
    var opts = shuffle(q.options);
    var letters = "ABCDEF";
    var buttons = [];
    opts.forEach(function (o, k) {
      var b = el("button", "tq-opt", '<span class="tq-letter">' + letters[k] + "</span><span>" + o.html + "</span>");
      b.type = "button";
      b.dataset.l = o.l;
      b.addEventListener("click", function () {
        if (card.classList.contains("done")) return;
        if (multi) { b.classList.toggle("picked"); return; }
        self.answer(q, card, buttons, [o.l]);
      });
      buttons.push(b);
      list.appendChild(b);
    });
    card.appendChild(list);
    if (multi) {
      var v = el("button", "md-button md-button--primary tq-validate", "Valider");
      v.type = "button";
      v.addEventListener("click", function () {
        var picked = buttons.filter(function (b) { return b.classList.contains("picked"); })
          .map(function (b) { return b.dataset.l; });
        if (!picked.length) return;
        self.answer(q, card, buttons, picked);
        v.remove();
      });
      card.appendChild(v);
    }
    card.appendChild(el("div", "tq-feedback"));
    return card;
  };

  Quiz.prototype.answer = function (q, card, buttons, picked) {
    var ok = picked.slice().sort().join() === q.answer.slice().sort().join();
    this.answers[q.n] = { ok: ok, picked: picked };
    card.classList.add("done", ok ? "ok" : "ko");
    buttons.forEach(function (b) {
      var good = q.answer.indexOf(b.dataset.l) >= 0;
      var chosen = picked.indexOf(b.dataset.l) >= 0;
      b.disabled = true;
      if (good) b.classList.add("right");
      if (chosen && !good) b.classList.add("wrong");
      if (chosen) b.classList.add("chosen");
    });
    var fb = card.querySelector(".tq-feedback");
    fb.innerHTML = ok
      ? "<strong>Bonne réponse !</strong>"
      : "<strong>Raté.</strong> La bonne réponse est surlignée en vert. " +
        '<a href="' + this.data.correction + '" target="_blank" rel="noopener">Voir la correction détaillée</a>';
    this.update();
    if (Object.keys(this.answers).length === this.qs.length) this.finish(false);
  };

  Quiz.prototype.stats = function () {
    var a = this.answers, done = Object.keys(a).length, good = 0;
    Object.keys(a).forEach(function (k) { if (a[k].ok) good++; });
    return { done: done, good: good, total: this.qs.length };
  };

  Quiz.prototype.update = function () {
    var s = this.stats();
    this.bar.querySelector(".tq-progress span").style.width = pct(s.done, s.total) + "%";
    this.bar.querySelector(".tq-count").innerHTML =
      "<strong>" + s.done + "/" + s.total + "</strong> répondues · <strong>" + s.good + "</strong> bonnes" +
      (s.done ? " · " + pct(s.good, s.done) + " %" : "");
  };

  Quiz.prototype.finish = function (early) {
    var self = this, s = this.stats();
    if (early && s.done === 0) return;
    var p = pct(s.good, s.total);
    var wrong = this.qs.filter(function (q) { return !(self.answers[q.n] && self.answers[q.n].ok); });
    var note20 = Math.round((20 * s.good / s.total) * 10) / 10;
    var html = '<div class="tq-score ' + level(p) + '"><span class="tq-big">' + p + ' %</span>' +
      "<span>" + s.good + " / " + s.total + " bonnes réponses · " + String(note20).replace(".", ",") + " / 20</span></div>";
    var msg = p >= 80 ? "Excellent, ce CCP est solide."
      : p >= 60 ? "Correct, mais relis la fiche sur les questions ratées."
      : "À retravailler : relis la fiche puis refais tes erreurs.";
    html += "<p>" + msg + "</p>";

    if (this.full && !this.saved) {
      var db = load(), id = this.data.id;
      var rec = db[id] || { best: 0, attempts: [] };
      var isBest = p > rec.best;
      rec.best = Math.max(rec.best, p);
      rec.attempts.push({ date: new Date().toISOString(), score: s.good, total: s.total, pct: p,
        minutes: Math.round((Date.now() - this.t0) / 60000) });
      rec.attempts = rec.attempts.slice(-30);
      db[id] = rec; save(db); this.saved = true;
      html += "<p>" + (isBest ? "🎉 <strong>Nouveau record</strong> pour " + this.data.code + " !"
        : "Ton meilleur score pour " + this.data.code + " : <strong>" + rec.best + " %</strong>.") + "</p>";
    }
    html += '<div class="tq-actions"></div>';
    this.summary.innerHTML = html;
    var act = this.summary.querySelector(".tq-actions");
    if (wrong.length) {
      var w = el("button", "md-button md-button--primary", "Refaire mes erreurs (" + wrong.length + ")");
      w.addEventListener("click", function () { self.saved = false; self.start(wrong, false); });
      act.appendChild(w);
    }
    var r = el("button", "md-button", "Recommencer tout le QCM");
    r.addEventListener("click", function () { self.saved = false; self.start(self.data.questions, true); window.scrollTo(0, 0); });
    act.appendChild(r);
    act.appendChild(el("a", "md-button", "Correction détaillée")).href = this.data.correction;
    act.appendChild(el("a", "md-button", "Mes scores")).href = "../scores/";
    this.summary.classList.add("show");
    this.summary.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /* --------------------------------------------------------- scores page */
  function renderScores(root) {
    fetch(root.dataset.src || "../data/index.json").then(function (r) { return r.json(); }).then(function (list) {
      var db = load();
      var rows = list.map(function (q) {
        var rec = db[q.id];
        var last = rec && rec.attempts[rec.attempts.length - 1];
        var best = rec ? rec.best : null;
        var spark = rec ? rec.attempts.slice(-10).map(function (a) {
          return '<i class="' + level(a.pct) + '" style="height:' + Math.max(8, a.pct) + '%" title="' +
            fmtDate(a.date) + " : " + a.pct + ' %"></i>';
        }).join("") : "";
        return "<tr><td><a href=\"../" + q.id + "/\"><strong>" + q.code + "</strong> " + q.label + "</a></td>" +
          '<td class="num">' + (best == null ? "—" : '<span class="tq-pill ' + level(best) + '">' + best + " %</span>") + "</td>" +
          '<td class="num">' + (last ? last.pct + " %<br><small>" + fmtDate(last.date) + "</small>" : "—") + "</td>" +
          '<td class="num">' + (rec ? rec.attempts.length : 0) + "</td>" +
          '<td><span class="tq-spark">' + spark + "</span></td></tr>";
      }).join("");
      var done = list.filter(function (q) { return db[q.id]; });
      var avg = done.length ? Math.round(done.reduce(function (s, q) { return s + db[q.id].best; }, 0) / done.length) : 0;
      root.innerHTML =
        '<div class="tssr-stats"><div><strong>' + done.length + "/" + list.length + "</strong><span>CCP déjà passés en QCM</span></div>" +
        "<div><strong>" + (done.length ? avg + " %" : "—") + "</strong><span>moyenne des meilleurs scores</span></div>" +
        "<div><strong>" + list.filter(function (q) { return db[q.id] && db[q.id].best >= 80; }).length +
        "</strong><span>CCP à 80 % ou plus</span></div></div>" +
        '<div class="md-typeset__table tq-table"><table><thead><tr><th>CCP</th><th>Meilleur</th><th>Dernier</th>' +
        "<th>Tentatives</th><th>Évolution</th></tr></thead><tbody>" + rows + "</tbody></table></div>" +
        '<p><button type="button" class="md-button tq-reset">Effacer mes scores</button></p>';
      root.querySelector(".tq-reset").addEventListener("click", function () {
        if (confirm("Effacer tout l'historique des scores ?")) { save({}); renderScores(root); }
      });
    });
  }

  /* ------------------------------------------------------- badges accueil */
  function renderBadges() {
    var db = load();
    document.querySelectorAll(".tssr-best").forEach(function (b) {
      var rec = db[b.dataset.quiz];
      if (rec) {
        b.className = "tssr-best tq-pill " + level(rec.best);
        b.textContent = "meilleur : " + rec.best + " %";
      }
    });
  }

  function init() {
    document.querySelectorAll(".tssr-quiz").forEach(function (root) {
      if (root.dataset.ready) return;
      root.dataset.ready = "1";
      root.innerHTML = "<p>Chargement du QCM…</p>";
      fetch(root.dataset.src).then(function (r) { return r.json(); })
        .then(function (data) { new Quiz(root, data); })
        .catch(function () { root.innerHTML = "<p>Impossible de charger le QCM.</p>"; });
    });
    document.querySelectorAll(".tssr-scores").forEach(renderScores);
    renderBadges();
  }

  if (window.document$ && window.document$.subscribe) window.document$.subscribe(init);
  else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
