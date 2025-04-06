import { CommandDefinition } from '../types.js';
import { EmbedBuilder } from 'discord.js';

const command: CommandDefinition = {
  name: 'help',
  description: 'Shows help information and available commands',
  usage: '!help [command]',
  execute: async ({ message, args, client }) => {
    const commands = (client as any).commands;
    
    // If a specific command was requested
    if (args.length > 0) {
      const commandName = args[0].toLowerCase();
      const command = commands.get(commandName);
      
      if (!command) {
        return message.reply(`Command "${commandName}" not found`);
      }
      
      const embed = new EmbedBuilder()
        .setTitle(`Command: ${command.name}`)
        .setColor('#0099ff')
        .setDescription(command.description)
        .addFields(
          { name: 'Usage', value: command.usage }
        );
      
      return message.reply({ embeds: [embed] });
    }
    
    // Show general help with all commands
    const embed = new EmbedBuilder()
      .setTitle('Social Media Agent - Help')
      .setColor('#0099ff')
      .setDescription('Here are all available commands:')
      .setFooter({ text: 'Use !help [command] for more details about a specific command' });
    
    // Add commands to the embed
    if (commands) {
      commands.forEach((cmd: CommandDefinition) => {
        embed.addFields({ name: `!${cmd.name}`, value: cmd.description });
      });
    } else {
      embed.setDescription('No commands available yet.');
    }
    
    return message.reply({ embeds: [embed] });
  }
};

export default command; 