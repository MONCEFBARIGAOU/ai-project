(function(){
    const $ = (id) => document.getElementById(id);

    function fmtMAD(n){
        if(n == null || n === "ANY") return "—";
        try{ return new Intl.NumberFormat("fr-FR").format(n) + " MAD"; }catch{ return n + " MAD"; }
    }

    function safeText(t){
        return (t || "").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }

    function cssSafe(s){ return (s || "").replace(/[^a-zA-Z0-9_-]/g, "_"); }

    function ensureCarSid(car){
        if(car._sid) return car._sid;
        const id = car.id || (car.model + "|" + car.city + "|" + car.price);
        car._sid = id;
        return id;
    }

    function makeWhy(car){
        if(car.why) return car.why;
        const bits = [];
        if(car.type) bits.push(`type ${car.type}`);
        if(car.fuel) bits.push(`carburant ${car.fuel}`);
        if(car.gearbox) bits.push(`boîte ${car.gearbox}`);
        if(car.year) bits.push(`année ${car.year}`);
        if(car.km != null) bits.push(`${car.km} km`);
        if(car.price != null) bits.push(`${car.price} MAD`);
        return "Bon compromis basé sur " + bits.join(", ") + " selon tes critères.";
    }

    /* ---------------- Sidebar ---------------- */
    function renderSidebar(){
        const st = window.Store.getState();
        const list = $("sessionList");
        list.innerHTML = "";

        st.sessions.forEach(s => {
            const div = document.createElement("div");
            div.className = "sessionItem" + (s.id === st.activeId ? " active" : "");
            div.innerHTML = `
        <div class="sessionTitle">${safeText(s.title || "Session")}</div>
        <div class="sessionMeta">
          <span>${(s.messages?.length || 0)} msg</span>
          <span>${new Date(s.updatedAt).toLocaleDateString()}</span>
        </div>
      `;
            div.onclick = () => {
                window.Store.setActive(s.id);
                renderAll();
            };
            list.appendChild(div);
        });
    }

    /* ---------------- Insights ---------------- */
    function renderInsights(){
        const s = window.Store.getActive();
        $("insightMeta").textContent = `Session: ${s.title || "—"}`;

        if(s.insights?.understood?.length){
            $("kUnderstood").innerHTML = s.insights.understood.map(x => "• " + safeText(x)).join("<br/>");
        }else{
            $("kUnderstood").textContent = "Commence par décrire ton besoin (ville, budget, type…).";
        }

        const miss = (s.insights && s.insights.missing) ? s.insights.missing : [];
        const mc = $("missingChips");
        mc.innerHTML = "";
        if(miss.length){
            miss.forEach(m => {
                const chip = document.createElement("div");
                chip.className = "chip";
                chip.textContent = m;
                mc.appendChild(chip);
            });
        }else{
            const chip = document.createElement("div");
            chip.className = "chip";
            chip.textContent = "Aucun (tu peux demander des résultats maintenant)";
            mc.appendChild(chip);
        }

        if(s.insights?.tips?.length){
            $("kTips").innerHTML = s.insights.tips.map(x => "• " + safeText(x)).join("<br/>");
        }else{
            $("kTips").textContent = "Je peux affiner si tu veux, mais je peux aussi proposer des véhicules sans tout préciser.";
        }

        $("kpiResults").textContent = (s.cars?.length || 0).toString();
        const topScore = s.cars?.length ? (s.cars[0].score ?? "—") : "—";
        $("kpiTopScore").textContent = topScore;

        $("kpiBudget").textContent = fmtMAD(s.prefs?.budgetMax);
        $("kpiCity").textContent = (s.prefs?.city && s.prefs.city !== "ANY") ? s.prefs.city : "—";
    }

    /* ---------------- Chat ---------------- */
    function renderChat(){
        const s = window.Store.getActive();
        const chat = $("chat");
        chat.innerHTML = "";

        (s.messages || []).forEach(msg => {
            const row = document.createElement("div");
            row.className = "msgRow " + (msg.role === "user" ? "user" : "bot");

            const avatar = document.createElement("div");
            avatar.className = "avatar " + (msg.role === "user" ? "user" : "");
            avatar.textContent = msg.role === "user" ? "U" : "AI";

            const bubble = document.createElement("div");
            bubble.className = "bubble " + (msg.role === "user" ? "user" : "bot");
            bubble.innerHTML = safeText(msg.text || "");

            const meta = document.createElement("div");
            meta.className = "metaLine";
            meta.innerHTML = `<span class="small">${msg.role === "user" ? "You" : "MyFutureDrive AI"}</span><span class="small">${new Date(msg.time).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"})}</span>`;
            bubble.appendChild(meta);

            if(msg.role === "user"){
                row.appendChild(bubble);
                row.appendChild(avatar);
            }else{
                row.appendChild(avatar);
                row.appendChild(bubble);
            }
            chat.appendChild(row);
        });

        chat.scrollTop = chat.scrollHeight;
    }

    /* ---------------- Modal helpers ---------------- */
    function openModal(id){
        const el = $(id);
        el.classList.add("open");
        el.setAttribute("aria-hidden","false");
    }
    function closeModal(id){
        const el = $(id);
        el.classList.remove("open");
        el.setAttribute("aria-hidden","true");
    }

    function bindModalsOnce(){
        // car modal close
        const carModal = $("carModal");
        const carClose = $("carModalClose");
        if(carClose && !carClose._bound){
            carClose._bound = true;
            carClose.onclick = () => closeModal("carModal");
        }
        if(carModal && !carModal._bound){
            carModal._bound = true;
            carModal.addEventListener("click", (e) => {
                if(e.target === carModal) closeModal("carModal");
            });
        }

        // image modal close
        const imgModal = $("imgModal");
        const imgClose = $("imgModalClose");
        if(imgClose && !imgClose._bound){
            imgClose._bound = true;
            imgClose.onclick = () => closeModal("imgModal");
        }
        if(imgModal && !imgModal._bound){
            imgModal._bound = true;
            imgModal.addEventListener("click", (e) => {
                if(e.target === imgModal) closeModal("imgModal");
            });
        }

        // Escape closes
        if(!document._modalEscBound){
            document._modalEscBound = true;
            document.addEventListener("keydown", (e) => {
                if(e.key === "Escape"){
                    closeModal("carModal");
                    closeModal("imgModal");
                }
            });
        }
    }

    function openImage(url){
        const img = $("imgModalEl");
        img.src = url;
        openModal("imgModal");
    }

    function openCarDetails(car){
        const title = $("carModalTitle");
        const body = $("carModalBody");
        title.textContent = car.model || "Détails véhicule";

        const why = makeWhy(car);
        const price = fmtMAD(car.price);
        const imgUrl = car.image || "";

        body.innerHTML = `
      <div class="modalCar">
        <div class="modalMedia" id="modalMedia">
          <img src="${imgUrl}" alt="photo"/>
        </div>

        <div class="modalInfo">
          <div class="modalModel">${safeText(car.model || "—")}</div>
          <div class="modalPrice">${price}</div>

          <div class="modalLine">
            ${car.type ? `• Type: <b>${safeText(car.type)}</b><br/>` : ``}
            ${car.city ? `• Ville: <b>${safeText(car.city)}</b><br/>` : ``}
            ${car.fuel ? `• Carburant: <b>${safeText(car.fuel)}</b><br/>` : ``}
            ${car.gearbox ? `• Boîte: <b>${safeText(car.gearbox)}</b><br/>` : ``}
            ${car.year ? `• Année: <b>${car.year}</b><br/>` : ``}
            ${car.km != null ? `• KM: <b>${car.km}</b><br/>` : ``}
            ${car.score != null ? `• Score: <b>${car.score}/100</b><br/>` : ``}
          </div>

          <div class="modalActions">
            ${car.whatsapp ? `<a class="btnLink" href="https://wa.me/${car.whatsapp}" target="_blank">WhatsApp</a>` : ``}
            <button class="btnSmall" id="modalCompareBtn">Comparer</button>
          </div>

          <div class="modalWhy">${safeText(why)}</div>
        </div>
      </div>
    `;

        // image zoom
        const media = $("modalMedia");
        if(media){
            media.onclick = () => {
                if(imgUrl) openImage(imgUrl);
            };
        }

        // compare adds to compare slots
        const compareBtn = $("modalCompareBtn");
        if(compareBtn){
            compareBtn.onclick = () => {
                const id = ensureCarSid(car);
                window.Store.updateActive(s => {
                    const c = s.compare || [];
                    if(c.includes(id)){
                        s.compare = c.filter(x => x !== id);
                    }else{
                        if(c.length >= 2) c.shift();
                        c.push(id);
                        s.compare = c;
                    }
                });
                renderCompare();
            };
        }

        openModal("carModal");
    }

    /* ---------------- Results ---------------- */
    function renderResults(){
        bindModalsOnce();

        const s = window.Store.getActive();
        const list = $("resultsList");
        const summary = $("resultsSummary");

        list.classList.add("compact");

        if(!s.cars || s.cars.length === 0){
            summary.textContent = "Aucun résultat pour l’instant. Lance une recherche via le chat.";
            list.innerHTML = "";
            $("compareGrid").innerHTML = "";
            return;
        }

        summary.textContent = s.summary || `Top ${s.cars.length} véhicules (clique sur un résultat pour ouvrir la fiche).`;

        list.innerHTML = "";

        // ensure scores exist (fallback demo)
        s.cars.forEach(car => {
            ensureCarSid(car);
            if(car.score == null){
                car.score = Math.min(99, Math.max(55, 75 + Math.floor(Math.random()*15)));
            }
        });

        s.cars.forEach(car => {
            const row = document.createElement("div");
            row.className = "resultRow";
            row.innerHTML = `
        <div class="resultName">${safeText(car.model || "—")}</div>
        <div class="resultPrice">${fmtMAD(car.price)}</div>
      `;
            row.onclick = () => openCarDetails(car);
            list.appendChild(row);
        });

        renderCompare();
    }

    /* ---------------- Compare ---------------- */
    function renderCompare(){
        const s = window.Store.getActive();
        const grid = $("compareGrid");
        grid.innerHTML = "";

        const ids = s.compare || [];
        if(ids.length < 2){
            for(let i=0;i<2;i++){
                const div = document.createElement("div");
                div.className = "compareItem";
                div.innerHTML = `<div class="cTitle">Slot ${i+1}</div><div class="cMeta">Clique un véhicule puis “Comparer”.</div>`;
                grid.appendChild(div);
            }
            return;
        }

        const a = s.cars.find(x => x._sid === ids[0]);
        const b = s.cars.find(x => x._sid === ids[1]);

        [a,b].forEach((car, idx) => {
            const div = document.createElement("div");
            div.className = "compareItem";
            if(!car){
                div.innerHTML = `<div class="cTitle">Slot ${idx+1}</div><div class="cMeta">Sélection invalide.</div>`;
            }else{
                div.innerHTML = `
          <div class="cTitle">${safeText(car.model || "—")}</div>
          <div class="cMeta">
            Score: ${car.score}/100<br/>
            Prix: ${fmtMAD(car.price)}<br/>
            Année: ${car.year ?? "—"}<br/>
            KM: ${car.km ?? "—"}<br/>
            Ville: ${car.city ?? "—"}<br/>
            Fuel: ${car.fuel ?? "—"} • Boîte: ${car.gearbox ?? "—"}<br/>
            ${car.type ? `Type: ${safeText(car.type)}` : ""}
          </div>
        `;
            }
            grid.appendChild(div);
        });
    }

    /* ---------------- Quick replies ---------------- */
    function renderQuickReplies(){
        const s = window.Store.getActive();
        const qr = $("quickReplies");
        qr.innerHTML = "";

        const backendQR = s.quick_replies || [];
        if(!backendQR.length) return;

        backendQR.forEach(opt => {
            const b = document.createElement("button");
            b.className = "qrBtn";
            b.textContent = opt;
            b.onclick = () => {
                const input = document.getElementById("q");
                input.value = opt;
                window.App.send();
            };
            qr.appendChild(b);
        });
    }

    function renderAll(){
        renderSidebar();
        renderInsights();
        renderChat();
        renderResults();
        renderQuickReplies();
    }

    window.Renderer = { renderAll, renderSidebar, renderChat, renderResults, renderInsights, renderQuickReplies };
})();
