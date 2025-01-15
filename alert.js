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

// Variables to store the most recent listings
let recentTokenListing = null;
let recentLiquidityEvent = null;

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
  
  const message = `
    *New Liquidity Event:*

    🪙 *Token Name:* ${name || "Unknown"} (${symbol || "Unknown"})
    💰 *Amount of SOL:* ${solAmount || "N/A"}
    🛠 *Initial Buy Amount:* ${initialBuy || "N/A"}
    📊 *Market Cap in SOL:* ${marketCapSol || "N/A"}

    🔗 *Transaction Type:* ${txType || "Unknown"}
    🧑‍💼 *Trader Public Key:* ${traderPublicKey || "Unknown"}

    🔑 *Mint Address:* ${mint || "Unknown"}
    🌐 *URI:* [Token Metadata](${uri || "#"})

    📊 *Liquidity in Bonding Curve:*
    - Tokens: ${vTokensInBondingCurve || "N/A"}
    - SOL: ${vSolInBondingCurve || "N/A"}

    🏊‍♂️ *Pool:* ${pool || "Unknown"}

    🔒 *Signature:* ${signature || "Unknown"}
  `;
  
  recentLiquidityEvent = message; // Store the most recent liquidity event
  sendTelegramNotification(message);
}

// Process new token listings from WebSocket event
function processNewToken(data) {
  const {
    name,
    symbol,
    marketCapSol,
    solAmount,
    initialBuy,
    uri,
    signature,
    mint,
  } = data;

  const message = `🎉 *New Token Created on PumpPortal!*\n\n` +
    `🪙 *Name*: ${name || "Unknown"}\n` +
    `💠 *Symbol*: ${symbol || "Unknown"}\n` +
    `💵 *Market Cap (in SOL)*: ${marketCapSol || "N/A"}\n` +
    `💰 *Initial Buy Amount*: ${initialBuy || "N/A"} SOL\n` +
    `🔗 *Token Mint*: [${mint}](https://solscan.io/address/${mint})\n` +
    `📜 *Transaction Signature*: [${signature}](https://solscan.io/tx/${signature})\n` +
    `🌐 *Token URI*: [View Metadata](${uri})\n`;

  // Save the most recent token listing
  recentTokenListing = message;
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

// Handle /list command to show most recent token or liquidity event
bot.command("list", (ctx) => {
  console.log("List command triggered!");

  if (recentTokenListing) {
    ctx.reply(`*Most Recent Token Listing:*\n\n${recentTokenListing}`, { parse_mode: "Markdown" });
  } else if (recentLiquidityEvent) {
    ctx.reply(`*Most Recent Liquidity Event:*\n\n${recentLiquidityEvent}`, { parse_mode: "Markdown" });
  } else {
    ctx.reply("No recent events found.", { parse_mode: "Markdown" });
  }
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