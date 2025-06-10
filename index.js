const venom = require('venom-bot');

async function startBot() {
  try {
    const client = await venom.create({
      session: 'bot-session',
      multidevice: true, // Recommended for multi-device support
      disableWelcome: true, // Prevents default venom logs
      logQR: true, // Logs QR in terminal
    });

    console.log('✅ Bot started successfully.');

    // Listen for incoming messages
    client.onMessage(async (message) => {
      if (!message.isGroupMsg && message.body.toLowerCase() === 'hi') {
        try {
          await client.sendText(message.from, '👋 Welcome to this bot!');
          console.log(`Message sent to ${message.from}`);
        } catch (err) {
          console.error('❌ Error sending message:', err);
        }
      }
    });

    // Optional: listen for state changes
    client.onStateChange((state) => {
      console.log('🔄 State changed:', state);
      if (['CONFLICT', 'UNLAUNCHED'].includes(state)) {
        client.useHere();
      }
    });

  } catch (error) {
    console.error('❌ Failed to start bot:', error);
  }
}

startBot();
