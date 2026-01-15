(async function(){
    // ✅ input réel chez toi = "q"
    const inputEl = document.getElementById("q");
    const sendBtn = document.getElementById("sendBtn");

    function labelSlot(k){
        return ({
            type: "Type",
            fuel: "Carburant",
            gearbox: "Boîte",
            price_max: "Budget",
            city: "Ville",
            km_max: "KM max",
            year_min: "Année min",
        })[k] || k;
    }

    function fmtSlotValue(k, v){
        if(v == null || v === "" || v === "UNSET") return null;
        if(v === "ANY") return "peu importe";

        if(k === "price_max"){
            try { return new Intl.NumberFormat("fr-FR").format(v) + " MAD"; }
            catch { return String(v) + " MAD"; }
        }
        return String(v);
    }

    function buildInsightsFromSlots(slots){
        const KEYS = ["type","fuel","gearbox","price_max","city"]; // adapte si tu veux
        const understood = [];
        const missing = [];

        KEYS.forEach(k => {
            const v = slots?.[k];
            if(v === "UNSET" || v == null){
                missing.push(labelSlot(k));
            }else{
                const vv = fmtSlotValue(k, v);
                if(vv) understood.push(`${labelSlot(k)}: ${vv}`);
            }
        });

        const tips = [];
        if(missing.length){
            tips.push("Tu peux répondre librement ou dire “peu importe” pour passer un critère.");
            tips.push("Si tu mets juste un budget + une ville, je peux déjà proposer des voitures.");
        }else{
            tips.push("Tout est prêt ✅ Je lance la recherche et je te propose les meilleures options.");
        }

        return { understood, missing, tips };
    }

    if(!inputEl || !sendBtn){
        console.error("❌ ID manquant: vérifie que ton HTML contient #q et #sendBtn");
        return;
    }

    function addMessage(role, text){
        window.Store.updateActive(s => {
            s.messages.push({ role, kind:"text", time: new Date().toISOString(), text });
            if(role === "user" && (!s.title || s.title === "New Session")){
                s.title = text.slice(0, 32);
            }
        });
        window.Renderer.renderAll();
    }

    function addTyping(){
        window.Store.updateActive(s => {
            if(s.messages.some(m => m._typing)) return;
            s.messages.push({
                role:"bot",
                kind:"text",
                time:new Date().toISOString(),
                text:"MyFutureDrive AI est en train d’écrire ...",
                _typing:true
            });
        });
        window.Renderer.renderAll();
    }

    function removeTyping(){
        window.Store.updateActive(s => {
            s.messages = (s.messages || []).filter(m => !m._typing);
        });
        window.Renderer.renderAll();
    }

    async function send(){
        const userText = (inputEl.value || "").trim();
        if(!userText) return;

        // 1) afficher msg user
        addMessage("user", userText);
        inputEl.value = "";

        // 2) session id depuis le store
        const active = window.Store.getActive();
        const sessionId = active?.id;

        // 3) UI busy + typing
        window.UI.setApiStatus("busy");
        addTyping();

        try{
            // ✅ APPEL BACKEND /chat
            const data = await window.Api.postTurn(sessionId, userText);

            removeTyping();

            // msg bot
            if(data && typeof data.assistant === "string"){
                addMessage("bot", data.assistant);
            }

            // update prefs + cars (panneau résultats)
            window.Store.updateActive(s => {
                if(data?.slots){
                    s.prefs = s.prefs || {};
                    s.prefs.type = data.slots.type !== "ANY" ? data.slots.type : "";
                    s.prefs.fuel = data.slots.fuel !== "ANY" ? data.slots.fuel : "";
                    s.prefs.gearbox = data.slots.gearbox !== "ANY" ? data.slots.gearbox : "";
                    s.prefs.city = data.slots.city !== "ANY" ? data.slots.city : "";

                    s.prefs.budgetMax = data.slots.price_max !== "ANY" ? data.slots.price_max : "";
                    s.prefs.kmMax = data.slots.km_max !== "ANY" ? data.slots.km_max : "";
                    s.prefs.yearMin = data.slots.year_min !== "ANY" ? data.slots.year_min : "";
                }

                if(data?.slots){
                    s.insights = buildInsightsFromSlots(data.slots);
                }

                if(Array.isArray(data?.cars)){
                    s.cars = data.cars;
                }
            });

            window.Renderer.renderAll();
            window.UI.setApiStatus("ok");
            inputEl.focus();

        }catch(e){
            console.error(e);
            removeTyping();
            window.UI.setApiStatus("error");
            addMessage("bot", "❌ Erreur API. Vérifie que le backend /chat est lancé + Ollama serve.");
            inputEl.focus();
        }
    }

    function resetPrefs(){
        window.Store.updateActive(s => {
            s.prefs = {};
            s.insights = { understood: [], missing: [], tips: [] };
            s.cars = [];
            s.summary = "";
            s.quick_replies = [];
            s.compare = [];
            s.messages.push({
                role:"bot",
                kind:"text",
                time: new Date().toISOString(),
                text:"OK ✅ On repart de zéro. Décris ton besoin."
            });
        });
        window.Renderer.renderAll();
        inputEl.focus();
    }

    function exportSession(){
        const s = window.Store.getActive();
        const payload = {
            title: s.title,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
            prefs: s.prefs,
            insights: s.insights,
            cars: s.cars,
            messages: s.messages
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (s.title || "session") + ".json";
        a.click();
        URL.revokeObjectURL(url);
    }

    // expose
    window.App = { send };

    // Bind UI
    sendBtn.addEventListener("click", send);

    inputEl.addEventListener("keydown", (e) => {
        if(e.key === "Enter" && !e.shiftKey){
            e.preventDefault();
            send();
        }
    });

    document.getElementById("newSessionBtn")?.addEventListener("click", () => {
        window.Store.newSession();
        window.Renderer.renderAll();
        inputEl.focus();
    });

    document.getElementById("deleteSessionBtn")?.addEventListener("click", () => {
        window.Store.deleteActive();
        window.Renderer.renderAll();
        inputEl.focus();
    });

    document.getElementById("resetPrefsBtn")?.addEventListener("click", resetPrefs);
    document.getElementById("exportBtn")?.addEventListener("click", exportSession);

    document.getElementById("toggleSideBtn")?.addEventListener("click", () => {
        const side = document.getElementById("sidebar");
        if(side) side.style.display = "none";
    });

    document.getElementById("openSideBtn")?.addEventListener("click", window.UI.toggleSidebar);

    // Sorting
    const sortBtn = document.getElementById("sortBtn");
    const sortMenu = document.getElementById("sortMenu");

    function closeSort(){ sortMenu?.classList.remove("open"); }

    sortBtn?.addEventListener("click", () => {
        sortMenu?.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
        if(sortMenu && sortBtn && !sortMenu.contains(e.target) && e.target !== sortBtn){
            closeSort();
        }
    });

    sortMenu?.querySelectorAll(".sortItem")?.forEach(btn => {
        btn.addEventListener("click", () => {
            sortMenu.querySelectorAll(".sortItem").forEach(x => x.classList.remove("active"));
            btn.classList.add("active");

            const mode = btn.getAttribute("data-sort");

            window.Store.updateActive(s => {
                const arr = [...(s.cars || [])];
                if(mode === "score"){
                    arr.sort((a,b) => (b.score ?? 0) - (a.score ?? 0));
                }else if(mode === "price"){
                    arr.sort((a,b) => (a.price ?? 1e18) - (b.price ?? 1e18));
                }else if(mode === "year"){
                    arr.sort((a,b) => (b.year ?? 0) - (a.year ?? 0));
                }
                s.cars = arr;
            });

            window.Renderer.renderAll();
            closeSort();
        });
    });

    // Tabs
    document.querySelectorAll(".navItem").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".navItem").forEach(x => x.classList.remove("active"));
            btn.classList.add("active");
        });
    });

    // Init
    const modelPill = document.getElementById("modelPill");
    if(modelPill) modelPill.textContent = "LLM: Ollama backend";
    window.UI.setApiStatus("ok");
    window.Renderer.renderAll();
    inputEl.focus();
})();
