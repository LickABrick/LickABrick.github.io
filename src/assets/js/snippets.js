const form = document.querySelector("#snippet-search");
const query = document.querySelector("#query");
const status = document.querySelector("#search-status");

async function enableSearch() {
    try {
        const response = await fetch("/snippet-search.json");
        if (!response.ok) throw new Error("Search index unavailable");
        const index = new Map((await response.json()).map(item => [item.url, item]));
        const entries = [...document.querySelectorAll("[data-snippet-url]")];
        function update() {
            const terms = query.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
            let count = 0;
            for (const entry of entries) {
                const item = index.get(entry.dataset.snippetUrl);
                const matches = item && terms.every(term => item.text.includes(term));
                entry.hidden = !matches;
                if (matches) count++;
            }
            status.textContent = count ? `${count} snippet${count === 1 ? "" : "s"} found.` : "No snippets found. Try another term or reset the filters.";
        }
        form.hidden = false;
        status.hidden = false;
        form.addEventListener("submit", event => event.preventDefault());
        form.addEventListener("input", update);
        form.addEventListener("change", update);
        form.addEventListener("reset", () => { query.value = ""; update(); query.focus(); });
        update();
    } catch {
        // The complete server-rendered list remains available if loading fails.
        status.hidden = false;
        status.textContent = "Interactive search is unavailable. All snippets are listed below.";
    }
}
enableSearch();
