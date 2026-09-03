# 🛡️ Return Risk Scorer — Razorpay Buildathon (Track 02: AI Risk Manager)

A **rupee-aware return-risk scorer**: it scores the probability that an e-commerce order
will be returned — the moment the order is placed — and picks the **money-optimal decision
threshold** using a cost curve, so a merchant flags the right orders without blocking good
customers.

> **Track 02 — AI Risk Manager.** Defense-only. Honest metrics including false-positive cost.
> Measured precision & recall on a held-out (time-based) test set.

🔗 **Live demo:** _add your Render URL here_
📹 **5-min video:** _add your video link here_

---

## The problem

Returns and chargebacks quietly eat a merchant's margin. In this dataset **~15% of orders
are returned** — so the data is imbalanced, and that changes everything:

> A model that just predicts "never returned" would be **~85% accurate and catch zero
> returns.** It's like an unplugged smoke detector in a building that rarely has fires —
> 99.9% "correct," but it catches none of the fires it exists for.

So accuracy is a useless headline here. This project is judged the honest way: **precision,
recall, and PR-AUC**, plus the **rupee cost of mistakes**.

---

## What it does

1. **Scores each order** — the trained model outputs a risk score (0–1), the probability
   the order is returned, with a plain verdict (flag for review / looks fine).
2. **Picks the threshold by money, not by default** — a cost curve prices every mistake in
   rupees and finds the cutoff that loses the least.
3. **Advises, never auto-blocks** — the model gives a signal; the merchant decides. A false
   positive is a real paying customer.

---

## The differentiator — rupee cost model

A risk score isn't a decision until you pick a **threshold** (a cutoff). Nobody deliberately
chose 0.5. So instead of guessing, every mistake is priced in rupees:

| Mistake | Meaning | Cost |
|---|---|---|
| **False Positive** | blocked a good order | ~30% of order value (lost margin + friction) |
| **False Negative** | missed a real return | ~120% of order value (item + two-way shipping + handling) |

Sweeping every threshold and totalling the rupee cost produces a **cost curve** with a clear
minimum. **Choosing the threshold by rupee cost saves ~₹20,000 on the test set** versus the
naive 0.5 default.

> The cost rates are business assumptions. What's robust is that a *miss* costs far more than
> a *false alarm*, and that gap drives the threshold. In production, a platform like Razorpay
> could calibrate the real costs from its own refund and shipping data — the pipeline just
> takes those numbers as input.

---

## Model selection (measured, not assumed)

Three models compared on the same held-out test set, judged by **PR-AUC** (the metric that
holds across all thresholds and — unlike ROC-AUC — isn't flattered by the 85% of easy orders):

| Model | PR-AUC | Recall | Precision |
|---|---|---|---|
| **Logistic Regression** ✅ | **0.326** | 0.588 | 0.243 |
| Random Forest | 0.259 | 0.028 | 0.333 |
| XGBoost | 0.250 | 0.373 | 0.262 |

**Winner: Logistic Regression** — the simplest model won on PR-AUC, and it's also the most
**explainable**, which matters for a tool a merchant has to trust. Complexity only earns its
place if it beats the baseline — here it didn't.

---

## How it's built to be honest (no leakage)

- **Time-based split** — trained on older orders (Jan–May), tested on newer ones (May–Jun).
  You always predict the future from the past; a random split would leak future information.
- **The test set is sacred** — the scaler and encoders are fit on training only, then applied
  to test. For every step: *"did this secretly look at the test data?"*
- **Class imbalance handled** — returns weighted ~6× heavier in training (`class_weight`),
  so the model actually learns to catch them instead of always saying "fine."
- **Synthetic data** — used to control the return patterns and avoid privacy concerns. The
  pipeline is exactly what would run on real Razorpay data; only the source would change.
- **Defense-only** — it flags risk, it never auto-blocks. Nothing offense-capable.

---

## Tech stack

- **ML:** Python, scikit-learn (Logistic Regression + StandardScaler), XGBoost, pandas
- **Backend:** Flask (REST API: `/predict`, `/metrics`, `/curve`)
- **Frontend:** HTML / CSS / JavaScript, Chart.js (live risk gauge + cost curve)
- **Deploy:** Render

---

## Project structure

```
RISK-SCORE-PREDICTOR/
├── app/
│   ├── app.py                 # Flask backend (loads model, serves API + page)
│   ├── model.pkl              # trained Logistic Regression
│   ├── scaler.pkl             # StandardScaler (fit on train only)
│   ├── feature_columns.pkl    # exact feature order for inference
│   ├── best_threshold.pkl     # recommended cost-optimal cutoff
│   ├── slider_data.json       # test scores + labels for the live tuner
│   ├── requirements.txt
│   ├── templates/index.html   # dashboard UI
│   └── static/                # style.css, script.js
├── data/orders.csv            # synthetic 6,000-order dataset
├── notebook/train.ipynb       # full pipeline: EDA → split → models → cost curve
├── requirements.txt
└── README.md
```

---

## Run locally

```bash
git clone https://github.com/supriyabajpai-ds/return-risk-scorer.git
cd return-risk-scorer
pip install -r requirements.txt
cd app
python app.py
```
Open **http://127.0.0.1:5000**

---

## Key metrics (at a glance)

- Return rate: **~15%** (imbalanced)
- Headline metric: **PR-AUC** — Logistic Regression, **0.326**
- Recall at default threshold: **59%** of returns caught
- Cost-optimal threshold: **~0.57** (value-scaled cost model)
- Savings vs naive 0.5 cutoff: **~₹20,000** on the test set

---

## What I'd add next

- Calibrate real FP/FN costs from historical refund & shipping data (per merchant)
- Per-category cost rules (a blocked ₹15k electronics order ≠ a blocked ₹500 book)
- Model monitoring / drift detection as return patterns change over time

---

_Built for the Razorpay Buildathon, Track 02 — AI Risk Manager._
