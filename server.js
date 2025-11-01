import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import RSSParser from "rss-parser";

const app = express();
app.use(cors());
app.use(express.json());

const rssParser = new RSSParser();

// ---------- Basic storage for click tracking ----------
const DATA_FILE = path.resolve("./data.json");
function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}
function writeData(d) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2));
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function generateId() {
  return crypto.randomBytes(4).toString("hex");
}

// ---------- RSS setup ----------
const FEEDS = [
  "https://www.thehindu.com/news/rssfeedfrontpage.xml",
  "https://timesofindia.indiatimes.com/rssfeedstopstories.cms",
  "https://feeds.bbci.co.uk/news/rss.xml"
];

let feedCache = { updatedAt: 0, items: [] };
const CACHE_TTL_MS = 1000 * 60 * 8; // 8 minutes

async function refreshFeeds() {
  const now = Date.now();
  if (now - feedCache.updatedAt < CACHE_TTL_MS && feedCache.items.length) {
    return feedCache.items;
  }
  const items = [];
  for (const url of FEEDS) {
    try {
      const feed = await rssParser.parseURL(url);
      const sourceTitle = feed.title || url;
      (feed.items || []).forEach((it) => {
        items.push({
          title: it.title || "",
          link: it.link || "",
          pubDate: it.pubDate || it.isoDate || null,
          description: it.contentSnippet || it.summary || it.content || "",
          source: sourceTitle
        });
      });
    } catch (err) {
      console.warn("Feed fetch failed:", url, err.message);
    }
  }
  items.sort((a, b) => {
    const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return tb - ta;
  });
  feedCache = { updatedAt: Date.now(), items };
  return items;
}

// ---------- Basic routes ----------
app.get("/", (req, res) => {
  res.send("Quick NewsGPT backend running with free RSS mode ✅");
});

app.get("/news", async (req, res) => {
  const items = await refreshFeeds();
  res.json({ date: new Date().toISOString(), items: items.slice(0, 5) });
});

// ---------- Ask endpoint (free AI-less smart search) ----------
app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Missing question" });
    }

    const items = await refreshFeeds();
    const q = question.trim().toLowerCase();
    const keywords = q.split(/\s+/).filter(Boolean);
    const isGeneral = /latest|today|top|headlines|news/i.test(question);

    const scored = items.map(item => {
      const hay = (item.title + " " + item.description + " " + item.source).toLowerCase();
      let score = 0;
      if (isGeneral) score = 1;
      for (const k of keywords) if (hay.includes(k)) score += 2;
      const time = item.pubDate ? new Date(item.pubDate).getTime() : 0;
      score += time / 1e12; // small boost for recent
      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 6).map(s => s.item);

    res.json({
      mode: "free-rss",
      query: question,
      results: top
    });
  } catch (err) {
    console.error("Error /ask:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ---------- Tracking (same as before) ----------
app.get("/r/:id", (req, res) => {
  const { id } = req.params;
  const target = decodeURIComponent(req.query.to || "");
  if (!target) return res.status(400).send("Missing redirect target");
  const data = readData();
  const dateKey = today();
  if (!data[dateKey]) data[dateKey] = {};
  data[dateKey][id] = (data[dateKey][id] || 0) + 1;
  writeData(data);
  res.redirect(target);
});

app.post("/create-link", (req, res) => {
  const { target } = req.body;
  if (!target) return res.status(400).json({ error: "Missing target URL" });
  const id = generateId();
  const data = readData();
  const dateKey = today();
  if (!data[dateKey]) data[dateKey] = {};
  data[dateKey][id] = data[dateKey][id] || 0;
  writeData(data);
  const trackLink = `${req.protocol}://${req.get("host")}/r/${id}?to=${encodeURIComponent(target)}`;
  res.json({ id, trackLink });
});

app.get("/stats", (req, res) => {
  res.json(readData());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
