const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
let router = express.Router();
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

function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
}

const MAX_RETRIES = 5;

router.get("/", async (req, res) => {
  let num = req.query.number;
  let retryCount = 0;

  async function RobinPair() {
    const { state, saveCreds } = await useMultiFileAuthState(`./session`);

    try {
      let sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: "fatal" }).child({ level: "fatal" })
          ),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        browser: Browsers.macOS("Safari"),
      });

      if (!sock.authState.creds.registered) {
        await delay(1500);
        const cleanNum = num.replace(/\D/g, "");
        const code = await sock.requestPairingCode(cleanNum);
        if (!res.headersSent) {
          res.send({ code });
        }
      }

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
          try {
            await delay(10000);

            const authPath = "./session/";
            const userJid = jidNormalizedUser(sock.user.id);

            function randomMegaId(length = 6, numberLength = 4) {
              const chars =
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
              let id = "";
              for (let i = 0; i < length; i++)
                id += chars.charAt(Math.floor(Math.random() * chars.length));
              const numPart = Math.floor(Math.random() * 10 ** numberLength);
              return id + numPart;
            }

            const megaUrl = await upload(
              fs.createReadStream(authPath + "creds.json"),
              `${randomMegaId()}.json`
            );
            const stringSession = megaUrl.replace("https://mega.nz/file/", "");

            const sid = `*HESARAYA [The powerful WA BOT]*\n\n👉 ${stringSession} 👈\n\n*This is your Session ID, copy this id and paste into config.js file*\n\n*You can ask any question using this link*\n\n*wa.me/message/WKGLBR2PCETWD1*\n\n*You can join my whatsapp group*\n\n*https://chat.whatsapp.com/GAOhr0qNK7KEvJwbenGivZ*`;
            const warning = `🛑 *Do not share this code with anyone* 🛑`;

            await sock.sendMessage(userJid, {
              image: {
                url: "https://i.pinimg.com/736x/d9/4f/60/d94f609478a2e0fc32af9d9e5ca129a4.jpg",
              },
              caption: sid,
            });
            await sock.sendMessage(userJid, { text: stringSession });
            await sock.sendMessage(userJid, { text: warning });
          } catch (e) {
            console.error("Error sending messages:", e);
            exec("pm2 restart prabath");
          }

          await delay(100);
          await removeFile("./session");
          // Do not exit process to keep server running
        } else if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode !== 401
        ) {
          retryCount++;
          if (retryCount <= MAX_RETRIES) {
            console.log(`Connection closed. Retry attempt ${retryCount}...`);
            await delay(10000);
            RobinPair();
          } else {
            console.error("Max retries reached. Stopping reconnection attempts.");
          }
        }
      });
    } catch (err) {
      console.error("Error in RobinPair function:", err);
      exec("pm2 restart Robin-md");
      await removeFile("./session");
      if (!res.headersSent) {
        res.send({ code: "Service Unavailable" });
      }
      // Optional: You can retry here if needed
    }
  }

  return await RobinPair();
});

process.on("uncaughtException", function (err) {
  console.error("Caught exception: ", err);
  exec("pm2 restart Robin");
});

module.exports = router;
