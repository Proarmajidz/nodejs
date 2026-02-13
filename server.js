import fetch from "node-fetch";
import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(express.json({ limit: "1mb" }));

// Allow your frontend(s)
app.use(
  cors({
    origin: process.env.APP_ORIGIN ? process.env.APP_ORIGIN.split(",") : true,
    credentials: true,
    allowedHeaders: ["Content-Type", "X-Api-Key"],
  })
);

// ✅ Authorization Middleware
function validateApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"]?.replace("Bearer ", "");
  
  if (!apiKey) {
    return res.status(401).json({ error: "API key is required" });
  }
  
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: "Invalid API key" });
  }
  
  next();
}

// Health check (unprotected)
app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * POST /api/chat
 * Headers: x-api-key: YOUR_SECRET_KEY
 * Body: { messages: [{role:"user"|"assistant"|"system", content:string}], model?: string }
 */
app.post("/api/chat", validateApiKey, async (req, res) => {
  try {
    const { messages, model } = req.body;
    
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages[] is required" });
    }
    
    // Basic validation
    for (const m of messages) {
      if (!m || typeof m !== "object") {
        return res.status(400).json({ error: "Invalid message" });
      }
      if (!["user", "assistant", "system"].includes(m.role)) {
        return res.status(400).json({ error: `Invalid role: ${m.role}` });
      }
      if (typeof m.content !== "string") {
        return res.status(400).json({ error: "Message content must be a string" });
      }
    }
    
    const chosenModel = model || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_ORIGIN || "http://localhost",
        "X-Title": "My Chatbot API",
      },
      body: JSON.stringify({
        model: chosenModel,
        messages,
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({
        error: "OpenRouter request failed",
        details: data,
      });
    }
    
    const reply = data?.choices?.[0]?.message?.content ?? "";
    return res.json({ reply, raw: data });
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
