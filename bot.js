// bot.js

import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from 'dotenv';
// Importación crucial con la nueva ruta
import { MANCY_CONFIG, SYSTEM_CONSTANTS } from './src/config/constants.js'; 

dotenv.config();

// =================================================================
// ========== ESTADO Y CONFIGURACIÓN ==========
// =================================================================

if (!process.env.GROQ_API_KEY) {
    console.error("❌ ERROR: La variable GROQ_API_KEY no está definida.");
}
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

let discordClient = null;
export let botActive = false;
export let isStartingUp = false;
let startAttempts = 0;


/**
 * Llama a la API de Groq y fuerza la salida JSON.
 */
async function getGroqResponse(systemPrompt, userPrompt, temperature, maxTokens) {
    const jsonSchema = MANCY_CONFIG.OUTPUT_SCHEMA;
    const groqSystemPrompt = `${systemPrompt}\n\n
INSTRUCCIÓN CRÍTICA: Debes responder **ÚNICAMENTE** con un objeto JSON válido que siga **EXACTAMENTE** el siguiente esquema. No añadas texto explicativo.
ESQUEMA JSON REQUERIDO: ${JSON.stringify(jsonSchema, null, 2)}
`;
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [{ role: "system", content: groqSystemPrompt }, { role: "user", content: userPrompt }],
            model: MANCY_CONFIG.MODEL.name, temperature: temperature, max_tokens: maxTokens,
        });
        const rawContent = chatCompletion.choices[0].message.content.trim();
        return JSON.parse(rawContent);
    } catch (error) {
        console.error("❌ Error en getGroqResponse o al parsear JSON:", error.message);
        return MANCY_CONFIG.FALLBACK_RESPONSE;
    }
}

// =================================================================
// ========== LÓGICA DE INICIO DEL BOT ==========
// =================================================================

export function initializeAndStartBot() {
    if (discordClient) discordClient.destroy();
    
    discordClient = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
    });
    startDiscordBot(); 
}

async function startDiscordBot() {
    if (!process.env.DISCORD_TOKEN) { console.error("❌ ERROR: DISCORD_TOKEN no está definido."); isStartingUp = false; return; }
    if (startAttempts >= SYSTEM_CONSTANTS.MAX_START_ATTEMPTS) { console.error("❌ Error: Máximo de intentos de inicio alcanzado."); isStartingUp = false; return; }
    
    isStartingUp = true;
    startAttempts++;

    try {
        await discordClient.login(process.env.DISCORD_TOKEN);
        
        discordClient.once('ready', () => {
            console.log(`🤖 Bot de Discord conectado como ${discordClient.user.tag}`);
            botActive = true;
            isStartingUp = false;
            startAttempts = 0;
        });
        
        discordClient.on('messageCreate', handleDiscordMessage);

    } catch (error) {
        console.error(`❌ Intento ${startAttempts} fallido. Reintentando en 5s...`, error);
        isStartingUp = false;
        setTimeout(startDiscordBot, 5000);
    }
}

// =================================================================
// ========== MANEJADOR DE MENSAJES (Sin Memoria) ==========
// =================================================================

async function handleDiscordMessage(message) {
    if (message.author.bot) return;

    const isDirectMessage = message.channel.type === 1; 
    const isMention = message.mentions.users.has(discordClient.user.id);
    
    if (!isDirectMessage && !isMention) return;

    let userMessage = message.content.replace(new RegExp(`<@!?${discordClient.user.id}>`), '').trim();
    if (!userMessage) return;

    try {
        await message.channel.sendTyping(); 
        
        // 1. Usa solo la identidad base como System Prompt (Sin contexto de conversación)
        const systemPrompt = MANCY_CONFIG.IDENTITY; 
        
        // 2. Llama a la IA
        const mancyResponseObject = await getGroqResponse(
            systemPrompt, userMessage, MANCY_CONFIG.MODEL.temperature, MANCY_CONFIG.MODEL.max_tokens
        );
        
        // 3. Responde
        await message.reply(mancyResponseObject.respuesta_discord);

    } catch (error) {
        console.error(`❌ Error en el manejador de mensajes:`, error);
        message.reply(MANCY_CONFIG.FALLBACK_RESPONSE.respuesta_discord);
    }
}

// =================================================================
// ========== UTILITIES (Exportados para server.js) ==========
// =================================================================

export function getBotStatus() {
    return {
        bot_active: botActive,
        starting_up: isStartingUp,
        startAttempts: startAttempts,
        maxAttempts: SYSTEM_CONSTANTS.MAX_START_ATTEMPTS,
        capabilities: MANCY_CONFIG.CAPABILITIES,
        version: MANCY_CONFIG.VERSION
    };
}
