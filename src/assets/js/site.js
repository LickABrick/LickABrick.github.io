for (const [index, pre] of [...document.querySelectorAll("pre")].entries()) {
    const code = pre.querySelector("code");
    if (!code) continue;
    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    pre.before(wrapper);
    wrapper.append(pre);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-button";
    button.textContent = "Copy";
    button.setAttribute("aria-label", `Copy code block ${index + 1}`);
    const status = document.createElement("span");
    status.className = "copy-status";
    status.setAttribute("role", "status");
    wrapper.prepend(button, status);
    button.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(code.textContent);
            status.textContent = "Copied to clipboard.";
        } catch {
            status.textContent = "Copy unavailable. Select the code and copy it manually.";
        }
    });
}
