export const menuMarkup = async () => {
  return {
    message: `<b>Main Menu ☰</b>`,
    keyboard: [
      [
        {
          text: 'watch channel 👀',
          callback_data: JSON.stringify({
            command: '/watchChannel',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: 'view Channels 📺',
          callback_data: JSON.stringify({
            command: '/viewChannels',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: 'Cancel all active sessions ❌',
          callback_data: JSON.stringify({
            command: '/cancel',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: '❌ Close',
          callback_data: JSON.stringify({
            command: '/close',
            language: 'english',
          }),
        },
      ],
    ],
  };
};
