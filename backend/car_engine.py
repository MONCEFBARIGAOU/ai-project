import json, re

cars = json.load(open("cars.json", encoding="utf-8"))

def find_cars(query):
    q = query.lower()

    budget_max = None
    m = re.findall(r"\d+", q)
    if m: budget_max = int(m[0])

    fuel = "diesel" if "diesel" in q else "essence" if "essence" in q else None

    results = []
    for c in cars:
        if budget_max and c["price"] > budget_max: continue
        if fuel and c["fuel"] != fuel: continue
        results.append(c)

    return results
