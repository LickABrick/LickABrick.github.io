// Official OpenPanel command queue. The SDK is loaded only for production HTML.
// Respect browser privacy signals and avoid transmitting query strings/fragments.
if (navigator.doNotTrack !== "1" && !navigator.globalPrivacyControl && !location.search && !location.hash) {
    window.op = window.op || (() => {
        const queue = [];
        return new Proxy(function (...args) {
            if (args.length) queue.push(args);
        }, {
            get(_target, key) {
                return key === "q" ? queue : (...args) => queue.push([key, ...args]);
            },
            has(_target, key) { return key === "q"; },
        });
    })();
    window.op("init", {
        apiUrl: "https://analytics.krokbv.com/api",
        clientId: "566c6043-b91d-4f0e-87ea-2019b1e3efcd",
        trackScreenViews: true,
        trackOutgoingLinks: true,
        trackAttributes: false,
    });
    const script = document.createElement("script");
    script.src = "https://openpanel.dev/op1.js";
    script.async = true;
    script.defer = true;
    document.head.append(script);
}
