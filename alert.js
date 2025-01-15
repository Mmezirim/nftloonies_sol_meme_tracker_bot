const express = require("express");
const WebSocket = require("ws");
const { Telegraf } = require("telegraf");
const { config } = require("dotenv");

config();

const PORT = process.env.PORT || 8080;
const TELEGRAM_WEBHOOK_URL = process.env.WEBHOOK_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WEBSOCKET_URL = "wss://pumpportal.fun/api/data";

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
    console.error("Error sending Telegram notification:", error);
  }
}

// Function to process and send token listing information
async function processNewToken(data) {
  try {
    const { name, symbol, marketCap, volume, liquidity, ath, atl, address } = data;

    const message = `🎉 *New Meme Coin Detected on PumpPortal!*\n\n` +
      `🪙 *Name*: ${name}\n` +
      `💠 *Ticker*: ${symbol}\n` +
      `💵 *Market Cap*: $${marketCap}\n` +
      `📊 *Volume*: $${volume}\n` +
      `💧 *Liquidity*: $${liquidity}\n` +
      `🏔️ *All-Time High*: $${ath}\n` +
      `🏔️ *All-Time Low*: $${atl}\n\n` +
      `🔗 *Contract Address*: \`${address}\`\n` +
      `📜 [View on PumpPortal](https://pumpportal.fun/token/${address})\n` +
      `📥 Copy and purchase now!`;

    await sendTelegramNotification(message);
  } catch (error) {
    console.error("Error processing new token data:", error);
  }
}

// Setup WebSocket connection
function setupWebSocket() {
  const ws = new WebSocket(WEBSOCKET_URL);

  ws.on("open", () => {
    console.log("WebSocket connection established!");

    // Subscribe to new token creation events
    const payload = {
      method: "subscribeNewToken",
    };
    ws.send(JSON.stringify(payload));
    console.log("Subscribed to new token creation events.");
  });

  ws.on("message", async (data) => {
    try {
      const event = JSON.parse(data);

      // Check for new token events
      if (event.method === "newToken" && event.data) {
        await processNewToken(event.data);
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  });

  ws.on("close", () => {
    console.error("WebSocket connection closed. Reconnecting in 5 seconds...");
    setTimeout(setupWebSocket, 5000); // Reconnect after 5 seconds
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
}

// Telegram bot commands
bot.start((ctx) => {
  console.log(ctx.from);
  bot.telegram.sendMessage(
    ctx.chat.id,
    "Welcome to the Meme Coin Tracker Bot! 🚀\nI'll notify you about new meme coins launched on PumpPortal.",
    { parse_mode: "Markdown" }
  );
});

bot.command("status", (ctx) => {
  bot.telegram.sendMessage(
    ctx.chat.id,
    "Bot is active! ✅\nMonitoring real-time new token events from PumpPortal.",
    { parse_mode: "Markdown" }
  );
});

bot.command("help", (ctx) => {
  bot.telegram.sendMessage(
    ctx.chat.id,
    "Available commands:\n/start - Start the bot\n/status - Check bot status\n/help - Get help.",
    { parse_mode: "Markdown" }
  );
});

// Webhook endpoint for Telegram updates
app.get("/", (req, res) => {
  res.send("Bot is running");
  console.log("Health check: Bot is up");
});

app.use("/webhook", bot.webhookCallback("/webhook"));

// Start the WebSocket connection and Express server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  setupWebSocket();

  // Set Telegram webhook URL
  try {
    await bot.telegram.setWebhook(`${TELEGRAM_WEBHOOK_URL}/webhook`);
    console.log("Telegram webhook set successfully!");
  } catch (error) {
    console.error("Error setting webhook:", error);
  }
});
