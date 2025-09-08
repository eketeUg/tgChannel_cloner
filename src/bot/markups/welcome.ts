export const welcomeMessageMarkup = async (userName: string) => {
  return {
    message: `<b>Hello ${userName}</b>\n\nI am just a bot, that can clone posts from one channel to another`,

    keyboard: [
      [
        {
          text: 'Menu ☰',
          callback_data: JSON.stringify({
            command: '/menu',
            language: 'english',
          }),
        },
      ],
    ],
  };
};
