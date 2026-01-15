(function(){
    function setApiStatus(status){
        const dot = document.getElementById("apiDot");
        const txt = document.getElementById("apiText");
        dot.classList.remove("down","busy");

        if(status === "ok"){
            txt.textContent = "API: OK";
        }else if(status === "busy"){
            dot.classList.add("busy");
            txt.textContent = "API: BUSY";
        }else{
            dot.classList.add("down");
            txt.textContent = "API: DOWN";
        }
    }

    function randomDelay(){
        const { DELAY_MIN_MS, DELAY_MAX_MS } = window.CONFIG;
        return Math.floor(DELAY_MIN_MS + Math.random()*(DELAY_MAX_MS - DELAY_MIN_MS));
    }

    function toggleSidebar(){
        const side = document.getElementById("sidebar");
        side.style.display = (side.style.display === "none") ? "flex" : "none";
    }

    window.UI = { setApiStatus, randomDelay, toggleSidebar };
})();
