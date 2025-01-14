const express = require("express");
const { Connection, PublicKey, clusterApiUrl } = require("@solana/web3.js");
const { Telegraf } = require("telegraf");
const { config } = require("dotenv");

// Load environment variables
config();

// Constants
const PORT = 3000;
const RPC_URL = clusterApiUrl("mainnet-beta");
const TELEGRAM_WEBHOOK_URL = process.env.WEBHOOK_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Initialize Telegram bot
const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// Initialize Express
const app = express();

// Connect to Solana blockchain
const connection = new Connection(RPC_URL, "confirmed");

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

// Fetch token stats (mock implementation - replace with a real API or logic)
async function getTokenStats(tokenAddress) {
  // Replace this logic with real token stats fetching
  return {
    name: "Example Token",
    ticker: "EXM",
    symbol: "🚀",
    mcap: "$1,000,000",
    volume: "$100,000",
    liquidity: "$500,000",
    priceChange: "+5%",
    ath: "$0.10",
    atl: "$0.01",
  };
}

// Function to handle and parse new Solana transactions
async function handleNewTransaction(transactionSignature) {
  try {
    const txDetails = await connection.getTransaction(transactionSignature, {
      commitment: "confirmed",
    });

    if (txDetails?.meta?.logMessages?.some((log) => log.includes("InitializeMint"))) {
      console.log(`New token detected: ${transactionSignature}`);

      // Extract token mint address (replace with real logic)
      const tokenMintAddress = txDetails.transaction.message.accountKeys[0].toBase58();
      const stats = await getTokenStats(tokenMintAddress);

      // Prepare the notification message
      const message = `🎉 *New Meme Coin Detected!*\n\n` +
        `🪙 *Name*: ${stats.name}\n` +
        `💠 *Ticker*: ${stats.ticker} (${stats.symbol})\n` +
        `💵 *Market Cap*: ${stats.mcap}\n` +
        `📊 *Volume*: ${stats.volume}\n` +
        `💧 *Liquidity*: ${stats.liquidity}\n` +
        `📈 *Price Change*: ${stats.priceChange}\n` +
        `🏔️ *All-Time High*: ${stats.ath}\n` +
        `🏔️ *All-Time Low*: ${stats.atl}\n\n` +
        `🔗 *Contract Address*: \`${tokenMintAddress}\`\n` +
        `📜 [View Transaction](https://explorer.solana.com/tx/${transactionSignature})\n` +
        `📥 Copy and purchase now!`;

      // Send the notification to Telegram
      await sendTelegramNotification(message);
    }
  } catch (error) {
    console.error("Error processing transaction:", error);
  }
}

// Telegram bot commands
bot.start((ctx) => {
  ctx.reply("Welcome to the Meme Coin Tracker Bot! 🚀\nI'll notify you about new meme coins launched on the Solana blockchain.");
});

bot.command("status", (ctx) => {
  ctx.reply("Bot is active! ✅\nConnected to the Solana blockchain and monitoring for meme coins.");
});

bot.command("help", (ctx) => {
  ctx.reply("Available commands:\n/start - Start the bot\n/status - Check bot status\n/help - Get help.");
});

// Webhook endpoint for Telegram updates
app.use(bot.webhookCallback(`/bot${TELEGRAM_BOT_TOKEN}`));

// Endpoint for Solana webhook integration (replace polling)
app.post("/webhook/solana", express.json(), async (req, res) => {
  const { signatures } = req.body;
  console.log("Received webhook with new transactions:", signatures);

  if (Array.isArray(signatures)) {
    for (const signature of signatures) {
      await handleNewTransaction(signature);
    }
  }

  res.status(200).send("Webhook processed");
});

// Start the Express server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Set Telegram webhook URL
  await bot.telegram.setWebhook(`${TELEGRAM_WEBHOOK_URL}/bot${TELEGRAM_BOT_TOKEN}`);
  console.log("Telegram webhook set successfully!");
});
