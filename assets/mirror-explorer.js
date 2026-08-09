/* Congress-mirror explorer — self-contained SVG chart, no dependencies.
   Data: window.MIRROR_DATA (precomputed from the corrected full archive). */
(function () {
  var D = window.MIRROR_DATA;
  var root = document.getElementById("mirror-explorer");
  if (!D || !root) return;

  var COLORS = ["#3987e5", "#c98500", "#199e70"];   // member slots (validated)
  var BASKET_C = "#e5484d", SPY_C = "#8a8f99";
  var W = 720, HGT = 380, PAD = { l: 56, r: 14, t: 14, b: 26 };
  var dates = D.dates.map(function (d) { return new Date(d + "T00:00:00Z"); });
  var n = dates.length;

  var state = { basket: true, exTail: false, members: ["Nancy Pelosi"], slots: {} };
  state.slots["Nancy Pelosi"] = 0;

  function fmt$(v) { return "$" + Math.round(v).toLocaleString("en-US"); }
  function basketData() { return state.exTail ? D.basket_ex_tail : D.basket; }

  function activeSeries() {
    var s = [];
    if (state.basket) {
      s.push({ key: "basket", label: state.exTail ? "Congress basket (ex top-1% trades)" : "Congress basket",
               curve: basketData().curve, color: BASKET_C, stats: basketData().stats, dash: null });
    }
    state.members.forEach(function (m) {
      s.push({ key: m, label: m, curve: D.members[m].curve,
               color: COLORS[state.slots[m]], stats: D.members[m].stats, dash: null });
    });
    s.push({ key: "spy", label: "S&P 500 (SPY)", curve: D.spy, color: SPY_C,
             stats: { n: null, final: D.spy[n - 1] }, dash: "6 5" });
    return s;
  }

  // ---------- scales
  function extent(series) {
    var lo = Infinity, hi = -Infinity;
    series.forEach(function (s) { s.curve.forEach(function (v) {
      if (v < lo) lo = v; if (v > hi) hi = v; }); });
    var pad = (hi - lo) * 0.06;
    return [Math.max(0, lo - pad), hi + pad];
  }
  function xPos(i) { return PAD.l + (i / (n - 1)) * (W - PAD.l - PAD.r); }
  function yPos(v, dom) {
    return PAD.t + (1 - (v - dom[0]) / (dom[1] - dom[0])) * (HGT - PAD.t - PAD.b);
  }

  function ticksY(dom) {
    var span = dom[1] - dom[0], step = Math.pow(10, Math.floor(Math.log10(span / 4)));
    if (span / step > 8) step *= 2;
    if (span / step > 8) step *= 2.5;
    var out = [], v = Math.ceil(dom[0] / step) * step;
    for (; v <= dom[1]; v += step) out.push(v);
    return out;
  }

  // ---------- render
  function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  function render() {
    var series = activeSeries(), dom = extent(series);
    var svg = [];
    svg.push('<svg viewBox="0 0 ' + W + " " + HGT + '" role="img" aria-label="Growth of $10,000: congressional copy-trade strategies vs the S&amp;P 500">');
    // grid + y labels
    ticksY(dom).forEach(function (v) {
      var y = yPos(v, dom);
      svg.push('<line x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + y + '" y2="' + y + '" stroke="#22242b" stroke-width="1.5"/>');
      svg.push('<text x="' + (PAD.l - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11" fill="#8a8f99" font-family="Menlo,monospace">' + (v >= 1000 ? "$" + Math.round(v / 1000) + "k" : "$" + v) + "</text>");
    });
    // x labels: january of each year
    for (var i = 1; i < n; i++) {
      var d = dates[i], p = dates[i - 1];
      if (d.getUTCFullYear() !== p.getUTCFullYear()) {
        var x = xPos(i);
        svg.push('<line x1="' + x + '" x2="' + x + '" y1="' + PAD.t + '" y2="' + (HGT - PAD.b) + '" stroke="#1c1e24" stroke-width="1"/>');
        svg.push('<text x="' + x + '" y="' + (HGT - 8) + '" text-anchor="middle" font-size="11" fill="#8a8f99" font-family="Menlo,monospace">' + d.getUTCFullYear() + "</text>");
      }
    }
    // lines (SPY first so it sits under)
    series.slice().reverse().forEach(function (s) {
      var pts = s.curve.map(function (v, i) { return xPos(i).toFixed(1) + "," + yPos(v, dom).toFixed(1); }).join(" ");
      svg.push('<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2"' +
        (s.dash ? ' stroke-dasharray="' + s.dash + '"' : "") + ' stroke-linejoin="round"/>');
    });
    // direct labels at line ends (<=4 series always)
    var used = [];
    series.forEach(function (s) {
      var y = yPos(s.curve[n - 1], dom);
      used.forEach(function (u) { if (Math.abs(u - y) < 13) y = u - 13; });
      used.push(y);
      svg.push('<text x="' + (W - PAD.r - 2) + '" y="' + (y - 5) + '" text-anchor="end" font-size="11" fill="' + s.color + '" font-family="Menlo,monospace">' + esc(s.label.split(" (")[0]) + "</text>");
    });
    // trade markers when exactly one member is selected
    if (state.members.length === 1) {
      var m = state.members[0], mk = D.members[m].markers, curve = D.members[m].curve;
      var mc = COLORS[state.slots[m]];
      mk.forEach(function (t, k) {
        var di = nearestDate(t.d);
        var x = xPos(di), y = yPos(curve[di], dom);
        svg.push('<circle data-mk="' + k + '" cx="' + x + '" cy="' + y + '" r="4.5" fill="' + (t.a >= 0 ? mc : "#17181d") + '" stroke="' + (t.a >= 0 ? "#17181d" : mc) + '" stroke-width="2"/>');
        svg.push('<circle data-mk="' + k + '" cx="' + x + '" cy="' + y + '" r="11" fill="transparent" style="cursor:pointer"/>');
      });
    }
    svg.push('<line id="mx-cross" y1="' + PAD.t + '" y2="' + (HGT - PAD.b) + '" stroke="#3a3e48" stroke-width="1" visibility="hidden"/>');
    svg.push("</svg>");
    root.querySelector(".mx-chart").innerHTML = svg.join("");
    renderChips(); renderStat(series); renderTable(series); bindHover(series, dom);
  }

  function nearestDate(iso) {
    var t = new Date(iso + "T00:00:00Z").getTime(), best = 0, bd = Infinity;
    for (var i = 0; i < n; i++) {
      var d = Math.abs(dates[i].getTime() - t);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // ---------- controls
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

  function renderStat(series) {
    var el = root.querySelector(".mx-stat"), b = D.basket.stats, bx = D.basket_ex_tail.stats;
    var spyF = D.spy[n - 1], txt;
    if (state.basket && state.exTail) {
      txt = "Without its top 1% of trades (" + (b.n - bx.n) + " of " + b.n.toLocaleString() +
        "), the basket ends at <strong>" + fmt$(bx.final) + "</strong> — " +
        fmt$(spyF - bx.final) + " behind just buying SPY.";
    } else if (state.basket) {
      txt = "$10,000 in the all-Congress copy-trade → <strong>" + fmt$(b.final) +
        "</strong> vs " + fmt$(spyF) + " in SPY. Now try removing the top 1% of trades.";
    } else {
      txt = "$10,000 in SPY → <strong>" + fmt$(spyF) + "</strong>.";
    }
    if (state.members.length === 1) {
      var m = state.members[0], st = D.members[m].stats;
      txt += " " + esc(m) + ": " + st.n + " copyable stock purchases → <strong>" + fmt$(st.final) +
        "</strong>. Dots mark the 15 largest single-trade moves (filled beat SPY, hollow lagged).";
    }
    el.innerHTML = txt;
  }

  function renderTable(series) {
    var rows = series.map(function (s) {
      var st = s.stats || {};
      return "<tr><td><i class='mx-sw' style='background:" + s.color + "'></i>" + esc(s.label) + "</td>" +
        "<td class='num'>" + (st.n == null ? "—" : st.n.toLocaleString()) + "</td>" +
        "<td class='num'>" + (st.mean_a == null ? "—" : st.mean_a.toFixed(2) + "%") + "</td>" +
        "<td class='num'>" + (st.top3_a == null ? "—" : st.top3_a.toFixed(1) + "pp / " + (st.sum_a == null ? "—" : st.sum_a.toFixed(1) + "pp")) + "</td>" +
        "<td class='num'>" + fmt$(st.final) + "</td></tr>";
    }).join("");
    root.querySelector(".mx-table tbody").innerHTML = rows;
  }

  // ---------- hover
  function bindHover(series, dom) {
    var svg = root.querySelector("svg"), tip = root.querySelector(".mx-tip"),
        cross = svg.querySelector("#mx-cross");
    function pt(evt) {
      var r = svg.getBoundingClientRect();
      return { x: (evt.clientX - r.left) * (W / r.width), y: (evt.clientY - r.top) * (HGT / r.height) };
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
      var i = Math.round((p.x - PAD.l) / (W - PAD.l - PAD.r) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      var x = xPos(i);
      cross.setAttribute("x1", x); cross.setAttribute("x2", x);
      cross.setAttribute("visibility", "visible");
      var lines = ["<strong>" + D.dates[i] + "</strong>"];
      series.forEach(function (s) {
        lines.push("<i class='mx-sw' style='background:" + s.color + "'></i>" +
          esc(s.label.split(" (")[0]) + ": " + fmt$(s.curve[i]));
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
