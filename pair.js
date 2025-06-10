const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const { upload } = require("./mega");

const router = express.Router();

const MAX_RETRIES = 5;

router.get("/", async (req, res) => {
  const num = req.query.number;
  if (!num) return res.status(400).send({ error: "Missing number param" });

  let retryCount = 0;
  let qrSent = false;

  async function RobinPair() {
    try {
      const { state, saveCreds } = await useMultiFileAuthState("./session");

      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: Browsers.macOS("Safari"),
      });

      // Save credentials when updated
      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, qr, lastDisconnect } = update;

        // Send QR code back to HTTP client for scanning
        if (qr && !qrSent && !res.headersSent) {
          qrSent = true;
          return res.send({ qr });
        }

        if (connection === "open") {
          console.log("✅ Connected to WhatsApp");

          try {
            await delay(2000);

            const authPath = "./session/";
            const userJid = jidNormalizedUser(sock.user.id);

            // Generate random id for filename
            function randomMegaId(length = 6, numberLength = 4) {
              const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
              let id = "";
              for (let i = 0; i < length; i++)
                id += chars.charAt(Math.floor(Math.random() * chars.length));
              const numPart = Math.floor(Math.random() * 10 ** numberLength);
              return id + numPart;
            }

            // Upload creds.json to Mega
            const megaUrl = await upload(
              fs.createReadStream(authPath + "creds.json"),
              `${randomMegaId()}.json`
            );
            const stringSession = megaUrl.replace("https://mega.nz/file/", "");

            const sidMessage = `*HESARAYA [The powerful WA BOT]*\n\n👉 ${stringSession} 👈\n\n*This is your Session ID, copy this id and paste into config.js file*\n\n*You can ask any question using this link*\n\n*wa.me/message/WKGLBR2PCETWD1*\n\n*You can join my whatsapp group*\n\n*https://chat.whatsapp.com/GAOhr0qNK7KEvJwbenGivZ*`;
            const warningMessage = `🛑 *Do not share this code with anyone* 🛑`;

            await sock.sendMessage(userJid, {
              image: { url: "https://i.pinimg.com/736x/d9/4f/60/d94f609478a2e0fc32af9d9e5ca129a4.jpg" },
              caption: sidMessage,
            });
            await sock.sendMessage(userJid, { text: stringSession });
            await sock.sendMessage(userJid, { text: warningMessage });
          } catch (e) {
            console.error("Error sending messages:", e);
            exec("pm2 restart prabath"); // You might want to adjust this name
          }
        }

        if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output?.statusCode !== 401
        ) {
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            console.log(`Connection closed. Retry attempt ${retryCount}...`);
            await delay(10000);
            await RobinPair();
          } else {
            console.error("Max retries reached. Stopping reconnection attempts.");
            if (!res.headersSent) {
              res.status(500).send({ error: "Max retries reached. Could not connect." });
            }
          }
        }
      });
    } catch (err) {
      console.error("Error in RobinPair function:", err);
      exec("pm2 restart Robin-md"); // Adjust as needed
      if (!res.headersSent) {
        res.status(500).send({ error: "Service Unavailable" });
      }
    }
  }

  await RobinPair();
});

// Global error catcher
process.on("uncaughtException", (err) => {
  console.error("Caught exception: ", err);
  exec("pm2 restart Robin"); // Adjust as needed
});

module.exports = router;
