function getTelegramConfig() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    return null;
  }

  return { botToken, chatId };
}

export async function sendTelegramMessage(text: string) {
  const config = getTelegramConfig();

  if (!config) {
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: config.chatId,
        text
      })
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("Telegram send failed", body);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Telegram send failed", error);
    return false;
  }
}
