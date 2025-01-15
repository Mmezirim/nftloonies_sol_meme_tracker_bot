const express = require("express");
const WebSocket = require("ws");
const { Telegraf } = require("telegraf");
const { config } = require("dotenv");

config();

const PORT = process.env.PORT || 8080;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const PUMPPORTAL_WS_URL = "wss://pumpportal.fun/api/data";

// Initialize Telegram bot
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const app = express();

// Variables to store the last five token listings and liquidity events
let recentTokenListings = [];
let recentLiquidityEvents = [];

// Helper function to send Telegram notifications
async function sendTelegramNotification(message) {
  try {
    console.log("Sending Telegram message:", message); // Added log for message content
    await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, message, {
      parse_mode: "Markdown",
    });
    console.log("Notification sent to Telegram:", message);
  } catch (error) {
    console.error("Error sending Telegram notification:", error.response?.data || error.message);
  }
}

// Process new Raydium liquidity events
function processRaydiumLiquidity(data) {
  console.log("Processing Raydium liquidity event data:", data); // Log event data

  const { signature, mint, traderPublicKey, txType, initialBuy, solAmount, bondingCurveKey, vTokensInBondingCurve, vSolInBondingCurve, marketCapSol, name, symbol, uri, pool } = data;
  
  const message = `*New Liquidity Event:*\n\n` +
    `🪙 *Token Name*: ${name || "Unknown"} (${symbol || "Unknown"})\n` +
    `💰 *Amount of SOL*: ${solAmount || "N/A"}\n` +
    `🛠 *Initial Buy Amount*: ${initialBuy || "N/A"}\n` +
    `📊 *Market Cap in SOL*: ${marketCapSol || "N/A"}\n\n` +
    `🔗 *Transaction Type*: ${txType || "Unknown"}\n` +
    `🧑‍💼 *Trader Public Key*: ${traderPublicKey || "Unknown"}\n` +
    `🔑 *Mint Address*: ${mint || "Unknown"}\n` +
    `🌐 *URI*: [Token Metadata](${uri || "#"})\n\n` +
    `📊 *Liquidity in Bonding Curve:*\n` +
    `- Tokens: ${vTokensInBondingCurve || "N/A"}\n` +
    `- SOL: ${vSolInBondingCurve || "N/A"}\n\n` +
    `🏊‍♂️ *Pool*: ${pool || "Unknown"}\n` +
    `🔒 *Signature*: ${signature || "Unknown"}`;

  // Add the new liquidity event to the list, keeping only the last 5
  recentLiquidityEvents.unshift(message); // Add to the front of the list
  if (recentLiquidityEvents.length > 5) {
    recentLiquidityEvents.pop(); // Remove the oldest item if more than 5
  }

  // Send the liquidity event message to Telegram
  sendTelegramNotification(message);
}

// Process new token listings from WebSocket event
function processNewToken(data) {
  const { name, symbol, marketCapSol, solAmount, initialBuy, uri, signature, mint } = data;

  const message = `🎉 *New Token Created on PumpPortal!*\n\n` +
    `🪙 *Name*: ${name || "Unknown"}\n` +
    `💠 *Symbol*: ${symbol || "Unknown"}\n` +
    `💵 *Market Cap (in SOL)*: ${marketCapSol || "N/A"}\n` +
    `💰 *Initial Buy Amount*: ${initialBuy || "N/A"} SOL\n` +
    `🔗 *Token Mint*: [${mint}](https://solscan.io/address/${mint})\n` +
    `📜 *Transaction Signature*: [${signature}](https://solscan.io/tx/${signature})\n` +
    `🌐 *Token URI*: [View Metadata](${uri})\n`;

  // Add the new token listing to the list, keeping only the last 5
  recentTokenListings.unshift(message); // Add to the front of the list
  if (recentTokenListings.length > 5) {
    recentTokenListings.pop(); // Remove the oldest item if more than 5
  }

  // Send the token listing message to Telegram
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
    console.log("Received WebSocket event:", event); // Log the entire event
    
    // Check method and log it
    if (event.method === "newToken" && event.data) {
      console.log("Processing new token data:", event.data); // Log the data being processed
      processNewToken(event.data); // Process the new token creation event
    } else if (event.method === "raydiumLiquidity" && event.data) {
      console.log("Processing Raydium liquidity data:", event.data); // Log the data being processed
      processRaydiumLiquidity(event.data); // Process liquidity events
    } else {
      console.log("Unhandled WebSocket event:", event); // Log any unhandled event
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

// Handle /list command to show the last 5 token or liquidity events
bot.command("list", (ctx) => {
  console.log("List command triggered!");

  let message = "*Last 5 Token Listings:*\n\n";
  if (recentTokenListings.length > 0) {
    recentTokenListings.forEach((listing, index) => {
      message += `${index + 1}. ${listing}\n\n`;
    });
  } else {
    message += "No recent token listings found.\n\n";
  }

  message += "*Last 5 Liquidity Events:*\n\n";
  if (recentLiquidityEvents.length > 0) {
    recentLiquidityEvents.forEach((event, index) => {
      message += `${index + 1}. ${event}\n\n`;
    });
  } else {
    message += "No recent liquidity events found.\n\n";
  }

  ctx.reply(message, { parse_mode: "Markdown" });
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