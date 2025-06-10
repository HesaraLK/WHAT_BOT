const mega = require("megajs");
const { Readable } = require("stream");

const auth = {
  email: process.env.MEGA_EMAIL || "megaekata@gmail.com",
  password: process.env.MEGA_PASSWORD || "mamamekahaduwemegaekata",
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
};

/**
 * Upload a file to MEGA
 * @param {ReadableStream|Buffer|string} data - File content
 * @param {string} name - File name to save on MEGA
 * @returns {Promise<string>} - Public URL of uploaded file
 */
const upload = (data, name) => {
  return new Promise((resolve, reject) => {
    const storage = new mega.Storage(auth);

    storage.on("ready", () => {
      const uploadStream = storage.upload({ name });

      uploadStream.on("complete", (file) => {
        file.link((err, url) => {
          storage.close(); // Close either way
          if (err) return reject(err);
          resolve(url);
        });
      });

      uploadStream.on("error", (err) => {
        storage.close();
        reject(err);
      });

      // Convert Buffer or string to stream
      if (Buffer.isBuffer(data) || typeof data === "string") {
        const stream = Readable.from(data);
        stream.pipe(uploadStream);
      } else if (data.pipe && typeof data.pipe === "function") {
        // It's a stream
        data.pipe(uploadStream);
      } else {
        reject(new Error("Invalid data format: must be Buffer, string, or stream"));
      }
    });

    storage.on("error", (err) => {
      storage.close();
      reject(err);
    });
  });
};

module.exports = { upload };
