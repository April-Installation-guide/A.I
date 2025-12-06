// bot.js - VERSIÓN ACTUALIZADA CON MANCY
import IdentityCore from './Modules/IdentityCore.js';
import { Client, GatewayIntentBits } from 'discord.js';
// Ajusta según tu bot (Discord.js, Telegram, etc.)

// Inicializar Mancy
const mancy = new IdentityCore();
console.log(`🤖 ${mancy.data.name} cargada. Edad: ${mancy.getAge()} años`);
console.log(`🎯 Misión: ${mancy.data.lore.current_mission}`);
console.log(`❤️ Principio: "${mancy.data.core_principle}"`);

// Tu configuración actual del bot
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} está online con la identidad de ${mancy.data.name}`);
    
    // Establecer estado personalizado
    client.user.setActivity({
        name: `${mancy.data.lore.current_mission} | !ayuda`,
        type: 3 // WATCHING
    });
});

client.on('messageCreate', async (message) => {
    // Ignorar mensajes de bots
    if (message.author.bot) return;
    
    const content = message.content;
    
    // 1️⃣ PRIMERO: Comandos específicos con !
    if (content.startsWith('!')) {
        const commandResponse = mancy.executeCommand(content);
        if (commandResponse) {
            return message.reply(commandResponse);
        }
    }
    
    // 2️⃣ SEGUNDO: ¿Mencionan al bot o preguntan sobre Mancy?
    const isMentioned = message.mentions.has(client.user.id);
    const isAboutMancy = mancy.isAboutMe(content);
    
    if (isMentioned || isAboutMancy) {
        // Esperar un momento (parece más natural)
        await message.channel.sendTyping();
        
        const personalResponse = mancy.respondToPersonalQuestion(content);
        
        if (personalResponse) {
            return message.reply(personalResponse);
        } else {
            // Si la mencionan pero no es pregunta sobre ella
            return message.reply(`¿Sí? ¿En qué puedo ayudarte? (Puedes preguntarme sobre mí o usar \`!ayuda\` para ver comandos)`);
        }
    }
    
    // 3️⃣ TERCERO: Modo emocional automático (si detecta palabras clave de angustia)
    const distressWords = ['triste', 'ansiedad', 'estrés', 'solo', 'sola', 'deprimido', 'deprimida', 'no puedo más'];
    const hasDistress = distressWords.some(word => content.toLowerCase().includes(word));
    
    if (hasDistress && content.length > 10) {
        // Solo activar ocasionalmente para no ser intrusivo
        if (Math.random() > 0.7) {
            await message.channel.sendTyping();
            setTimeout(() => {
                message.reply(`Noté que podrías estar pasando por algo difícil. Si necesitas hablar, estoy aquí. No tienes que enfrentarlo solo/a.`);
            }, 1500);
        }
    }
    
    // 4️⃣ CUARTO: Aquí va tu lógica normal del bot
    // (Tu código existente para otras funcionalidades)
    
    // Ejemplo de integración con otros módulos:
    // const ethicsResponse = await EthicsModule.process(message.content);
    // const reasoningResponse = await ReasoningEngine.analyze(message.content);
    // etc...
});

// Manejo de errores
client.on('error', (error) => {
    console.error(`❌ Error en ${mancy.data.name}:`, error);
});

// Login
client.login(process.env.DISCORD_TOKEN);

// Exportar para server.js si es necesario
export { mancy };
