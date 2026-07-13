import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));

const apiCalls = [];
page.on("response", async (res) => {
  if (res.url().includes("/api/agents")) {
    let bodyLen = "n/a";
    try { bodyLen = (await res.text()).length; } catch {}
    apiCalls.push(`${res.status()} ${res.url()} (bodyLen=${bodyLen})`);
  }
});

await page.goto("http://localhost:3001/agent/689a166ba2c7034fedc51ea8/edit", { waitUntil: "networkidle", timeout: 30000 });

console.log("Current URL:", page.url());
console.log("Title:", await page.title());
console.log("API calls:", apiCalls);
console.log("Console errors:", consoleErrors);

await page.screenshot({ path: "edit_page_top.png" });

const bodyText = await page.textContent("body");
console.log("Has 'Sign in' text:", bodyText?.includes("Sign in") || bodyText?.includes("Login"));
console.log("Has 'Team Management' text:", bodyText?.includes("Team Management"));

await browser.close();
