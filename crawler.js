const axios = require("axios");
const cheerio = require("cheerio");
const robotsParser = require("robots-parser");
const fs = require("fs");
const https = require("https");
const io = require("socket.io-client");

// الاتصال بالسيرفر المحلي
const socket = io("http://localhost:3000");

// تحميل البيانات القديمة
let sites = fs.existsSync("sites.json") ? JSON.parse(fs.readFileSync("sites.json")) : [];
let images = fs.existsSync("images.json") ? JSON.parse(fs.readFileSync("images.json")) : [];
let visited = new Set(sites.map(site => site.url));

// تجاهل أخطاء الشهادة
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

async function isAllowed(url) {
  try {
    const parsed = new URL(url);
    const robotsUrl = `${parsed.protocol}//${parsed.hostname}/robots.txt`;
    const res = await axios.get(robotsUrl, { httpsAgent, timeout: 5000 });
    const robots = robotsParser(robotsUrl, res.data);
    return robots.isAllowed(url, "*");
  } catch {
    return true;
  }
}

async function crawl(url) {
  if (visited.has(url) || !(await isAllowed(url))) return;
  visited.add(url);

  socket.emit("log", `🟢 Crawling: ${url}`);

  try {
    const res = await axios.get(url, { httpsAgent, timeout: 10000 });
    const $ = cheerio.load(res.data);

    const title = $("title").text() || "No title";
    const description = $('meta[name="description"]').attr("content") || "No description";
    const favicon = $('link[rel="icon"]').attr("href") || $('link[rel="shortcut icon"]').attr("href") || "";
    const faviconUrl = favicon.startsWith("http") ? favicon : new URL(favicon, url).href;

    sites.push({ url, title, description, favicon: faviconUrl });
    fs.writeFileSync("sites.json", JSON.stringify(sites, null, 2));

    socket.emit("site", { url, title });

    $("img").each((_, img) => {
      let src = $(img).attr("src");
      if (src) {
        const fullSrc = src.startsWith("http") ? src : new URL(src, url).href;
        if (!images.includes(fullSrc)) images.push(fullSrc);
      }
    });
    fs.writeFileSync("images.json", JSON.stringify(images, null, 2));

    const links = [];
    $("a").each((_, a) => {
      const href = $(a).attr("href");
      if (href && href.startsWith("http") && !visited.has(href)) {
        links.push(href);
      }
    });

    for (const link of shuffleArray(links)) {
      await crawl(link);
    }

  } catch (err) {
    socket.emit("error", `❌ Error at ${url}: ${err.message}`);
  }
}

function shuffleArray(array) {
  return array.sort(() => Math.random() - 0.5);
}

socket.on("connect", () => {
  console.log("🔌 Connected to WebSocket server");
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected from WebSocket server");
});


// ابدأ الزحف من موقع
crawl("https://www.discord.com");
