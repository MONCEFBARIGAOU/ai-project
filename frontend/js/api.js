(function(){
    async function postTurn(sessionId, message){
        const res = await fetch(window.CONFIG.API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, message })
        });
        if(!res.ok) throw new Error("API error");
        return await res.json(); // { assistant, slots, cars }
    }

    window.Api = { postTurn };
})();
