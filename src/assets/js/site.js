for (const [index, block] of [...document.querySelectorAll(".code-block")].entries()) {
    const code = block.querySelector("code");
    const button = block.querySelector(".copy-button");
    const status = block.querySelector(".copy-status");
    if (!code || !button || !status) continue;
    button.hidden = false;
    button.setAttribute("aria-label", `Copy code block ${index + 1}`);
    let reset;
    button.addEventListener("click", async () => {
        clearTimeout(reset);
        status.textContent = "";
        try {
            await navigator.clipboard.writeText(code.textContent);
            button.textContent = "Copied";
            status.textContent = "Copied to clipboard.";
        } catch {
            button.textContent = "Copy";
            status.textContent = "Copy unavailable. Select the code and copy it manually.";
        }
        reset = setTimeout(() => { button.textContent = "Copy"; status.textContent = ""; }, 2500);
    });
}
