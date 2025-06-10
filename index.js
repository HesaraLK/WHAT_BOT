const venom = require('venom-bot');

async function startBot() {
  try {
    const client = await venom.create({
      session: 'bot-session', // Name the session
    });

    client.onMessage((message) => {
      if (message.body.toLowerCase() === 'hi' && !message.isGroupMsg) {
        client
          .sendText(message.from, 'Welcome to this bot!')
          .then((result) => console.log('Message sent:', result))
          .catch((error) => console.error('Send error:', error));
      }
    });
  } catch (error) {
    console.error('Failed to start bot:', error);
  }
}

startBot();
