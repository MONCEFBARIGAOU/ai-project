import json
import re
from typing import Dict, Any, List, Optional

import requests
from pydantic import BaseModel, Field, ValidationError

# =========================
# OLLAMA CONFIG
# =========================
OLLAMA_BASE = "http://127.0.0.1:11434"
OLLAMA_MODEL = "qwen2.5:14b-instruct"

# =========================
# MEMORY (session_id -> session state)
# =========================
SESSIONS: Dict[str, Dict[str, Any]] = {}

SLOT_DEFAULTS = {
    "type": "UNSET",
    "price_max": "UNSET",
    "fuel": "UNSET",
    "gearbox": "UNSET",
    "city": "UNSET",
}

ALLOWED_FUEL = ["diesel", "essence", "hybride", "electrique", "ANY", "UNSET"]
ALLOWED_GEARBOX = ["automatique", "manuelle", "ANY", "UNSET"]

CITIES = ["Casablanca", "Rabat", "Tanger", "Marrakech", "Agadir", "Fès", "Meknès", "Kénitra", "Oujda"]

QUESTION_ORDER = ["type", "fuel", "gearbox", "price_max", "city"]

# ✅ IMPORTANT: ta liste cars (list[dict])
from smart_ai import cars


# =========================
# Strict JSON schema from LLM
# =========================
class LLMResponse(BaseModel):
    updated_slots: Dict[str, Any] = Field(...)
    done: bool = Field(...)


# =========================
# Session helpers
# =========================
def get_state(session_id: str) -> Dict[str, Any]:
    if session_id not in SESSIONS:
        SESSIONS[session_id] = {
            "slots": dict(SLOT_DEFAULTS),
            "last_asked": None,
            "turns": 0,
        }
    return SESSIONS[session_id]


# =========================
# Cheap understanding (safety net)
# =========================
def is_any_reply(txt: str) -> bool:
    t = (txt or "").lower().strip()
    return any(x in t for x in [
        "peu importe", "pas important", "n'importe", "comme tu veux",
        "aucune préférence", "sans préférence", "no preference", "any"
    ])

def extract_city(msg: str) -> Optional[str]:
    if not msg:
        return None
    low = msg.lower()
    for c in CITIES:
        if c.lower() in low:
            return c
    return None

def extract_fuel(msg: str) -> Optional[str]:
    t = (msg or "").lower()
    if "essence" in t:
        return "essence"
    if "diesel" in t or "gasoil" in t or "gaz oil" in t:
        return "diesel"
    if "hybr" in t:
        return "hybride"
    if "elect" in t or "élect" in t or "ev" in t:
        return "electrique"
    return None

def extract_gearbox(msg: str) -> Optional[str]:
    t = (msg or "").lower()
    if "auto" in t or "automatique" in t or "boite auto" in t:
        return "automatique"
    if "manuelle" in t or "manuel" in t or "boite manuelle" in t:
        return "manuelle"
    return None

def extract_type(msg: str) -> Optional[str]:
    t = (msg or "").lower()
    if "suv" in t:
        return "SUV"
    if "berline" in t:
        return "berline"
    if "citadine" in t:
        return "citadine"
    if "compact" in t:
        return "compacte"
    if "break" in t:
        return "break"
    if "pickup" in t or "pick-up" in t:
        return "pickup"
    if "coup" in t:
        return "coupé"
    return None

def extract_int(msg: str) -> Optional[int]:
    if not msg:
        return None
    m = re.search(r"\b(\d{2,9})\b", msg.replace(" ", ""))
    if not m:
        return None
    try:
        return int(m.group(1))
    except:
        return None

def update_slots_from_message(slots: Dict[str, Any], msg: str, last_asked: Optional[str]) -> Dict[str, Any]:
    msg = msg or ""

    if is_any_reply(msg) and last_asked:
        slots[last_asked] = "ANY"

    c = extract_city(msg)
    if c:
        slots["city"] = c

    f = extract_fuel(msg)
    if f:
        slots["fuel"] = f

    g = extract_gearbox(msg)
    if g:
        slots["gearbox"] = g

    ty = extract_type(msg)
    if ty:
        slots["type"] = ty

    n = extract_int(msg)
    if n is not None:
        if last_asked == "price_max":
            slots["price_max"] = n
        elif slots.get("price_max") in ["UNSET", "ANY"] and n >= 50000:
            slots["price_max"] = n

    return slots


# =========================
# Normalize slots
# =========================
def normalize_slots(slots: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(SLOT_DEFAULTS)
    out.update({k: slots.get(k, out[k]) for k in out.keys()})

    # None -> UNSET + normalize UNSET text
    for k in out.keys():
        if out[k] is None:
            out[k] = "UNSET"
        if isinstance(out[k], str) and out[k].strip().upper() == "UNSET":
            out[k] = "UNSET"

    # trim strings
    for k in ["type", "fuel", "gearbox", "city"]:
        if isinstance(out[k], str):
            out[k] = out[k].strip()

    # whitelist fuel/gearbox
    if out["fuel"] not in ALLOWED_FUEL:
        out["fuel"] = "UNSET"
    if out["gearbox"] not in ALLOWED_GEARBOX:
        out["gearbox"] = "UNSET"

    # price_max: int / ANY / UNSET
    v = out["price_max"]
    if isinstance(v, (int, float)):
        out["price_max"] = int(v)
    elif isinstance(v, str):
        vv = v.strip().upper()
        if vv in ["ANY", "UNSET"]:
            out["price_max"] = vv
        else:
            m = re.search(r"\d{2,9}", vv.replace(" ", ""))
            out["price_max"] = int(m.group(0)) if m else "UNSET"
    else:
        out["price_max"] = "UNSET"

    # city normalize
    if out["city"] not in ["ANY", "UNSET"] and isinstance(out["city"], str):
        found = None
        for c in CITIES:
            if out["city"].lower() == c.lower():
                found = c
                break
        out["city"] = found if found else "UNSET"

    return out


# =========================
# Question policy
# =========================
def pick_missing(slots: Dict[str, Any]) -> Optional[str]:
    for k in QUESTION_ORDER:
        if slots.get(k, "UNSET") == "UNSET":
            return k
    return None

def question_for_slot(slot: str) -> str:
    if slot == "type":
        return "Tu veux quel type de voiture ? (SUV, berline, citadine, …)"
    if slot == "fuel":
        return "Tu préfères quel carburant ? (essence, diesel, hybride, électrique) ou peu importe"
    if slot == "gearbox":
        return "Boîte manuelle ou automatique ? (ou peu importe)"
    if slot == "price_max":
        return "C’est quoi ton budget maximum (en MAD) ? (ou peu importe)"
    if slot == "city":
        return "Dans quelle ville tu cherches ? (Casablanca, Rabat, …) ou peu importe"
    return "Tu peux préciser un peu plus ?"


# =========================
# LLM prompt (slot filling)
# =========================
def build_prompt(user_message: str, current_slots: Dict[str, Any], last_asked: Optional[str]) -> str:
    return f"""
Tu es un assistant de slot-filling pour une recherche de voitures.
Tu DOIS renvoyer UNIQUEMENT un JSON conforme.

Slots actuels (JSON):
{json.dumps(current_slots, ensure_ascii=False)}

Dernier slot demandé (peut être null):
{json.dumps(last_asked, ensure_ascii=False)}

Message utilisateur:
{user_message}

Règles:
- Remplis updated_slots avec les slots mis à jour (tu peux renvoyer tous les slots si tu veux).
- Valeurs autorisées:
  - fuel: diesel|essence|hybride|electrique|ANY|UNSET
  - gearbox: automatique|manuelle|ANY|UNSET
  - city: une des villes connues ou ANY ou UNSET
  - price_max: un entier (MAD) ou ANY ou UNSET
  - type: texte (ex: SUV, berline, citadine...) ou ANY ou UNSET
- Si l'utilisateur dit "peu importe" pour last_asked, mets ce slot à ANY.

done = true UNIQUEMENT si AUCUN slot n'est égal à "UNSET". Sinon done=false.

Règle importante :
- Ne mets JAMAIS "type" à ANY si l'utilisateur n'a pas explicitement dit "peu importe".

JSON attendu:
{{
  "updated_slots": {{
    "type": "...",
    "price_max": "...",
    "fuel": "...",
    "gearbox": "...",
    "city": "..."
  }},
  "done": true
}}
""".strip()

def call_llm(prompt: str) -> str:
    r = requests.post(
        f"{OLLAMA_BASE}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": "Tu réponds UNIQUEMENT en JSON.\n\n" + prompt,
            "stream": False,
            "options": {"temperature": 0.0, "num_predict": 250},
        },
        timeout=120,
    )
    r.raise_for_status()
    return r.json()["response"]

def parse_llm_json(raw: str) -> Dict[str, Any]:
    raw = (raw or "").strip()
    try:
        return json.loads(raw)
    except:
        pass
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if not m:
        raise ValueError("No JSON found in LLM output")
    return json.loads(m.group(0))


# =========================
# Search
# =========================
def search_cars(slots: Dict[str, Any], limit=15) -> List[Dict[str, Any]]:
    out = []
    for c in cars:
        if slots["type"] not in ["ANY", "UNSET"] and slots["type"].lower() not in (c.get("type", "").lower()):
            continue
        if slots["fuel"] not in ["ANY", "UNSET"] and slots["fuel"] != c.get("fuel"):
            continue
        if slots["gearbox"] not in ["ANY", "UNSET"] and slots["gearbox"] != c.get("gearbox"):
            continue
        if slots["city"] not in ["ANY", "UNSET"] and slots["city"].lower() != c.get("city", "").lower():
            continue
        if slots["price_max"] not in ["ANY", "UNSET"] and c.get("price") and c["price"] > slots["price_max"]:
            continue

        out.append(c)
        if len(out) >= limit:
            break
    return out


# =========================
# Main turn
# =========================
def chat_turn(session_id: str, user_message: str) -> Dict[str, Any]:
    sess = get_state(session_id)
    state = sess["slots"]
    last_asked = sess.get("last_asked")

    # 1) Cheap extraction first (safety net)
    state = update_slots_from_message(dict(state), user_message, last_asked)
    state = normalize_slots(state)

    # 2) LLM slot-filling (can fill multiple at once)
    prompt = build_prompt(user_message, state, last_asked)
    raw = call_llm(prompt)

    try:
        data = parse_llm_json(raw)
        parsed = LLMResponse(**data)
    except Exception:
        # fallback: re-ask strictly
        raw2 = call_llm(prompt + "\n\nRAPPEL: JSON strict uniquement. Aucun texte hors JSON.")
        data2 = parse_llm_json(raw2)
        parsed = LLMResponse(**data2)

    # 3) Merge: keep state + overwrite with LLM updates
    llm_slots = dict(SLOT_DEFAULTS)
    llm_slots.update(parsed.updated_slots or {})
    merged = dict(state)
    merged.update(llm_slots)

    merged = normalize_slots(merged)

    sess["slots"] = merged

    # 4) Decide missing deterministically (anti-loop)
    missing = pick_missing(merged)
    sess["last_asked"] = missing

    # Done MUST be consistent with merged slots (never trust LLM blindly)
    done_final = (missing is None)

    # 5) If done => search
    if done_final:
        cars_out = search_cars(merged, limit=15)
        if not cars_out:
            return {
                "assistant": "Je n’ai rien trouvé 😕 Tu veux élargir (budget, ville, type) ?",
                "slots": merged,
                "cars": []
            }
        return {
            "assistant": "Parfait ✅ Voilà les meilleures options. Clique sur une voiture à droite pour voir les détails.",
            "slots": merged,
            "cars": cars_out
        }

    # 6) done=false => next question
    return {
        "assistant": question_for_slot(missing),
        "slots": merged,
        "cars": []
    }
