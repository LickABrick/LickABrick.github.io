const form = document.querySelector("#snippet-search");
const query = document.querySelector("#query");
const tag = document.querySelector("#tag");
const status = document.querySelector("#search-status");

async function enableSearch() {
    try {
        const response = await fetch("/snippet-search.json");
        if (!response.ok) throw new Error("Search index unavailable");
        const index = new Map((await response.json()).map(item => [item.url, {
            text: item.text.toLowerCase(), tags: new Set(item.tags),
        }]));
        const entries = [...document.querySelectorAll("[data-snippet-url]")];
        let timer;
        let editing = false;
        function update() {
            const terms = query.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
            let count = 0;
            for (const entry of entries) {
                const item = index.get(entry.dataset.snippetUrl);
                const matches = item && (!tag.value || item.tags.has(tag.value))
                    && terms.every(term => item.text.includes(term));
                entry.hidden = !matches;
                if (matches) count++;
            }
            status.textContent = count ? `${count} snippet${count === 1 ? "" : "s"} found.` : "No snippets found. Reset filters to show all snippets.";
        }
        function restore() {
            clearTimeout(timer);
            editing = false;
            const params = new URL(location.href).searchParams;
            query.value = params.get("q") || "";
            const value = params.get("tag") || "";
            tag.value = [...tag.options].some(option => option.value === value) ? value : "";
            update();
        }
        function save(push) {
            const url = new URL(location.href);
            for (const [key, value] of [["q", query.value.trim()], ["tag", tag.value]]) {
                if (value) url.searchParams.set(key, value);
                else url.searchParams.delete(key);
            }
            if (url.href !== location.href) history[push ? "pushState" : "replaceState"](null, "", url);
            update();
        }
        form.hidden = false;
        status.hidden = false;
        restore();
        // One history entry per editing session; subsequent keystrokes replace it.
        // Debouncing also avoids announcing every intermediate query to screen readers.
        query.addEventListener("input", () => {
            clearTimeout(timer);
            timer = setTimeout(() => { save(!editing); editing = true; }, 250);
        });
        query.addEventListener("blur", () => {
            clearTimeout(timer); save(!editing); editing = false;
        });
        tag.addEventListener("change", () => { clearTimeout(timer); save(true); editing = false; });
        form.addEventListener("submit", event => { event.preventDefault(); clearTimeout(timer); save(!editing); editing = false; });
        form.addEventListener("reset", event => {
            event.preventDefault(); clearTimeout(timer);
            query.value = ""; tag.value = ""; save(true); editing = false; query.focus();
        });
        window.addEventListener("popstate", restore);
    } catch {
        // The complete static list stays available if enhancement fails.
        form.hidden = true;
        for (const entry of document.querySelectorAll("[data-snippet-url]")) entry.hidden = false;
        status.hidden = false;
        status.textContent = "Interactive search is unavailable. All snippets are listed below.";
    }
}
enableSearch();
