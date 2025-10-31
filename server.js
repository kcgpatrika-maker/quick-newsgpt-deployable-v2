import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import nodemailer from "nodemailer";

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.resolve("./data.json");

// Helpers
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

// Health
app.get("/", (req, res) => {
  res.send("Quick NewsGPT backend running");
});

// Demo news endpoint
app.get("/news", (req, res) => {
  const samples = [
    {
      id: "n1",
      title: "India launches new AI policy",
      summary:
        "Govt releases guidelines to boost AI transparency and local innovation.",
    },
    {
      id: "n2",
      title: "Monsoon updates",
      summary:
        "Heavy rains expected in coastal belts; farmers advised to prepare.",
    },
    {
      id: "n3",
      title: "Tech startup raises funds",
      summary: "A Bengaluru startup raised $5M for climate-tech product.",
    },
  ];
  res.json({ date: new Date().toISOString(), samples });
});

// Redirect & click logging
app.get("/r/:id", (req, res) => {
  const { id } = req.params;
  const target = decodeURIComponent(req.query.to || "");
  if (!target) return res.status(400).send("Missing redirect target");
  const data = readData();
  const dateKey = today();
  if (!data[dateKey]) data[dateKey] = {};
  data[dateKey][id] = (data[dateKey][id] || 0) + 1;
  writeData(data);
  console.log(`[${dateKey}] Click logged: ${id} (${data[dateKey][id]} total)`);
  res.redirect(target);
});

// Create tracking link
app.post("/create-link", (req, res) => {
  const { target } = req.body;
  if (!target) return res.status(400).json({ error: "Missing target URL" });
  const id = generateId();
  const data = readData();
  const dateKey = today();
  if (!data[dateKey]) data[dateKey] = {};
  data[dateKey][id] = data[dateKey][id] || 0;
  writeData(data);
  const trackLink = `${req.protocol}://${req.get("host")}/r/${id}?to=${encodeURIComponent(
    target
  )}`;
  res.json({ id, trackLink });
});

// ? New: Generate link (used by frontend button)
app.post("/generate-link", (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });
  const trackable = `${url}?ref=newsgpt`;
  res.json({ trackable });
});

// ? Updated stats endpoint
app.get("/stats", (req, res) => {
  const data = readData();
  const uptime = process.uptime();
  res.json({
    status: "ok",
    uptime,
    data,
  });
});

// Send summary (simple: total clicks + unique links)
app.get("/send-summary", async (req, res) => {
  const data = readData();
  const todayKey = today();
  const todayStats = data[todayKey] || {};
  const total = Object.values(todayStats).reduce((s, v) => s + v, 0);
  const unique = Object.keys(todayStats).length;
  const message = `<h2>Quick NewsGPT Daily Summary</h2>
    <p>Date: <strong>${todayKey}</strong></p>
    <p>Total Clicks: <strong>${total}</strong></p>
    <p>Unique Links: <strong>${unique}</strong></p>`;
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    await transporter.sendMail({
      from: `"Quick NewsGPT" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO,
      subject: `Daily Click Summary - ${todayKey}`,
      html: message,
    });
    console.log("? Summary email sent");
    res.json({ status: "ok", total });
  } catch (err) {
    console.error("Email send error:", err);
    res.status(500).json({ error: "Failed to send email", details: String(err) });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`? Backend running on port ${PORT}`));
