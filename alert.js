const express = require("express");
const axios = require("axios"); // To make API requests
const { Telegraf } = require("telegraf");
const { config } = require("dotenv");

config();

const PORT = process.env.PORT || 8080;
const TELEGRAM_WEBHOOK_URL = process.env.WEBHOOK_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SOLSCAN_API_KEY = process.env.SOLSCAN_API_KEY;
const SOLSCAN_API_URL = "https://api.solscan.io/transaction/latest";

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

// Function to fetch token stats
async function getTokenStats(tokenMintAddress) {
  try {
    const response = await axios.get(`https://api.solscan.io/token/meta?tokenAddress=${tokenMintAddress}`, {
      headers: { token: SOLSCAN_API_KEY },
    });
    const data = response.data?.data;

    if (data) {
      return {
        name: data.name || "Unknown Token",
        ticker: data.symbol || "N/A",
        supply: data.supply || "N/A",
        price: `$${data.priceUsd?.toFixed(2) || "N/A"}`,
        holders: data.holders || "N/A",
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching token stats:", error);
    return null;
  }
}

// Function to monitor for new transactions
async function monitorNewTransactions() {
  try {
    const response = await axios.get(SOLSCAN_API_URL, {
      headers: { token: SOLSCAN_API_KEY },
    });

    const transactions = response.data?.data || [];
    for (const tx of transactions) {
      if (tx?.logMessage?.some((log) => log.includes("InitializeMint"))) {
        console.log(`New token detected in transaction: ${tx.txHash}`);

        const tokenMintAddress = tx.tokenAddress; // Adjust based on API response
        const stats = await getTokenStats(tokenMintAddress);

        if (stats) {
          const message = `🎉 *New Meme Coin Detected!*\n\n` +
            `🪙 *Name*: ${stats.name}\n` +
            `💠 *Ticker*: ${stats.ticker}\n` +
            `💵 *Price*: ${stats.price}\n` +
            `📦 *Supply*: ${stats.supply}\n` +
            `👥 *Holders*: ${stats.holders}\n\n` +
            `🔗 *Contract Address*: \`${tokenMintAddress}\`\n` +
            `📜 [View Transaction](https://solscan.io/tx/${tx.txHash})\n`;

          await sendTelegramNotification(message);
        }
      }
    }
  } catch (error) {
    console.error("Error monitoring transactions:", error);
  }
}

// Telegram bot commands
bot.start((ctx) => {
  console.log(ctx.from);
  bot.telegram.sendMessage(ctx.chat.id, "Welcome to the Meme Coin Tracker Bot! 🚀\nI'll notify you about new meme coins launched on the Solana blockchain.", { parse_mode: "Markdown" });
});

bot.command("status", (ctx) => {
  bot.telegram.sendMessage(ctx.chat.id, "Bot is active! ✅\nConnected to the Solana blockchain and monitoring for meme coins.", { parse_mode: "Markdown" });
});

bot.command("help", (ctx) => {
  bot.telegram.sendMessage(ctx.chat.id, "Available commands:\n/start - Start the bot\n/status - Check bot status\n/help - Get help.", { parse_mode: "Markdown" });
});

// Webhook endpoint for Telegram updates
app.get('/', (req, res) => {
  res.send("Bot is running");
  console.log("Health check: Bot is up");
});

app.use("/webhook", bot.webhookCallback("/webhook"));

// Start monitoring transactions periodically
setInterval(monitorNewTransactions, 60000); // Poll every 60 seconds

// Start the Express server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Set Telegram webhook URL
  try {
    await bot.telegram.setWebhook(`${TELEGRAM_WEBHOOK_URL}/webhook`);
    console.log("Telegram webhook set successfully!");
  } catch (error) {
    console.error("Error setting webhook:", error);
  }
});
