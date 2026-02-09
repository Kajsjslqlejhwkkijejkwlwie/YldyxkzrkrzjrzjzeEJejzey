const http = require("http");
const WebSocket = require("ws");
const puppeteer = require("puppeteer-core");

const PORT = process.env.PORT || 8080;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

let clients = [];

wss.on("connection", ws => {
    clients.push(ws);
    ws.on("message", m => {
        if (m.toString().includes("protocol")) ws.send("{}\x1e");
    });
    ws.on("close", () => {
        clients = clients.filter(c => c !== ws);
    });
});

function forward(d) {
    let m = typeof d === "string" ? d : d.toString("utf8");
    if (!m.endsWith("\x1e")) m += "\x1e";
    clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.send(m);
    });
}

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        executablePath: "/usr/bin/chromium",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu"
        ]
    });

    const page = await browser.newPage();
    await page.goto("https://1x-bet.mobi/en/games/crash", { waitUntil: "networkidle2" });

    const cdp = await page.target().createCDPSession();
    await cdp.send("Network.enable");

    cdp.on("Network.webSocketFrameReceived", e => {
        forward(e.response.payloadData);
    });
})();

server.listen(PORT);
