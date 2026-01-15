(function(){
    function uid(){
        return Math.random().toString(16).slice(2) + Date.now().toString(16);
    }

    function nowISO(){ return new Date().toISOString(); }

    function defaultSession(){
        return {
            id: uid(),
            title: "New Session",
            createdAt: nowISO(),
            updatedAt: nowISO(),
            prefs: {}, // LLM will fill (city/budgetMax/kmMax/yearMin/fuel/gearbox/type)
            insights: {
                understood: [],
                missing: [],
                tips: []
            },
            messages: [
                { role:"bot", kind:"text", time: nowISO(), text: "Salut 👋 Je suis MyFutureDrive AI, ton assistant pour trouver ta prochaine voiture. Dis-moi ce que tu recherches." }
            ],
            cars: [],
            compare: [] // ids
        };
    }

    function load(){
        try{
            const raw = localStorage.getItem(window.CONFIG.STORAGE_KEY);
            if(!raw) return null;
            return JSON.parse(raw);
        }catch{ return null; }
    }

    function save(state){
        localStorage.setItem(window.CONFIG.STORAGE_KEY, JSON.stringify(state));
    }

    const initial = load() || {
        activeId: null,
        sessions: []
    };

    if(initial.sessions.length === 0){
        const s = defaultSession();
        initial.sessions.push(s);
        initial.activeId = s.id;
        save(initial);
    }else if(!initial.activeId){
        initial.activeId = initial.sessions[0].id;
        save(initial);
    }

    function getState(){ return initial; }
    function getActive(){
        const st = getState();
        return st.sessions.find(s => s.id === st.activeId);
    }

    function setActive(id){
        const st = getState();
        st.activeId = id;
        save(st);
    }

    function newSession(){
        const st = getState();
        const s = defaultSession();
        st.sessions.unshift(s);
        st.activeId = s.id;
        save(st);
    }

    function deleteActive(){
        const st = getState();
        if(st.sessions.length <= 1) return;
        st.sessions = st.sessions.filter(s => s.id !== st.activeId);
        st.activeId = st.sessions[0].id;
        save(st);
    }

    function updateActive(mutator){
        const st = getState();
        const s = getActive();
        if(!s) return;
        mutator(s);
        s.updatedAt = nowISO();
        save(st);
    }

    window.Store = { getState, getActive, setActive, newSession, deleteActive, updateActive };
})();
