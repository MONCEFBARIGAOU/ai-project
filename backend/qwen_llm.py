import requests

def talk(prompt):
    r = requests.post("http://localhost:11434/api/generate", json={
        "model": "qwen2.5:14b-instruct",
        "prompt": prompt,
        "stream": False
    })
    return r.json()["response"]
