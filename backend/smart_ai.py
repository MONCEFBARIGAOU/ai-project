import json, re, requests

cars = json.load(open("cars.json", encoding="utf-8"))

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "qwen2.5:14b-instruct"

SYSTEM_PROMPT = """
Tu es SmartDrive AI 🚗, un assistant spécialisé dans le marché automobile marocain.

Règles :
- Tu parles en français naturel.
- Tu es cool, simple et poli.
- Tu aides à trouver des voitures au Maroc.
- Tu expliques simplement.
- Tu réponds normalement aux discussions non liées aux voitures.
- Si tu ne sais pas, tu le dis honnêtement.
"""

# -----------------------------
# Détection voiture
# -----------------------------
def is_car_question(q):
    q = q.lower()
    keywords = [
        "voiture","diesel","essence","budget","prix","moins","plus",
        "automatique","manuel","rabat","fes","casablanca","tanger",
        "marrakech","mercedes","dacia","toyota","hyundai","renault","golf","mazda",
        "bmw","audi","peugeot"
    ]
    return any(k in q for k in keywords)

# -----------------------------
# LLM Ollama
# -----------------------------
def llm_answer(prompt):
    full_prompt = SYSTEM_PROMPT + "\nUtilisateur: " + prompt + "\nAssistant:"
    r = requests.post(OLLAMA_URL, json={
        "model": OLLAMA_MODEL,
        "prompt": full_prompt,
        "stream": False
    })
    return r.json()["response"]

# -----------------------------
# Moteur SmartDrive IA
# -----------------------------
def smartdrive_answer(q):
    q = q.lower()

    budget_max = None
    budget_min = None

    m1 = re.search(r"moins de (\d+)", q)
    m2 = re.search(r"plus de (\d+)", q)

    if m1: budget_max = int(m1.group(1))
    if m2: budget_min = int(m2.group(1))

    city = None
    for c in ["rabat","fes","casablanca","tanger","marrakech","agadir","kenitra"]:
        if c in q: city = c

    brand = None
    for b in ["dacia","mercedes","toyota","hyundai","renault","golf","mazda","bmw","audi","peugeot"]:
        if b in q: brand = b

    fuel = None
    if "diesel" in q: fuel = "diesel"
    if "essence" in q: fuel = "essence"
    if "electrique" in q: fuel = "electrique"

    # ---------- Filtrage ----------
    candidates = []
    for c in cars:
        if budget_max and c["price"] > budget_max: continue
        if budget_min and c["price"] < budget_min: continue
        if city and c["city"].lower() != city: continue
        if brand and brand not in c["brand"].lower(): continue
        if fuel and c["fuel"] != fuel: continue
        candidates.append(c)

    if not candidates:
        return None

    # ---------- Scoring IA ----------
    scored = []
    for c in candidates:
        score = 0
        exp = []

        # Année
        score += max(0, 20 - (2026 - c["year"]) * 2)
        if c["year"] >= 2021: exp.append("Modèle récent")

        # Kilométrage
        score += max(0, 20 - (c["km"] // 10000) * 2)
        if c["km"] < 70000: exp.append("Kilométrage raisonnable")

        # Budget
        if budget_max and c["price"] <= budget_max:
            score += 10; exp.append("Respecte ton budget")
        if budget_min and c["price"] >= budget_min:
            score += 10; exp.append("Dans ta gamme de prix")

        # Prix
        if c["price"] < 180000:
            score += 25; exp.append("Excellent prix")
        elif c["price"] < 300000:
            score += 15; exp.append("Prix correct")
        else:
            score += 5; exp.append("Prix élevé")

        # Marque
        if c["brand"].lower() in ["dacia","toyota","hyundai","kia","mazda","renault"]:
            score += 10; exp.append("Marque fiable")

        # Entretien
        if c["brand"].lower() in ["bmw","mercedes","audi","porsche","range rover","ferrari"]:
            score += 2; exp.append("Entretien coûteux")
        else:
            score += 10; exp.append("Entretien économique")

        # Carburant
        if c["fuel"] == "diesel":
            score += 10; exp.append("Diesel économique")
        if c["fuel"] == "electrique":
            score += 10; exp.append("Électrique économique")

        # Revente
        if c["brand"].lower() in ["dacia","toyota","renault"]:
            score += 5; exp.append("Revente facile")

        scored.append((score, c, exp))

    scored.sort(reverse=True, key=lambda x: x[0])

    # ---------- Message ----------
    msg = ""
    for score, c, exp in scored[:3]:
        if score >= 70:
            tag = "🟢 EXCELLENT"
        elif score >= 55:
            tag = "🟡 BON"
        elif score >= 40:
            tag = "🟠 PASSABLE"
        else:
            tag = "🔴 À ÉVITER"

        msg += f"\n{tag} — Score {score}/100\n"
        msg += f"{c['brand']} {c['model']} – {c['price']} DH ({c['city']})\n"
        for e in exp:
            msg += f"✔ {e}\n"

    return msg

# -----------------------------
# STRUCTURED RESPONSE (frontend results panel)
# -----------------------------
def smartdrive_results(q, limit=12):
    """Return a list of ranked cars with score + short 'why' text."""
    q_low = q.lower()

    budget_max = None
    budget_min = None
    m1 = re.search(r"moins de (\d+)", q_low)
    m2 = re.search(r"plus de (\d+)", q_low)
    if m1: budget_max = int(m1.group(1))
    if m2: budget_min = int(m2.group(1))

    city = None
    for c in ["rabat","fes","casablanca","tanger","marrakech","agadir","kenitra"]:
        if c in q_low:
            city = c

    brand = None
    for b in ["dacia","mercedes","toyota","hyundai","renault","golf","mazda","bmw","audi","peugeot"]:
        if b in q_low:
            brand = b

    fuel = None
    if "diesel" in q_low: fuel = "diesel"
    if "essence" in q_low: fuel = "essence"
    if "electrique" in q_low: fuel = "electrique"

    # ---------- Filtering ----------
    candidates = []
    for c in cars:
        if budget_max and c.get("price") and c["price"] > budget_max:
            continue
        if budget_min and c.get("price") and c["price"] < budget_min:
            continue
        if city and c.get("city","").lower() != city:
            continue
        if brand and brand not in c.get("brand","").lower():
            continue
        if fuel and c.get("fuel") != fuel:
            continue
        candidates.append(c)

    if not candidates:
        return []

    # ---------- Scoring ----------
    scored = []
    for c in candidates:
        score = 0
        exp = []

        # Year
        y = c.get("year")
        if isinstance(y, int):
            score += max(0, 20 - (2026 - y) * 2)
            if y >= 2021:
                exp.append("Modèle récent")

        # Mileage
        km = c.get("km")
        if isinstance(km, int):
            score += max(0, 20 - (km // 10000) * 2)
            if km < 70000:
                exp.append("Kilométrage raisonnable")

        # Budget match
        price = c.get("price")
        if isinstance(price, int):
            if budget_max and price <= budget_max:
                score += 10; exp.append("Respecte ton budget")
            if budget_min and price >= budget_min:
                score += 10; exp.append("Dans ta gamme de prix")

            # Value tier
            if price < 180000:
                score += 25; exp.append("Excellent prix")
            elif price < 300000:
                score += 15; exp.append("Prix correct")
            else:
                score += 5; exp.append("Prix élevé")

        # Brand reliability
        b = (c.get("brand") or "").lower()
        if b in ["dacia","toyota","hyundai","kia","mazda","renault"]:
            score += 10; exp.append("Marque fiable")

        # Maintenance
        if b in ["bmw","mercedes","audi","porsche","range rover","ferrari"]:
            score += 2; exp.append("Entretien coûteux")
        else:
            score += 10; exp.append("Entretien économique")

        # Fuel hint
        f = c.get("fuel")
        if f == "diesel":
            score += 10; exp.append("Diesel économique")
        if f == "electrique":
            score += 10; exp.append("Électrique économique")

        # Resale
        if b in ["dacia","toyota","renault"]:
            score += 5; exp.append("Revente facile")

        scored.append((score, c, exp))

    scored.sort(reverse=True, key=lambda x: x[0])

    # Build car objects for the frontend
    out = []
    for score, c, exp in scored[:limit]:
        car = dict(c)  # copy
        car["score"] = int(score)
        car["why"] = " • ".join(exp[:6]) if exp else ""
        out.append(car)

    return out


def smart_response(q):
    """Unified response for the frontend.
    - If car query: returns {cars:[...], summary:'...'}
    - Else: returns {answer:'...'}
    """
    if is_car_question(q):
        cars_out = smartdrive_results(q, limit=15)
        if cars_out:
            return {
                "cars": cars_out,
                "summary": f"Je t’ai sélectionné {len(cars_out)} voiture(s). Clique à droite pour voir les détails 📌",
            }

    # fallback: normal LLM chat
    return { "answer": llm_answer(q) }

# -----------------------------
# ROUTEUR FINAL
# -----------------------------
def smart_answer(q):
    if is_car_question(q):
        r = smartdrive_answer(q)
        if r:
            return r
    return llm_answer(q)
