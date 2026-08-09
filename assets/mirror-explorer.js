/* Congress-mirror explorer — self-contained SVG chart, no dependencies.
   Data: window.MIRROR_DATA (precomputed from the corrected full archive).
   Modes: $ growth of $10k, or % relative to SPY (SPY = zero line).
   Range: re-base all curves at any start year — members with short
   disclosure windows compare fairly over their active period. */
(function () {
  var D = window.MIRROR_DATA;
  var root = document.getElementById("mirror-explorer");
  if (!D || !root) return;

  var COLORS = ["#3987e5", "#c98500", "#199e70"];   // member slots (validated)
  var BASKET_C = "#e5484d", SPY_C = "#8a8f99";
  var W = 720, HGT = 380, PAD = { l: 62, r: 14, t: 14, b: 26 };
  var allDates = D.dates.map(function (d) { return new Date(d + "T00:00:00Z"); });
  var YEARS = ["all", 2021, 2022, 2023, 2024, 2025, 2026];

  var state = { mode: "usd", startYear: "all", basket: true, exTail: false,
                members: ["Nancy Pelosi"], slots: { "Nancy Pelosi": 0 } };

  function fmt$(v) { return "$" + Math.round(v).toLocaleString("en-US"); }
  function fmtPct(v) {
    var d = Math.abs(v) < 10 ? 1 : 0;
    return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d) + "%";
  }
  function fmtVal(v) { return state.mode === "usd" ? fmt$(v) : fmtPct(v); }
  function monthYear(iso) {
    if (!iso) return "?";
    var M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return M[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
  }
  function basketData() { return state.exTail ? D.basket_ex_tail : D.basket; }

  function rangeStart() {
    if (state.startYear === "all") return 0;
    for (var i = 0; i < allDates.length; i++)
      if (allDates[i].getUTCFullYear() >= state.startYear) return i;
    return 0;
  }

  function activeSeries() {
    var s = [];
    if (state.basket) {
      s.push({ key: "basket", label: state.exTail ? "Congress basket (ex top-1% trades)" : "Congress basket",
               raw: basketData().curve, color: BASKET_C, stats: basketData().stats, dash: null });
    }
    state.members.forEach(function (m) {
      s.push({ key: m, label: m, raw: D.members[m].curve,
               color: COLORS[state.slots[m]], stats: D.members[m].stats, dash: null });
    });
    s.push({ key: "spy", label: "S&P 500", raw: D.spy, color: SPY_C,
             stats: { n: null }, dash: "6 5" });
    return s;
  }

  // ---------- transform: slice at range start, re-base, convert units
  function buildView(series) {
    var r0 = rangeStart(), n = allDates.length - r0;
    series.forEach(function (s) {
      var base = s.raw[r0], spy0 = D.spy[r0], vals = new Array(n);
      for (var i = 0; i < n; i++) {
        var g = s.raw[r0 + i] / base;
        vals[i] = state.mode === "usd" ? g * 10000
                : (g / (D.spy[r0 + i] / spy0) - 1) * 100;
      }
      s.vals = vals;
      s.end = vals[n - 1];
    });
    return { r0: r0, n: n, dates: allDates.slice(r0) };
  }

  function extent(series) {
    var lo = Infinity, hi = -Infinity;
    series.forEach(function (s) { s.vals.forEach(function (v) {
      if (v < lo) lo = v; if (v > hi) hi = v; }); });
    if (state.mode === "rel") { lo = Math.min(lo, -2); hi = Math.max(hi, 2); }
    var pad = (hi - lo) * 0.06 || 1;
    lo = lo - pad; hi = hi + pad;
    if (state.mode === "usd") lo = Math.max(0, lo);
    return [lo, hi];
  }
  function xPos(i, V) { return PAD.l + (i / (V.n - 1)) * (W - PAD.l - PAD.r); }
  function yPos(v, dom) {
    return PAD.t + (1 - (v - dom[0]) / (dom[1] - dom[0])) * (HGT - PAD.t - PAD.b);
  }
  function ticksY(dom) {
    var span = dom[1] - dom[0], step = Math.pow(10, Math.floor(Math.log10(span / 4)));
    if (span / step > 8) step *= 2;
    if (span / step > 8) step *= 2.5;
    var out = [], v = Math.ceil(dom[0] / step) * step;
    for (; v <= dom[1]; v += step) out.push(Math.abs(v) < step / 2 ? 0 : v);
    return out;
  }
  function tickLabel(v) {
    if (state.mode === "rel") return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(Math.round(v)) + "%";
    return v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + Math.round(v);
  }

  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  // ---------- render
  function render() {
    var series = activeSeries();
    var V = buildView(series);
    var dom = extent(series);
    var svg = [];
    svg.push('<svg viewBox="0 0 ' + W + " " + HGT + '" role="img" aria-label="Congressional copy-trade strategies vs the S&amp;P 500">');
    ticksY(dom).forEach(function (v) {
      var y = yPos(v, dom);
      var zero = state.mode === "rel" && v === 0;
      svg.push('<line x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + y + '" y2="' + y +
        '" stroke="' + (zero ? "#3a3e48" : "#22242b") + '" stroke-width="' + (zero ? 2 : 1.5) + '"/>');
      svg.push('<text x="' + (PAD.l - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="#8a8f99" font-family="Menlo,monospace">' + tickLabel(v) + "</text>");
    });
    for (var i = 1; i < V.n; i++) {
      if (V.dates[i].getUTCFullYear() !== V.dates[i - 1].getUTCFullYear()) {
        var x = xPos(i, V);
        svg.push('<line x1="' + x + '" x2="' + x + '" y1="' + PAD.t + '" y2="' + (HGT - PAD.b) + '" stroke="#1c1e24" stroke-width="1"/>');
        svg.push('<text x="' + x + '" y="' + (HGT - 8) + '" text-anchor="middle" font-size="11" fill="#8a8f99" font-family="Menlo,monospace">' + V.dates[i].getUTCFullYear() + "</text>");
      }
    }
    series.slice().reverse().forEach(function (s) {
      var pts = s.vals.map(function (v, i) { return xPos(i, V).toFixed(1) + "," + yPos(v, dom).toFixed(1); }).join(" ");
      svg.push('<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2"' +
        (s.dash ? ' stroke-dasharray="' + s.dash + '"' : "") + ' stroke-linejoin="round"/>');
    });
    var used = [];
    series.forEach(function (s) {
      var y = yPos(s.end, dom);
      used.forEach(function (u) { if (Math.abs(u - y) < 13) y = u - 13; });
      used.push(y);
      svg.push('<text x="' + (W - PAD.r - 2) + '" y="' + (y - 5) + '" text-anchor="end" font-size="11" fill="' + s.color + '" font-family="Menlo,monospace">' + esc(s.label.split(" (")[0]) + "</text>");
    });
    if (state.members.length === 1) {
      var m = state.members[0], mc = COLORS[state.slots[m]];
      var ms = series.filter(function (s) { return s.key === m; })[0];
      D.members[m].markers.forEach(function (t, k) {
        var di = nearestDate(t.d, V);
        if (di === null) return;
        var x = xPos(di, V), y = yPos(ms.vals[di], dom);
        svg.push('<circle data-mk="' + k + '" cx="' + x + '" cy="' + y + '" r="4.5" fill="' + (t.a >= 0 ? mc : "#17181d") + '" stroke="' + (t.a >= 0 ? "#17181d" : mc) + '" stroke-width="2"/>');
        svg.push('<circle data-mk="' + k + '" cx="' + x + '" cy="' + y + '" r="11" fill="transparent" style="cursor:pointer"/>');
      });
    }
    svg.push('<line id="mx-cross" y1="' + PAD.t + '" y2="' + (HGT - PAD.b) + '" stroke="#3a3e48" stroke-width="1" visibility="hidden"/>');
    svg.push("</svg>");
    root.querySelector(".mx-chart").innerHTML = svg.join("");
    renderModes(); renderChips(); renderStat(series, V); renderTable(series); bindHover(series, V, dom);
  }

  function nearestDate(iso, V) {
    var t = new Date(iso + "T00:00:00Z").getTime();
    if (t < V.dates[0].getTime() - 4 * 864e5) return null;   // before range
    var best = 0, bd = Infinity;
    for (var i = 0; i < V.n; i++) {
      var d = Math.abs(V.dates[i].getTime() - t);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // ---------- controls
  function renderModes() {
    var el = root.querySelector(".mx-modes"), h = [];
    h.push('<button class="mx-chip' + (state.mode === "usd" ? " on" : "") + '" data-act="mode" data-v="usd">$ growth of $10k</button>');
    h.push('<button class="mx-chip' + (state.mode === "rel" ? " on" : "") + '" data-act="mode" data-v="rel">% vs S&amp;P 500</button>');
    h.push('<span class="mx-sep"></span><span class="mx-lbl">from:</span>');
    YEARS.forEach(function (y) {
      h.push('<button class="mx-chip mx-yr' + (String(state.startYear) === String(y) ? " on" : "") + '" data-act="year" data-v="' + y + '">' + (y === "all" ? "2020" : y) + "</button>");
    });
    el.innerHTML = h.join("");
  }

  function renderChips() {
    var el = root.querySelector(".mx-chips"), h = [];
    h.push('<span class="mx-chip mx-fixed" style="border-color:' + SPY_C + '"><i style="background:' + SPY_C + '"></i>S&amp;P 500</span>');
    h.push('<button class="mx-chip' + (state.basket ? " on" : "") + '" data-act="basket" style="border-color:' + BASKET_C + '"><i style="background:' + BASKET_C + '"></i>Congress basket</button>');
    h.push('<button class="mx-chip mx-toggle' + (state.exTail ? " on" : "") + '" data-act="extail"' + (state.basket ? "" : " disabled") + ">&minus; top 1% of trades</button>");
    state.members.forEach(function (m) {
      h.push('<button class="mx-chip on" data-act="rm" data-m="' + esc(m) + '" style="border-color:' + COLORS[state.slots[m]] + '"><i style="background:' + COLORS[state.slots[m]] + '"></i>' + esc(m) + " &times;</button>");
    });
    if (state.members.length < 3) {
      var opts = Object.keys(D.members).filter(function (m) { return state.members.indexOf(m) < 0; })
        .map(function (m) { return '<option value="' + esc(m) + '">' + esc(m) + "</option>"; }).join("");
      h.push('<select class="mx-add"><option value="">+ add member…</option>' + opts + "</select>");
    }
    el.innerHTML = h.join("");
  }

  function rangeLabel() {
    return state.startYear === "all" ? "2020–2026" : state.startYear + "–2026";
  }

  function renderStat(series, V) {
    var el = root.querySelector(".mx-stat"), txt = "";
    var spy = series.filter(function (s) { return s.key === "spy"; })[0];
    var bas = series.filter(function (s) { return s.key === "basket"; })[0];
    if (bas) {
      if (state.mode === "rel") {
        txt = "Over " + rangeLabel() + ", the " + (state.exTail ? "tail-stripped basket" : "all-Congress copy-trade") +
          " ends at <strong>" + fmtPct(bas.end) + " vs SPY</strong>." +
          (state.exTail ? "" : " Now try removing the top 1% of trades.");
      } else {
        txt = "$10,000 from " + (state.startYear === "all" ? "2020" : state.startYear) +
          ": basket → <strong>" + fmt$(bas.end) + "</strong> vs " + fmt$(spy.end) + " in SPY." +
          (state.exTail ? "" : " Now try removing the top 1% of trades.");
      }
    } else {
      txt = "SPY over " + rangeLabel() + ": <strong>" + fmtVal(spy.end) + "</strong>.";
    }
    if (state.members.length === 1) {
      var m = state.members[0], st = D.members[m].stats;
      var ser = series.filter(function (s) { return s.key === m; })[0];
      txt += " " + esc(m) + ": " + st.n + " copyable trades, active " + monthYear(st.first) +
        " – " + monthYear(st.last) + " → <strong>" + fmtVal(ser.end) +
        (state.mode === "rel" ? " vs SPY" : "") + "</strong>. Dots mark the 15 largest single-trade moves (filled beat SPY, hollow lagged).";
    }
    el.innerHTML = txt;
  }

  function renderTable(series) {
    var rows = series.map(function (s) {
      var st = s.stats || {};
      return "<tr><td><i class='mx-sw' style='background:" + s.color + "'></i>" + esc(s.label) + "</td>" +
        "<td class='num'>" + (st.n == null ? "—" : st.n.toLocaleString()) + "</td>" +
        "<td class='num'>" + (st.first ? monthYear(st.first) + " – " + monthYear(st.last) : "—") + "</td>" +
        "<td class='num'>" + (st.mean_a == null ? "—" : st.mean_a.toFixed(2) + "%") + "</td>" +
        "<td class='num'>" + fmtVal(s.end) + "</td></tr>";
    }).join("");
    root.querySelector(".mx-table tbody").innerHTML = rows;
    root.querySelector(".mx-th-end").textContent =
      state.mode === "usd" ? "End value" : "End vs SPY";
  }

  // ---------- hover
  function bindHover(series, V, dom) {
    var svg = root.querySelector("svg"), tip = root.querySelector(".mx-tip"),
        cross = svg.querySelector("#mx-cross");
    function pt(evt) {
      var r = svg.getBoundingClientRect();
      return { x: (evt.clientX - r.left) * (W / r.width) };
    }
    svg.addEventListener("mousemove", function (evt) {
      var mk = evt.target.getAttribute && evt.target.getAttribute("data-mk");
      if (mk !== null && mk !== undefined && state.members.length === 1) {
        var t = D.members[state.members[0]].markers[+mk];
        tip.innerHTML = "<strong>" + esc(t.t) + "</strong> · bought " + t.d +
          "<br>21-day alpha vs SPY: <strong>" + (t.a >= 0 ? "+" : "") + t.a + "%</strong>";
        place(evt); cross.setAttribute("visibility", "hidden"); return;
      }
      var p = pt(evt);
      if (p.x < PAD.l || p.x > W - PAD.r) { hide(); return; }
      var i = Math.round((p.x - PAD.l) / (W - PAD.l - PAD.r) * (V.n - 1));
      i = Math.max(0, Math.min(V.n - 1, i));
      var x = xPos(i, V);
      cross.setAttribute("x1", x); cross.setAttribute("x2", x);
      cross.setAttribute("visibility", "visible");
      var lines = ["<strong>" + V.dates[i].toISOString().slice(0, 10) + "</strong>"];
      series.forEach(function (s) {
        lines.push("<i class='mx-sw' style='background:" + s.color + "'></i>" +
          esc(s.label.split(" (")[0]) + ": " + fmtVal(s.vals[i]));
      });
      tip.innerHTML = lines.join("<br>");
      place(evt);
    });
    svg.addEventListener("mouseleave", hide);
    function place(evt) {
      var r = root.querySelector(".mx-chart").getBoundingClientRect();
      tip.style.display = "block";
      var tx = evt.clientX - r.left + 14, ty = evt.clientY - r.top - 10;
      if (tx + tip.offsetWidth > r.width - 4) tx = tx - tip.offsetWidth - 26;
      tip.style.left = tx + "px"; tip.style.top = ty + "px";
    }
    function hide() { tip.style.display = "none"; cross.setAttribute("visibility", "hidden"); }
  }

  // ---------- events
  root.addEventListener("click", function (evt) {
    var b = evt.target.closest("[data-act]");
    if (!b || b.disabled) return;
    var act = b.getAttribute("data-act");
    if (act === "basket") state.basket = !state.basket;
    if (act === "extail") state.exTail = !state.exTail;
    if (act === "mode") state.mode = b.getAttribute("data-v");
    if (act === "year") {
      var v = b.getAttribute("data-v");
      state.startYear = v === "all" ? "all" : +v;
    }
    if (act === "rm") {
      var m = b.getAttribute("data-m");
      state.members = state.members.filter(function (x) { return x !== m; });
      delete state.slots[m];
    }
    render();
  });
  root.addEventListener("change", function (evt) {
    if (!evt.target.classList.contains("mx-add")) return;
    var m = evt.target.value;
    if (!m || state.members.length >= 3) return;
    var usedSlots = state.members.map(function (x) { return state.slots[x]; });
    for (var s = 0; s < 3; s++) if (usedSlots.indexOf(s) < 0) { state.slots[m] = s; break; }
    state.members.push(m);
    render();
  });

  render();
})();
