import fs from "fs/promises";
export default function lottie() {
    return {
        name: "astro-lottie",
        hooks: {
            "astro:config:setup": async ({ injectScript }) => {
                const script = await fs.readFile(new URL("./loader.js", import.meta.url), "utf8");
                injectScript("page", script);
            }
        }
    };
}
//# sourceMappingURL=index.js.map