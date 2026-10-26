const directory = document.querySelector("[data-tag-directory]");
if (directory) {
    const form = directory.querySelector("form");
    const query = form.querySelector("input");
    const status = directory.querySelector("[role=status]");
    const tags = [...directory.querySelectorAll("[data-tag-name]")].map(element => ({
        element, name: element.dataset.tagName.toLowerCase(),
    }));
    let timer;
    function update() {
        const term = query.value.trim().toLowerCase().replace(/\s+/g, " ");
        let count = 0;
        for (const { element, name } of tags) {
            element.hidden = !name.includes(term);
            if (!element.hidden) count++;
        }
        status.textContent = count ? `${count} tag${count === 1 ? "" : "s"} found.` : "No tags found. Reset to show all tags.";
    }
    form.hidden = false;
    status.hidden = false;
    query.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(update, 250); });
    form.addEventListener("submit", event => { event.preventDefault(); clearTimeout(timer); update(); });
    form.addEventListener("reset", event => {
        event.preventDefault(); clearTimeout(timer); query.value = ""; update(); query.focus();
    });
    update();
}
