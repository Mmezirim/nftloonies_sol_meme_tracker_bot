const express = require("express");
const WebSocket = require("ws");
const { Telegraf } = require("telegraf");
const { config } = require("dotenv");

config();

const PORT = process.env.PORT || 8080;
const TELEGRAM_WEBHOOK_URL = process.env.WEBHOOK_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const PUMPPORTAL_WS_URL = "wss://pumpportal.fun/api/data";

// Initialize Telegram bot
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const app = express();

// Helper function to send Telegram notifications
async function sendTelegramNotification(message) {
  try {
    await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, message, {
      parse_mode: "Markdown",
    });
    console.log("Notification sent to Telegram:", message);
  } catch (error) {
    console.error("Error sending Telegram notification:", error.response?.data || error.message);
  }
}

// Process new token listings
function processNewToken(data) {
  const { name, ticker, marketCap, volume, liquidity, address } = data;
  const message = `🎉 *New Meme Coin Detected on PumpPortal!*\n\n` +
    `🪙 *Name*: ${name || "Unknown"}\n` +
    `💠 *Ticker*: ${ticker || "Unknown"}\n` +
    `💵 *Market Cap*: ${marketCap || "N/A"}\n` +
    `📊 *Volume*: ${volume || "N/A"}\n` +
    `💧 *Liquidity*: ${liquidity || "N/A"}\n\n` +
    `🔗 *Contract Address*: \`${address}\`\n` +
    `📜 [View on PumpPortal](https://pumpportal.fun/token/${address})\n`;

  sendTelegramNotification(message);
}

// Process new Raydium liquidity events
function processRaydiumLiquidity(data) {
  const { token, liquidity, transaction, poolAddress } = data;
  const message = `🟣 *New Liquidity Added on Raydium!*\n\n` +
    `🪙 *Token*: ${token.name || "Unknown"} (${token.symbol || "Unknown"})\n` +
    `💧 *Liquidity*: ${liquidity || "N/A"}\n\n` +
    `🔗 *Pool Address*: \`${poolAddress}\`\n` +
    `📜 [View Transaction](https://pumpportal.fun/tx/${transaction})\n`;

  sendTelegramNotification(message);
}

// WebSocket connection and subscriptions
function startWebSocketConnection() {
  const ws = new WebSocket(PUMPPORTAL_WS_URL);

  ws.on("open", () => {
    console.log("WebSocket connection established!");

    // Subscribe to new token events
    ws.send(JSON.stringify({ method: "subscribeNewToken" }));
    console.log("Subscribed to new token creation events.");

    // Subscribe to Raydium liquidity events
    ws.send(JSON.stringify({ method: "subscribeRaydiumLiquidity" }));
    console.log("Subscribed to Raydium liquidity events.");
  });

  ws.on("message", (data) => {
    const event = JSON.parse(data);
    if (event.method === "newToken" && event.data) {
      processNewToken(event.data);
    } else if (event.method === "raydiumLiquidity" && event.data) {
      processRaydiumLiquidity(event.data);
    } else {
      console.log("Unhandled WebSocket event:", event);
    }
  });

  ws.on("close", () => {
    console.error("WebSocket connection closed. Reconnecting in 5 seconds...");
    setTimeout(startWebSocketConnection, 5000);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
}

// Start WebSocket connection
startWebSocketConnection();

// Telegram bot commands
bot.start((ctx) => {
  ctx.reply("Welcome to the Meme Coin & Raydium Tracker Bot! 🚀\nI'll notify you about new meme coins and Raydium liquidity events.", { parse_mode: "Markdown" });
});

bot.command("status", (ctx) => {
  ctx.reply("Bot is active! ✅\nMonitoring PumpPortal for new token listings and Raydium liquidity events.", { parse_mode: "Markdown" });
});

bot.command("help", (ctx) => {
  ctx.reply("Available commands:\n/start - Start the bot\n/status - Check bot status\n/help - Get help.", { parse_mode: "Markdown" });
});

// Ensure bot is launched
bot.launch().then(() => {
  console.log("Telegram bot launched and ready!");
}).catch((error) => {
  console.error("Error launching Telegram bot:", error);
});

// Webhook endpoint for Telegram updates
app.get("/", (req, res) => {
  res.send("Bot is running");
  console.log("Health check: Bot is up");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});