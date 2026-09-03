// ===== score one order -> drive the gauge =====
async function scoreOrder() {
  const order = {
    order_value: Number(document.getElementById("order_value").value),
    category: document.getElementById("category").value,
    payment_method: document.getElementById("payment_method").value,
    customer_age_days: Number(document.getElementById("customer_age_days").value),
    past_orders: Number(document.getElementById("past_orders").value),
    past_return_rate: Number(document.getElementById("past_return_rate").value),
    address_mismatch: Number(document.getElementById("address_mismatch").value),
    delivery_days: Number(document.getElementById("delivery_days").value),
    orders_last_24h: Number(document.getElementById("orders_last_24h").value),
    discount_pct: Number(document.getElementById("discount_pct").value)
  };

  const res = await fetch("/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order)
  });
  const r = await res.json();

  const pct = Math.round(r.score * 100);
  setGauge(pct, r.flagged);

  const box = document.getElementById("result");
  if (r.flagged) {
    box.className = "verdict-box flagged";
    box.innerHTML = "⚠️ <b>Flagged for review</b> — risk above the recommended threshold (" +
                    (r.threshold).toFixed(2) + ")";
  } else {
    box.className = "verdict-box fine";
    box.innerHTML = "✅ <b>Looks fine</b> — risk below the recommended threshold (" +
                    (r.threshold).toFixed(2) + ")";
  }
}

// move the gauge needle/arc + number
function setGauge(pct, flagged) {
  const arc = document.getElementById("gaugeArc");
  const total = 314;                          // full semicircle dash length
  arc.style.strokeDashoffset = total * (1 - pct / 100);

  document.getElementById("gauge_num").textContent = pct;
  const verdict = document.getElementById("gauge_verdict");
  if (pct >= 66)      verdict.textContent = "High risk";
  else if (pct >= 40) verdict.textContent = "Medium risk";
  else                verdict.textContent = "Low risk";
  verdict.style.color = flagged ? "#f87171" : "#34d399";
}

// ===== threshold tuner -> live metrics =====
const slider = document.getElementById("threshold_slider");

async function updateMetrics() {
  const t = Number(slider.value);
  document.getElementById("threshold_label").textContent = t.toFixed(2);

  const res = await fetch("/metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threshold: t })
  });
  const m = await res.json();

  document.getElementById("m_precision").textContent = m.precision;
  document.getElementById("m_recall").textContent = m.recall;
  document.getElementById("m_cost").textContent = "₹" + m.cost.toLocaleString();
}

// ===== cost curve + moving marker =====
let costChart = null;

async function drawCurve() {
  const res = await fetch("/curve");
  const data = await res.json();
  const labels = data.points.map(p => p.threshold);
  const costs  = data.points.map(p => p.cost);

  const ctx = document.getElementById("costChart");
  costChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Money lost (₹)",
          data: costs,
          borderColor: "#22d3ee",
          backgroundColor: "rgba(34,211,238,0.10)",
          fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2
        },
        {
          label: "Your threshold",
          data: [],
          borderColor: "#f87171", backgroundColor: "#f87171",
          pointRadius: 7, showLine: false
        }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: "#8ca0bd", boxWidth: 12, font: { size: 11 } } } },
      scales: {
        x: { title: { display: true, text: "Threshold", color: "#8ca0bd" },
             ticks: { color: "#8ca0bd", maxTicksLimit: 11 }, grid: { color: "rgba(148,163,184,0.06)" } },
        y: { ticks: { color: "#8ca0bd" }, grid: { color: "rgba(148,163,184,0.06)" } }
      }
    }
  });
  moveMarker(Number(slider.value));
}

function moveMarker(t) {
  if (!costChart) return;
  const pts = costChart.data.labels;
  let nearest = 0, bestDiff = 99;
  for (let i = 0; i < pts.length; i++) {
    const d = Math.abs(pts[i] - t);
    if (d < bestDiff) { bestDiff = d; nearest = i; }
  }
  const cost = costChart.data.datasets[0].data[nearest];
  costChart.data.datasets[1].data = pts.map((x, i) => i === nearest ? cost : null);
  costChart.update("none");
}

slider.addEventListener("input", () => {
  updateMetrics();
  moveMarker(Number(slider.value));
});

// initial load
updateMetrics();
drawCurve();