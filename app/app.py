from flask import Flask, request, jsonify, render_template
import pandas as pd
import joblib
import json

app = Flask(__name__)

# load the trained model + helpers
model    = joblib.load("model.pkl")
scaler   = joblib.load("scaler.pkl")
columns  = joblib.load("feature_columns.pkl")
best_thr = joblib.load("best_threshold.pkl")

# load saved test results for the slider
with open("slider_data.json") as f:
    _sd = json.load(f)
SCORES = _sd["scores"]
LABELS = _sd["labels"]
VALUES = _sd["order_values"]

FP_RATE = 0.30   # blocked good order
FN_RATE = 1.20   # missed return

@app.route("/")
def home():
    return render_template("index.html", best_threshold=round(best_thr, 2))

@app.route("/predict", methods=["POST"])
def predict():
    order = request.get_json()
    row = pd.DataFrame([order])
    row = pd.get_dummies(row, columns=["category", "payment_method"])
    row = row.reindex(columns=columns, fill_value=0)
    row_scaled = scaler.transform(row)

    score = float(model.predict_proba(row_scaled)[:, 1][0])
    flagged = score >= best_thr
    return jsonify({
        "score": score,
        "threshold": best_thr,
        "flagged": bool(flagged)
    })

@app.route("/metrics", methods=["POST"])
def metrics():
    t = request.get_json()["threshold"]
    tp = fp = fn = tn = 0
    cost = 0.0
    for score, label, value in zip(SCORES, LABELS, VALUES):
        flagged = score >= t
        if flagged and label == 1:
            tp += 1
        elif flagged and label == 0:
            fp += 1
            cost += value * FP_RATE
        elif not flagged and label == 1:
            fn += 1
            cost += value * FN_RATE
        else:
            tn += 1

    precision = tp / (tp + fp) if (tp + fp) else 0
    recall    = tp / (tp + fn) if (tp + fn) else 0
    return jsonify({
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "cost": int(cost),
        "tp": tp, "fp": fp, "fn": fn, "tn": tn
    })
@app.route("/curve")
def curve():
    # cost at every threshold from 0 to 1 — for the graph
    points = []
    t = 0.0
    while t <= 1.0001:
        cost = 0.0
        for score, label, value in zip(SCORES, LABELS, VALUES):
            flagged = score >= t
            if flagged and label == 0:
                cost += value * FP_RATE
            elif not flagged and label == 1:
                cost += value * FN_RATE
        points.append({"threshold": round(t, 2), "cost": int(cost)})
        t += 0.02

    # find the cheapest threshold on the curve
    best = min(points, key=lambda p: p["cost"])
    return jsonify({"points": points, "best": best})

if __name__ == "__main__":
    app.run(debug=True)