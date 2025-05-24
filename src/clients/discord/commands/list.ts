import { CommandDefinition } from '../types.js';
import { EmbedBuilder } from 'discord.js';
import { getTakenScheduleDates } from '../../../utils/schedule-date/index.js';

const command: CommandDefinition = {
  name: 'list',
  description: 'List all scheduled posts',
  usage: '/list',
  execute: async ({ message, client }) => {
    try {
      // Fetch scheduled posts (grouped by priority)
      const config = {};
      const takenScheduleDates = await getTakenScheduleDates(config);
      let hasPosts = false;
      const embed = new EmbedBuilder()
        .setTitle('Scheduled Posts')
        .setColor('#0099ff')
        .setDescription('Here are all scheduled posts by priority:');

      for (const [priority, dates] of Object.entries(takenScheduleDates)) {
        if (dates.length > 0) {
          hasPosts = true;
          const formattedDates = dates
            .map((date, idx) => `#${idx + 1}: ${new Date(date).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })}`)
            .join('\n');
          embed.addFields({ name: `Priority: ${priority.toUpperCase()}`, value: formattedDates });
        }
      }

      if (!hasPosts) {
        embed.setDescription('No scheduled posts found.');
      }

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching scheduled posts:', error);
      await message.reply('There was an error fetching the scheduled posts.');
    }
  }
};

export default command; 