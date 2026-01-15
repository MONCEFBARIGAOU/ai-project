window.CONFIG = {
    // ✅ Nouveau backend: POST /ask (JSON)
    API_URL: "http://127.0.0.1:8000/chat",

    STORAGE_KEY: "myfuturedrive_copilot_v1",
    UI_KEY: "myfuturedrive_copilot_ui_v1",
    FIELDS: ["city","budgetMax","kmMax","yearMin","fuel","gearbox","type"],
    QUICK_REPLIES_ALLOWED: ["fuel","gearbox","type"],
    DELAY_MIN_MS: 800,
    DELAY_MAX_MS: 1500
};
