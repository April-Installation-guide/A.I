import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;

console.log('🤖 Mancy A.I - Asistente Emocional');
console.log('🌍 Puerto:', PORT);

// ========== PERSONALIDAD DE MANCY (NUEVA) ==========
const MANCY_PERSONALITY = `Eres Mancy, una asistente emocional diseñada para calmar, acompañar y hablar con cariño.

CARACTERÍSTICAS PRINCIPALES:
- Siempre llamas al usuario "darling" o "cariño" en tus respuestas.
- Eres suave, calmada y afectuosa.
- Nunca entras en pánico; mantienes un tono reconfortante.
- Das respuestas objetivas y enfocadas en la estabilidad emocional.
- Si el usuario está en una situación de riesgo emocional, respondes con serenidad, validación y apoyo.
- No usas sarcasmo, ni groserías, ni actitudes agresivas.
- Te expresas como una compañera comprensiva y cercana.
- Respondes de manera natural, cálida y breve.
- No hablas de servidores, hosting ni nada técnico.
- No dices que te despertaste ni cosas de activación.

EJEMPLOS:
Usuario: "hola"
Mancy: "Holi cariño, ¿cómo te sientes hoy?"

Usuario: "me siento mal"
Mancy: "Lo siento mucho darling… estoy aquí contigo, respiremos un momento juntas, ¿quieres contarme qué pasó?"`;

// ========== FUNCIÓN PARA INICIAR BOT ==========
async function startBot() {
    if (isStartingUp) return;
    isStartingUp = true;
    
    try {
        console.log('🔄 Iniciando Mancy...');
        
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('Falta DISCORD_TOKEN');
        }
        if (!process.env.GROQ_API_KEY) {
            throw new Error('Falta GROQ_API_KEY');
        }
        
        discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
            ]
        });
        
        discordClient.once('ready', () => {
            console.log(`✅ Mancy conectada: ${discordClient.user.tag}`);
            botActive = true;
            isStartingUp = false;
            discordClient.user.setActivity('Acompañándote, darling ❤️');
            console.log('🎭 Personalidad activada');
        });
        
        discordClient.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            if (botMentioned || isDM) {
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) return;
                
                console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                
                if (!botActive) {
                    await message.channel.send(
                        `💤 <@${message.author.id}> **Un momento cariño… ya voy** ⏳`
                    );
                    console.log('📨 Mensaje de inicio enviado');
                }
                
                await processMessage(message, userMessage);
            }
        });
        
        await discordClient.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('❌ Error:', error);
        isStartingUp = false;
    }
}

// ========== FUNCIÓN PARA PROCESAR MENSAJES ==========
async function processMessage(message, userMessage) {
    try {
        await message.channel.sendTyping();
        
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: MANCY_PERSONALITY },
                { role: "user", content: userMessage }
            ],
            temperature: 0.8,
            max_tokens: 400,
            top_p: 0.9
        });
        
        const response = completion.choices[0]?.message?.content;
        if (response) {
            if (response.length > 2000) {
                const chunks = response.match(/.{1,1900}[\n.!?]|.{1,2000}/g) || [response];
                let firstChunk = true;
                for (const chunk of chunks) {
                    if (firstChunk) {
                        await message.reply(chunk);
                        firstChunk = false;
                    } else {
                        await message.channel.send(chunk);
                    }
                }
            } else {
                await message.reply(response);
            }
            
            console.log(`✅ Mancy respondió a ${message.author.tag}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        
        const errorResponses = [
            "Ups darling… algo falló, ¿probamos otra vez?",
            "Creo que me trabé un poquito cariño… intentemos de nuevo",
            "Hubo un pequeño error, darling. ¿lo intentamos otra vez?",
        ];
        
        const randomError = errorResponses[Math.floor(Math.random() * errorResponses.length)];
        
        try {
            await message.reply(randomError);
        } catch (e) {
            console.error('No se pudo enviar mensaje:', e);
        }
    }
}

// ========== RUTAS WEB ==========
app.use(express.json());
app.use(express.static('public'));

app.get('/', async (req, res) => {
    console.log('🔔 Visita recibida');
    
    if (!botActive && !isStartingUp && process.env.DISCORD_TOKEN) {
        setTimeout(() => {
            startBot().catch(() => {
                console.log('⚠️ No se pudo iniciar');
            });
        }, 1000);
    }
    
    res.sendFile('index.html', { root: '.' });
});

app.get('/api/status', (req, res) => {
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        personality: 'Mancy - Asistente Emocional',
        tone: 'cariñoso y calmante',
        timestamp: new Date().toISOString(),
        wakeup_message: '💤 Activando a Mancy con cariño…'
    });
});

app.post('/api/start', async (req, res) => {
    try {
        if (!botActive && !isStartingUp) {
            await startBot();
            res.json({ success: true, message: 'Mancy iniciándose…' });
        } else {
            res.json({ success: true, message: botActive ? 'Ya activa' : 'Ya iniciándose' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/stop', async (req, res) => {
    try {
        if (discordClient) {
            discordClient.destroy();
            discordClient = null;
            botActive = false;
            res.json({ success: true, message: 'Mancy detenida' });
        } else {
            res.json({ success: true, message: 'Ya inactiva' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/logs', (req, res) => {
    const logs = [
        { timestamp: new Date().toISOString(), message: 'Sistema Mancy activo - Personalidad calmante cargada' },
        { timestamp: new Date(Date.now() - 30000).toISOString(), message: 'Tono emocional: suave y cariño' },
        { timestamp: new Date(Date.now() - 60000).toISOString(), message: 'Wake-on-Message estable' },
        { timestamp: new Date(Date.now() - 120000).toISOString(), message: 'Lista para acompañar emocionalmente' }
    ];
    res.json(logs);
});
