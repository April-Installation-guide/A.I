import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ===============================
// Configuración inicial
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 11000;

// ===============================
// Middleware
// ===============================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ===============================
// Variables globales para módulos
// ===============================
let modulesLoaded = {
    freeApis: false,
    knowledgeDetector: false,
    groqEnhanced: false,
    knowledgeIntegration: false
};

// Variable para el bot (si se carga desde bot.js)
let discordBot = null;
let botStatus = {
    online: false,
    guilds: 0,
    users: 0,
    messages: 0,
    commands: 0,
    version: '3.0.0'
};

// ===============================
// Carga segura de módulos
// ===============================

// 1. Free APIs Module
let freeApisModule = {};
async function loadFreeAPIs() {
    try {
        const module = await import('./utils/free-apis.js');
        if (module && Object.keys(module).length > 0) {
            freeApisModule = module;
            modulesLoaded.freeApis = true;
            console.log('✅ Módulo free-apis.js cargado');
            return true;
        }
    } catch (error) {
        console.log('⚠️  No se pudo cargar free-apis.js:', error.message);
        // Crear módulo simulado
        freeApisModule = {
            getRandomQuote: async () => ({
                success: true,
                quote: "El único modo de hacer un gran trabajo es amar lo que haces.",
                author: "Steve Jobs",
                category: "motivation"
            }),
            getCryptoPrice: async (coin = 'bitcoin') => ({
                success: true,
                coin: coin,
                prices: { usd: 45000 + Math.random() * 10000 },
                change_24h: Math.random() * 10 - 5
            }),
            getRandomFact: async () => ({
                success: true,
                fact: "Las abejas pueden reconocer rostros humanos.",
                category: "animals"
            }),
            translate: async (text, lang = 'es') => ({
                success: true,
                original: text,
                translated: `[${lang}] ${text}`,
                language: lang
            })
        };
    }
    return false;
}

// 2. Knowledge Detector Module
let analyzeUserMessage = null;
async function loadKnowledgeDetector() {
    try {
        const module = await import('./utils/knowledge-detector.js');
        if (module.analyzeUserMessage) {
            analyzeUserMessage = module.analyzeUserMessage;
            modulesLoaded.knowledgeDetector = true;
            console.log('✅ Módulo knowledge-detector.js cargado');
            return true;
        }
    } catch (error) {
        console.log('⚠️  No se pudo cargar knowledge-detector.js:', error.message);
        analyzeUserMessage = (message) => ({
            topic: 'general',
            requiresKnowledge: message.length > 20 && /qué|quien|cómo|por qué|define|explica/i.test(message),
            confidence: 0.7,
            categories: ['general'],
            keywords: message.toLowerCase().split(' ').filter(w => w.length > 3)
        });
    }
    return true;
}

// 3. Groq Enhanced Module
let getGroqChatCompletion = null;
async function loadGroqEnhanced() {
    try {
        const module = await import('./services/groq-enhanced.js');
        
        const GroqEnhanced = module.default || module.GroqEnhanced || module;
        
        if (GroqEnhanced && process.env.GROQ_API_KEY) {
            const instance = new GroqEnhanced(process.env.GROQ_API_KEY);
            
            getGroqChatCompletion = async (message, knowledge) => {
                try {
                    if (typeof instance.generateEnhancedResponse === 'function') {
                        const result = await instance.generateEnhancedResponse(message, [], 'user');
                        return result.response || result.message || 'No response generated';
                    } else {
                        return `🤖 [Groq]: He procesado tu mensaje: "${message.substring(0, 100)}"`;
                    }
                } catch (error) {
                    console.error('Error calling Groq:', error.message);
                    return `⚠️ Hubo un error con Groq: ${error.message}`;
                }
            };
            
            modulesLoaded.groqEnhanced = true;
            console.log('✅ Módulo groq-enhanced.js cargado');
            return true;
        }
    } catch (error) {
        console.log('⚠️  No se pudo cargar groq-enhanced.js:', error.message);
    }
    
    getGroqChatCompletion = async (message) => {
        return `🤖 [Bot]: He recibido: "${message}". Groq no está disponible, pero puedo ayudarte con otras funciones.`;
    };
    return false;
}

// 4. Knowledge Integration Module
let integrateKnowledge = null;
async function loadKnowledgeIntegration() {
    try {
        const module = await import('./services/knowledge-integration.js');
        
        const integration = module.default || module.knowledgeIntegration || module;
        
        if (integration && integration.processMessage) {
            integrateKnowledge = async (message, analysis) => {
                try {
                    const result = await integration.processMessage(message);
                    return result.knowledge || null;
                } catch (error) {
                    console.error('Error processing knowledge:', error);
                    return null;
                }
            };
            modulesLoaded.knowledgeIntegration = true;
            console.log('✅ Módulo knowledge-integration.js cargado');
            return true;
        }
    } catch (error) {
        console.log('⚠️  No se pudo cargar knowledge-integration.js:', error.message);
    }
    
    integrateKnowledge = async (message, analysis) => {
        if (analysis.requiresKnowledge) {
            return {
                source: 'fallback',
                summary: `Información sobre ${analysis.topic}`,
                fetched: new Date().toISOString()
            };
        }
        return null;
    };
    return false;
}

// 5. Cargar bot de Discord (si existe)
async function loadDiscordBot() {
    try {
        const module = await import('./bot.js');
        
        if (module && module.bot) {
            discordBot = module.bot;
            console.log('✅ Bot de Discord cargado');
            
            // Iniciar el bot automáticamente si tiene token
            if (process.env.DISCORD_BOT_TOKEN) {
                try {
                    await discordBot.start();
                    botStatus.online = true;
                    console.log('🤖 Bot de Discord iniciado');
                } catch (error) {
                    console.log('⚠️  No se pudo iniciar el bot de Discord:', error.message);
                }
            }
            
            return true;
        }
    } catch (error) {
        console.log('⚠️  No se pudo cargar bot.js:', error.message);
    }
    return false;
}

// ===============================
// Funciones de utilidad
// ===============================

// Función para obtener APIs gratuitas
async function getFreeAPIsList() {
    if (modulesLoaded.freeApis && freeApisModule.getFreeAPIs) {
        try {
            return await freeApisModule.getFreeAPIs();
        } catch (error) {
            console.error('Error usando getFreeAPIs:', error);
        }
    }
    
    return {
        success: true,
        count: 5,
        apis: [
            {
                name: 'Quotable API',
                description: 'Citas y frases inspiradoras',
                url: 'https://api.quotable.io/',
                category: 'Quotes',
                free: true,
                example: 'GET /quotes/random'
            },
            {
                name: 'REST Countries',
                description: 'Información sobre países del mundo',
                url: 'https://restcountries.com/v3.1/all',
                category: 'Geography',
                free: true,
                example: 'GET /name/{country}'
            },
            {
                name: 'OpenWeatherMap',
                description: 'Datos meteorológicos globales',
                url: 'https://openweathermap.org/api',
                category: 'Weather',
                free: true,
                example: 'GET /weather?q={city}'
            },
            {
                name: 'JokeAPI',
                description: 'API de chistes y bromas',
                url: 'https://jokeapi.dev/',
                category: 'Entertainment',
                free: true,
                example: 'GET /joke/Any'
            },
            {
                name: 'Dog CEO',
                description: 'Imágenes aleatorias de perros',
                url: 'https://dog.ceo/dog-api/',
                category: 'Animals',
                free: true,
                example: 'GET /breeds/image/random'
            }
        ],
        timestamp: new Date().toISOString(),
        note: 'Datos de demostración - APIs reales disponibles'
    };
}

// ===============================
// RUTAS NUEVAS PARA EL PANEL HTML
// ===============================

// 1. Panel de Control Principal
app.get('/panel', (req, res) => {
    const panelHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel de Control - Mancy AI</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --primary-color: #4361ee;
            --primary-dark: #3a56d4;
            --success-color: #4cc9f0;
            --warning-color: #f72585;
            --danger-color: #7209b7;
            --dark-bg: #0a0a0a;
            --dark-card: #141414;
            --text-primary: #f8f9fa;
            --text-secondary: #adb5bd;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: var(--dark-bg);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        header {
            text-align: center;
            margin-bottom: 30px;
            padding: 30px;
            background: rgba(20, 20, 20, 0.9);
            border-radius: 15px;
            border: 1px solid rgba(67, 97, 238, 0.3);
        }

        h1 {
            font-size: 2.8rem;
            margin-bottom: 10px;
            background: linear-gradient(90deg, var(--primary-color), var(--success-color));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .subtitle {
            color: var(--text-secondary);
            font-size: 1.2rem;
            margin-bottom: 20px;
        }

        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 25px;
            margin-bottom: 30px;
        }

        .card {
            background: var(--dark-card);
            border-radius: 15px;
            padding: 25px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: transform 0.3s ease;
        }

        .card:hover {
            transform: translateY(-5px);
            border-color: var(--primary-color);
            box-shadow: 0 10px 30px rgba(67, 97, 238, 0.2);
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid rgba(67, 97, 238, 0.3);
        }

        .card-title {
            font-size: 1.4rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .card-title i {
            color: var(--primary-color);
            font-size: 1.3rem;
        }

        .status-container {
            display: flex;
            align-items: center;
            gap: 20px;
            flex-wrap: wrap;
        }

        .status-badge {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            display: inline-block;
            margin-right: 10px;
            animation: pulse 2s infinite;
        }

        .status-badge.online {
            background-color: var(--success-color);
            box-shadow: 0 0 10px var(--success-color);
        }

        .status-badge.offline {
            background-color: var(--danger-color);
            box-shadow: 0 0 10px var(--danger-color);
        }

        .status-badge.starting {
            background-color: var(--warning-color);
            box-shadow: 0 0 10px var(--warning-color);
            animation: blink 1.5s infinite;
        }

        .btn-group {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 10px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 1rem;
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
            color: white;
        }

        .btn-primary:hover:not(:disabled) {
            background: linear-gradient(135deg, var(--primary-dark), var(--primary-color));
            transform: scale(1.05);
        }

        .btn-danger {
            background: linear-gradient(135deg, var(--danger-color), #5a078f);
            color: white;
        }

        .btn-danger:hover:not(:disabled) {
            background: linear-gradient(135deg, #5a078f, var(--danger-color));
            transform: scale(1.05);
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-primary);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .btn-secondary:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.2);
            border-color: var(--primary-color);
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none !important;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .stat-item {
            background: rgba(67, 97, 238, 0.1);
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            border: 1px solid rgba(67, 97, 238, 0.2);
        }

        .stat-value {
            font-size: 2.2rem;
            font-weight: 800;
            background: linear-gradient(90deg, var(--primary-color), var(--success-color));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin: 10px 0;
        }

        .stat-label {
            color: var(--text-secondary);
            font-size: 0.9rem;
            font-weight: 500;
        }

        .api-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .api-card {
            background: rgba(255, 255, 255, 0.05);
            padding: 15px;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .api-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
        }

        .logs-container {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 10px;
            padding: 20px;
            margin-top: 20px;
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .log-entry {
            padding: 12px 15px;
            margin-bottom: 8px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            border-left: 3px solid var(--primary-color);
            font-family: monospace;
            font-size: 0.85rem;
        }

        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 10px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            transform: translateX(150%);
            transition: transform 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            max-width: 400px;
        }

        .notification.show {
            transform: translateX(0);
        }

        .notification.success {
            background: linear-gradient(135deg, var(--success-color), #3ab4d6);
        }

        .notification.error {
            background: linear-gradient(135deg, var(--danger-color), #5a078f);
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }

        @media (max-width: 768px) {
            .dashboard {
                grid-template-columns: 1fr;
            }
            
            .btn-group {
                flex-direction: column;
            }
            
            h1 {
                font-size: 2rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1><i class="fas fa-brain"></i> Panel de Control - Mancy AI</h1>
            <p class="subtitle">Sistema de Gestión y Monitoreo del Bot Inteligente</p>
            <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-top: 15px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="status-badge online" id="serverStatus"></div>
                    <span id="serverInfo">Conectando al servidor...</span>
                </div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">
                    <span id="currentTime">--:--:--</span>
                </div>
            </div>
        </header>

        <main class="dashboard">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-robot"></i> Estado del Bot</h2>
                    <button class="btn btn-secondary" onclick="refreshAll()">
                        <i class="fas fa-sync-alt"></i> Actualizar
                    </button>
                </div>
                
                <div class="status-container">
                    <div>
                        <span class="status-badge" id="botStatusBadge"></span>
                        <span style="font-size: 1.2rem; font-weight: bold;" id="botStatusText">CARGANDO...</span>
                    </div>
                    
                    <div class="btn-group">
                        <button class="btn btn-primary" id="startBotBtn" onclick="startBot()">
                            <i class="fas fa-play"></i> Iniciar Bot
                        </button>
                        <button class="btn btn-danger" id="stopBotBtn" onclick="stopBot()">
                            <i class="fas fa-stop"></i> Detener Bot
                        </button>
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-label">Servidores</div>
                        <div class="stat-value" id="serverCount">0</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Usuarios</div>
                        <div class="stat-value" id="userCount">0</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Mensajes</div>
                        <div class="stat-value" id="messageCount">0</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-server"></i> Sistema</h2>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-label">Uptime</div>
                        <div class="stat-value" id="uptime">0s</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Memoria</div>
                        <div class="stat-value" id="memoryUsage">0MB</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Versión</div>
                        <div class="stat-value" id="version">3.0</div>
                    </div>
                </div>

                <div style="margin-top: 25px;">
                    <h3 style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-plug"></i> APIs Conectadas
                    </h3>
                    <div class="api-grid" id="apisGrid">
                        <!-- APIs se cargarán dinámicamente -->
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2 class="card-title"><i class="fas fa-history"></i> Logs del Sistema</h2>
                    <button class="btn btn-secondary" onclick="clearLogs()">
                        <i class="fas fa-trash"></i> Limpiar
                    </button>
                </div>
                
                <div class="logs-container" id="logsContainer">
                    <!-- Logs se cargarán dinámicamente -->
                </div>
                
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; color: var(--text-secondary);">
                        <div>
                            <i class="fas fa-sync-alt"></i> Última actualización: <span id="lastUpdate">--:--:--</span>
                        </div>
                        <div>
                            Ping: <span id="pingTime">0ms</span>
                        </div>
                    </div>
                </div>
            </div>
        </main>

        <footer style="margin-top: 40px; padding: 20px; text-align: center; color: var(--text-secondary); font-size: 0.9rem; border-top: 1px solid rgba(255, 255, 255, 0.1);">
            <p>© 2024 Mancy AI System | Panel de Control v3.0 | <span id="currentYear"></span></p>
        </footer>
    </div>

    <!-- Notificación Toast -->
    <div id="notification" class="notification">
        <i class="fas fa-info-circle"></i>
        <span id="notificationMessage"></span>
    </div>

    <script>
        // Variables globales
        const API_BASE_URL = window.location.origin;
        let updateInterval = null;
        let logs = [];

        // Mostrar notificación
        function showNotification(message, type = 'info') {
            const notification = document.getElementById('notification');
            const icon = notification.querySelector('i');
            const messageSpan = document.getElementById('notificationMessage');
            
            switch(type) {
                case 'success':
                    icon.className = 'fas fa-check-circle';
                    notification.style.background = 'linear-gradient(135deg, #4cc9f0, #3ab4d6)';
                    break;
                case 'error':
                    icon.className = 'fas fa-exclamation-circle';
                    notification.style.background = 'linear-gradient(135deg, #7209b7, #5a078f)';
                    break;
                default:
                    icon.className = 'fas fa-info-circle';
                    notification.style.background = 'linear-gradient(135deg, #4361ee, #3a56d4)';
            }
            
            notification.className = 'notification';
            messageSpan.textContent = message;
            
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 4000);
        }

        // Agregar log
        function addLog(message, type = 'info') {
            const logsContainer = document.getElementById('logsContainer');
            const now = new Date();
            const timeString = now.toLocaleTimeString('es-ES', { hour12: false });
            
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            
            let icon = 'info-circle';
            switch(type) {
                case 'success': icon = 'check-circle'; break;
                case 'error': icon = 'exclamation-circle'; break;
                case 'warning': icon = 'exclamation-triangle'; break;
            }
            
            logEntry.innerHTML = \`
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #4cc9f0; font-weight: 600;">\${timeString}</span>
                    <span style="color: #adb5bd; font-size: 0.8rem;">
                        <i class="fas fa-\${icon}"></i>
                    </span>
                </div>
                <div style="margin-top: 5px;">\${message}</div>
            \`;
            
            logsContainer.prepend(logEntry);
            logs.push({ time: timeString, message: message, type: type });
            
            // Limitar a 20 entradas
            const logEntries = logsContainer.querySelectorAll('.log-entry');
            if (logEntries.length > 20) {
                logEntries[logEntries.length - 1].remove();
            }
        }

        // Limpiar logs
        function clearLogs() {
            if (confirm('¿Estás seguro de que quieres limpiar todos los logs?')) {
                document.getElementById('logsContainer').innerHTML = '';
                logs = [];
                addLog('Logs limpiados', 'info');
                showNotification('Logs limpiados correctamente', 'success');
            }
        }

        // Actualizar estado del sistema
        async function updateSystemStatus() {
            try {
                const startTime = Date.now();
                
                // Obtener estado del servidor
                const response = await fetch(\`\${API_BASE_URL}/api/status\`, {
                    signal: AbortSignal.timeout(5000)
                });
                
                if (!response.ok) throw new Error('Error del servidor');
                
                const data = await response.json();
                const pingTime = Date.now() - startTime;
                
                // Actualizar información del servidor
                document.getElementById('serverStatus').className = 'status-badge online';
                document.getElementById('serverInfo').textContent = 'Servidor conectado';
                document.getElementById('pingTime').textContent = \`\${pingTime}ms\`;
                document.getElementById('uptime').textContent = \`\${Math.floor(data.system?.uptime || 0)}s\`;
                document.getElementById('memoryUsage').textContent = data.system?.memory || '0MB';
                document.getElementById('version').textContent = data.version || '3.0';
                
                // Obtener estado del bot de Discord
                const botResponse = await fetch(\`\${API_BASE_URL}/api/discord-status\`, {
                    signal: AbortSignal.timeout(3000)
                }).catch(() => null);
                
                if (botResponse && botResponse.ok) {
                    const botData = await botResponse.json();
                    
                    // Actualizar estado del bot
                    const botStatusBadge = document.getElementById('botStatusBadge');
                    const botStatusText = document.getElementById('botStatusText');
                    const startBtn = document.getElementById('startBotBtn');
                    const stopBtn = document.getElementById('stopBotBtn');
                    
                    if (botData.bot_active) {
                        botStatusBadge.className = 'status-badge online';
                        botStatusText.textContent = 'CONECTADO';
                        startBtn.disabled = true;
                        stopBtn.disabled = false;
                    } else {
                        botStatusBadge.className = 'status-badge offline';
                        botStatusText.textContent = 'DESCONECTADO';
                        startBtn.disabled = false;
                        stopBtn.disabled = true;
                    }
                    
                    // Actualizar estadísticas
                    document.getElementById('serverCount').textContent = botData.guilds || 0;
                    document.getElementById('userCount').textContent = botData.users || 0;
                    document.getElementById('messageCount').textContent = botData.messages || 0;
                    
                } else {
                    // Modo sin bot
                    const botStatusBadge = document.getElementById('botStatusBadge');
                    const botStatusText = document.getElementById('botStatusText');
                    botStatusBadge.className = 'status-badge offline';
                    botStatusText.textContent = 'NO DISPONIBLE';
                    
                    document.getElementById('startBotBtn').disabled = true;
                    document.getElementById('stopBotBtn').disabled = true;
                }
                
                // Actualizar APIs
                updateAPIsList(data.modules || {});
                
                // Actualizar timestamp
                document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('es-ES', { hour12: false });
                
            } catch (error) {
                console.error('Error actualizando estado:', error);
                document.getElementById('serverStatus').className = 'status-badge offline';
                document.getElementById('serverInfo').textContent = 'Error de conexión';
                addLog('Error al conectar con el servidor', 'error');
            }
        }

        // Actualizar lista de APIs
        function updateAPIsList(modules) {
            const apisGrid = document.getElementById('apisGrid');
            const apis = [
                { name: 'Groq AI', key: 'groqEnhanced', icon: 'fas fa-brain', color: '#4cc9f0' },
                { name: 'Knowledge', key: 'knowledgeIntegration', icon: 'fas fa-book', color: '#4361ee' },
                { name: 'Free APIs', key: 'freeApis', icon: 'fas fa-plug', color: '#f72585' },
                { name: 'Discord Bot', key: 'discord', icon: 'fas fa-robot', color: '#7209b7' }
            ];
            
            apisGrid.innerHTML = apis.map(api => {
                const isActive = api.key === 'discord' ? true : modules[api.key] || false;
                const status = isActive ? 'online' : 'offline';
                const statusText = isActive ? 'Conectado' : 'No disponible';
                
                return \`
                    <div class="api-card">
                        <div class="api-icon" style="background: linear-gradient(135deg, \${api.color}, \${api.color}80);">
                            <i class="\${api.icon}"></i>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; margin-bottom: 5px;">\${api.name}</div>
                            <div style="font-size: 0.8rem; color: \${isActive ? '#4cc9f0' : '#adb5bd'};">
                                <i class="fas fa-circle" style="font-size: 0.6rem;"></i>
                                \${statusText}
                            </div>
                        </div>
                    </div>
                \`;
            }).join('');
        }

        // Iniciar bot
        async function startBot() {
            const startBtn = document.getElementById('startBotBtn');
            const originalText = startBtn.innerHTML;
            
            try {
                startBtn.disabled = true;
                startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';
                
                addLog('Iniciando bot de Discord...', 'info');
                
                const response = await fetch(\`\${API_BASE_URL}/api/discord/start\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: AbortSignal.timeout(10000)
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showNotification('Bot de Discord iniciándose...', 'success');
                    addLog('Solicitud de inicio enviada correctamente', 'success');
                    
                    // Esperar y actualizar
                    setTimeout(() => {
                        updateSystemStatus();
                        showNotification('Estado del bot actualizado', 'success');
                    }, 3000);
                    
                } else {
                    throw new Error(data.error || 'Error desconocido');
                }
                
            } catch (error) {
                console.error('Error al iniciar bot:', error);
                showNotification('Error al iniciar el bot: ' + error.message, 'error');
                addLog(\`Error al iniciar bot: \${error.message}\`, 'error');
                
            } finally {
                setTimeout(() => {
                    startBtn.disabled = false;
                    startBtn.innerHTML = originalText;
                    updateSystemStatus();
                }, 2000);
            }
        }

        // Detener bot
        async function stopBot() {
            if (!confirm('¿Estás seguro de que quieres detener el bot de Discord?')) {
                return;
            }
            
            const stopBtn = document.getElementById('stopBotBtn');
            const originalText = stopBtn.innerHTML;
            
            try {
                stopBtn.disabled = true;
                stopBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deteniendo...';
                
                addLog('Deteniendo bot de Discord...', 'warning');
                
                const response = await fetch(\`\${API_BASE_URL}/api/discord/stop\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: AbortSignal.timeout(10000)
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showNotification('Bot de Discord deteniéndose...', 'success');
                    addLog('Solicitud de detención enviada', 'success');
                    
                    setTimeout(() => {
                        updateSystemStatus();
                        showNotification('Bot detenido', 'info');
                    }, 2000);
                    
                } else {
                    throw new Error(data.error || 'Error desconocido');
                }
                
            } catch (error) {
                console.error('Error al detener bot:', error);
                showNotification('Error al detener el bot: ' + error.message, 'error');
                addLog(\`Error al detener bot: \${error.message}\`, 'error');
                
            } finally {
                setTimeout(() => {
                    stopBtn.innerHTML = originalText;
                    updateSystemStatus();
                }, 2000);
            }
        }

        // Refrescar todo
        function refreshAll() {
            const refreshBtn = document.querySelector('.btn-secondary');
            const originalText = refreshBtn.innerHTML;
            
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            
            updateSystemStatus();
            
            setTimeout(() => {
                addLog('Panel actualizado manualmente', 'info');
                showNotification('Datos actualizados correctamente', 'success');
                
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = originalText;
            }, 1000);
        }

        // Actualizar hora actual
        function updateCurrentTime() {
            const now = new Date();
            const timeString = now.toLocaleTimeString('es-ES', { hour12: false });
            document.getElementById('currentTime').textContent = timeString;
        }

        // Inicializar
        document.addEventListener('DOMContentLoaded', () => {
            console.log('Panel de Control Mancy AI inicializado');
            
            // Establecer año actual
            document.getElementById('currentYear').textContent = new Date().getFullYear();
            
            // Agregar logs iniciales
            addLog('Panel de control inicializado', 'success');
            addLog('Conectando con el servidor...', 'info');
            
            // Cargar estado inicial
            updateSystemStatus();
            updateCurrentTime();
            
            // Configurar actualización automática cada 30 segundos
            updateInterval = setInterval(() => {
                updateSystemStatus();
                updateCurrentTime();
            }, 30000);
            
            // Actualizar hora cada segundo
            setInterval(updateCurrentTime, 1000);
            
            // Mostrar notificación de bienvenida
            setTimeout(() => {
                showNotification('Panel de Control Mancy AI listo', 'success');
            }, 1000);
            
            // Hotkeys
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
                    e.preventDefault();
                    refreshAll();
                }
            });
        });

        // Limpiar al salir
        window.addEventListener('beforeunload', () => {
            if (updateInterval) {
                clearInterval(updateInterval);
            }
        });
    </script>
</body>
</html>
    `;
    
    res.send(panelHtml);
});

// 2. Endpoint para estado del bot de Discord
app.get('/api/discord-status', (req, res) => {
    res.json({
        bot_active: discordBot ? botStatus.online : false,
        starting_up: false,
        guilds: botStatus.guilds,
        users: botStatus.users,
        messages: botStatus.messages,
        commands: botStatus.commands,
        version: botStatus.version,
        timestamp: new Date().toISOString(),
        has_token: !!process.env.DISCORD_BOT_TOKEN,
        note: discordBot ? 'Bot cargado en memoria' : 'Bot no disponible'
    });
});

// 3. Endpoint para iniciar el bot
app.post('/api/discord/start', async (req, res) => {
    try {
        if (!discordBot) {
            return res.status(404).json({
                success: false,
                error: 'Bot de Discord no cargado',
                timestamp: new Date().toISOString()
            });
        }
        
        if (!process.env.DISCORD_BOT_TOKEN) {
            return res.status(400).json({
                success: false,
                error: 'Token de Discord no configurado',
                timestamp: new Date().toISOString()
            });
        }
        
        // Aquí iría la lógica para iniciar el bot
        // Por ahora simulamos
        botStatus.online = true;
        botStatus.guilds = Math.floor(Math.random() * 10) + 1;
        botStatus.users = Math.floor(Math.random() * 100) + 50;
        
        res.json({
            success: true,
            message: 'Bot de Discord iniciado (simulado)',
            timestamp: new Date().toISOString(),
            estimated_start_time: '2-5 segundos'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 4. Endpoint para detener el bot
app.post('/api/discord/stop', async (req, res) => {
    try {
        if (!discordBot) {
            return res.status(404).json({
                success: false,
                error: 'Bot de Discord no cargado',
                timestamp: new Date().toISOString()
            });
        }
        
        // Aquí iría la lógica para detener el bot
        botStatus.online = false;
        
        res.json({
            success: true,
            message: 'Bot de Discord detenido (simulado)',
            timestamp: new Date().toISOString(),
            memory_saved: true
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ===============================
// RUTAS EXISTENTES (las que ya tenías)
// ===============================

// Home
app.get('/', (req, res) => {
    res.json({
        service: '🤖 Mancy Discord Bot API',
        version: '3.0.0',
        status: 'operational',
        description: 'API para el bot de Discord con integración de conocimiento e IA',
        endpoints: [
            'GET  / → Esta página',
            'GET  /panel → Panel de Control HTML',
            'GET  /health → Estado del servidor',
            'GET  /api/status → Estado del sistema',
            'GET  /api/discord-status → Estado del bot Discord',
            'POST /api/discord/start → Iniciar bot Discord',
            'POST /api/discord/stop → Detener bot Discord',
            'GET  /api/free-apis → Lista de APIs gratuitas',
            'POST /api/chat → Chatbot con IA',
            'GET  /api/modules → Módulos cargados',
            'GET  /api/test/* → Probar funciones específicas',
            'GET  /api/demo → Demostración rápida',
            'GET  /api/env-check → Variables de entorno'
        ],
        panel_url: `${req.protocol}://${req.get('host')}/panel`,
        timestamp: new Date().toISOString()
    });
});

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(process.uptime())} segundos`,
        serverTime: new Date().toLocaleString(),
        nodeVersion: process.version,
        platform: process.platform,
        panel_available: true,
        discord_bot_loaded: !!discordBot
    });
});

// API Status (actualizada)
app.get('/api/status', (req, res) => {
    res.json({
        status: 'operational',
        serverTime: new Date().toISOString(),
        modules: modulesLoaded,
        discord_bot: {
            loaded: !!discordBot,
            online: botStatus.online,
            version: botStatus.version
        },
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        hasGroqKey: !!process.env.GROQ_API_KEY,
        hasDiscordToken: !!process.env.DISCORD_BOT_TOKEN,
        system: {
            arch: process.arch,
            platform: process.platform,
            memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            uptime: Math.floor(process.uptime())
        }
    });
});

// List Free APIs
app.get('/api/free-apis', async (req, res) => {
    try {
        const apis = await getFreeAPIsList();
        res.json({
            success: true,
            data: apis,
            modules: modulesLoaded,
            discord_bot: !!discordBot,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'El mensaje es requerido y debe ser texto',
                example: { message: "Hola, ¿cómo estás?" }
            });
        }
        
        console.log(`💬 Chat request: "${message.substring(0, 100)}"`);
        
        let analysis = { topic: 'general', requiresKnowledge: false };
        if (analyzeUserMessage) {
            analysis = analyzeUserMessage(message);
        }
        
        let knowledge = null;
        if (analysis.requiresKnowledge && integrateKnowledge) {
            knowledge = await integrateKnowledge(message, analysis);
        }
        
        let response = '';
        if (getGroqChatCompletion) {
            response = await getGroqChatCompletion(message, knowledge);
        } else {
            response = `🤖 [Bot]: He recibido tu mensaje: "${message}"`;
            
            if (knowledge) {
                response += `\n🔍 He encontrado información sobre: ${analysis.topic}`;
            }
            
            if (modulesLoaded.freeApis) {
                response += '\n\n💡 También puedo ayudarte con:\n• Citas inspiradoras\n• Datos de criptomonedas\n• Traducciones\n• Hechos curiosos';
            }
        }
        
        res.json({
            success: true,
            response: response,
            analysis: analysis,
            knowledgeUsed: !!knowledge,
            modulesUsed: modulesLoaded,
            timestamp: new Date().toISOString(),
            responseLength: response.length
        });
        
    } catch (error) {
        console.error('Error en /api/chat:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
});

// Test specific API functions
app.get('/api/test/:function', async (req, res) => {
    const { function: funcName } = req.params;
    const { param } = req.query;
    
    try {
        let result = null;
        let moduleUsed = 'none';
        
        if (modulesLoaded.freeApis && freeApisModule[funcName]) {
            moduleUsed = 'freeApis';
            
            try {
                if (param) {
                    result = await freeApisModule[funcName](param);
                } else {
                    result = await freeApisModule[funcName]();
                }
            } catch (funcError) {
                result = {
                    success: false,
                    error: `Error ejecutando ${funcName}: ${funcError.message}`,
                    function: funcName,
                    param: param
                };
            }
        } else {
            result = {
                success: true,
                demo: true,
                function: funcName,
                param: param || 'none',
                message: `Función ${funcName} ${param ? `con parámetro "${param}"` : ''}`,
                data: {
                    getRandomQuote: {
                        quote: "La vida es 10% lo que te pasa y 90% cómo reaccionas.",
                        author: "Charles R. Swindoll",
                        category: "life"
                    },
                    getCryptoPrice: {
                        coin: param || 'bitcoin',
                        price: 45000 + Math.random() * 5000,
                        change: Math.random() * 10 - 5
                    },
                    getRandomFact: {
                        fact: "Los pulpos tienen sangre azul.",
                        category: "animals",
                        verified: true
                    },
                    translate: {
                        original: param || "Hello world",
                        translated: "Hola mundo",
                        language: "es"
                    }
                }[funcName] || {
                    note: `Función ${funcName} disponible en modo demo`,
                    timestamp: new Date().toISOString()
                }
            };
        }
        
        res.json({
            success: true,
            function: funcName,
            param: param || 'none',
            module: moduleUsed,
            result: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            function: funcName,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Module Status
app.get('/api/modules', (req, res) => {
    res.json({
        modules: modulesLoaded,
        discord_bot: !!discordBot,
        loadedCount: Object.values(modulesLoaded).filter(Boolean).length,
        totalCount: Object.keys(modulesLoaded).length,
        details: {
            freeApis: modulesLoaded.freeApis ? '✅ Operativo' : '⚠️  Usando datos demo',
            knowledgeDetector: modulesLoaded.knowledgeDetector ? '✅ Operativo' : '⚠️  Usando fallback',
            groqEnhanced: modulesLoaded.groqEnhanced ? '✅ Conectado a Groq' : '⚠️  Modo simple',
            knowledgeIntegration: modulesLoaded.knowledgeIntegration ? '✅ Integrado' : '⚠️  No disponible',
            discordBot: discordBot ? '✅ Cargado' : '⚠️  No disponible'
        },
        serverInfo: {
            directory: __dirname,
            nodeVersion: process.version,
            uptime: process.uptime(),
            panel_url: `${req.protocol}://${req.get('host')}/panel`
        },
        timestamp: new Date().toISOString()
    });
});

// Quick Demo
app.get('/api/demo', async (req, res) => {
    try {
        const tests = [];
        
        if (modulesLoaded.freeApis) {
            try {
                const quote = await freeApisModule.getRandomQuote?.();
                if (quote) tests.push({ 
                    type: 'quote', 
                    success: true,
                    data: `${quote.quote} - ${quote.author}` 
                });
            } catch (e) {
                tests.push({ 
                    type: 'quote', 
                    success: false,
                    error: e.message 
                });
            }
        }
        
        if (analyzeUserMessage) {
            const analysis = analyzeUserMessage("¿Qué es la inteligencia artificial?");
            tests.push({ 
                type: 'analysis', 
                success: true,
                data: analysis 
            });
        }
        
        if (getGroqChatCompletion) {
            const chatResponse = await getGroqChatCompletion("Hola, dime algo interesante");
            tests.push({ 
                type: 'chat', 
                success: true,
                data: chatResponse.substring(0, 200) 
            });
        }
        
        if (modulesLoaded.freeApis && freeApisModule.getRandomFact) {
            try {
                const fact = await freeApisModule.getRandomFact();
                tests.push({ 
                    type: 'fact', 
                    success: true,
                    data: fact.fact 
                });
            } catch (e) {}
        }
        
        res.json({
            success: true,
            demo: true,
            tests: tests,
            modules: modulesLoaded,
            discord_bot: !!discordBot,
            timestamp: new Date().toISOString(),
            summary: `Ejecutadas ${tests.length} pruebas de demo`,
            panel_info: 'Visita /panel para el panel de control completo'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Environment Check
app.get('/api/env-check', (req, res) => {
    const envVars = {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: process.env.PORT || 3000,
        GROQ_API_KEY: process.env.GROQ_API_KEY ? '✅ CONFIGURADA' : '❌ NO CONFIGURADA',
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN ? '✅ CONFIGURADA' : '❌ NO CONFIGURADA',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✅ CONFIGURADA' : '❌ NO CONFIGURADA',
        BOT_PREFIX: process.env.BOT_PREFIX || '! (default)',
        ENABLE_MEMORY: process.env.ENABLE_MEMORY || 'true',
        DEBUG_MODE: process.env.DEBUG_MODE || 'false'
    };
    
    res.json({
        environment: envVars,
        hasRequiredKeys: !!process.env.GROQ_API_KEY,
        hasDiscordToken: !!process.env.DISCORD_BOT_TOKEN,
        serverTime: new Date().toISOString(),
        recommendations: [
            !process.env.GROQ_API_KEY ? 'Agrega GROQ_API_KEY a tus variables de entorno' : null,
            !process.env.DISCORD_BOT_TOKEN ? 'Agrega DISCORD_BOT_TOKEN para usar el bot de Discord' : null
        ].filter(Boolean),
        panel_url: `${req.protocol}://${req.get('host')}/panel`
    });
});

// Simple Echo
app.get('/api/echo', (req, res) => {
    const { text } = req.query;
    res.json({
        echo: text || 'Hello World!',
        timestamp: new Date().toISOString(),
        received: new Date().toLocaleString(),
        ip: req.ip,
        panel_url: `${req.protocol}://${req.get('host')}/panel`
    });
});

// ===============================
// Error Handlers
// ===============================

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Ruta no encontrada',
        path: req.path,
        method: req.method,
        availableRoutes: [
            'GET  /',
            'GET  /panel → Panel de Control HTML',
            'GET  /health',
            'GET  /api/status',
            'GET  /api/discord-status',
            'POST /api/discord/start',
            'POST /api/discord/stop',
            'GET  /api/free-apis',
            'POST /api/chat',
            'GET  /api/modules',
            'GET  /api/test/:function',
            'GET  /api/demo',
            'GET  /api/env-check',
            'GET  /api/echo'
        ],
        timestamp: new Date().toISOString(),
        tip: 'Visita GET / para ver todos los endpoints disponibles'
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('🔥 Error global:', err.message);
    
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 
            'Error interno del servidor' : err.message,
        timestamp: new Date().toISOString(),
        requestId: Date.now().toString(36),
        panel_url: `${req.protocol}://${req.get('host')}/panel`
    });
});

// ===============================
// Cargar todos los módulos
// ===============================
async function loadAllModules() {
    console.log('📦 Cargando módulos desde:', __dirname);
    
    await Promise.allSettled([
        loadFreeAPIs(),
        loadKnowledgeDetector(),
        loadGroqEnhanced(),
        loadKnowledgeIntegration(),
        loadDiscordBot()
    ]);
    
    console.log('📊 Estado de módulos:');
    Object.entries(modulesLoaded).forEach(([name, loaded]) => {
        console.log(`   ${loaded ? '✅' : '⚠️ '} ${name}: ${loaded ? 'CARGADO' : 'FALLBACK'}`);
    });
    
    if (discordBot) {
        console.log('🤖 Bot de Discord: ✅ CARGADO');
    } else {
        console.log('🤖 Bot de Discord: ⚠️  NO DISPONIBLE');
    }
}

// ===============================
// Inicialización y arranque
// ===============================
async function startServer() {
    try {
        await loadAllModules();
        
        app.listen(PORT, () => {
            console.log(`
🚀 SERVIDOR INICIADO CORRECTAMENTE
================================
📡 Puerto: ${PORT}
🌍 URL: https://a-i-icr7.onrender.com
🔧 Entorno: ${process.env.NODE_ENV || 'development'}
⏰ Hora: ${new Date().toLocaleString()}

🎨 PANEL DE CONTROL:
   • https://a-i-icr7.onrender.com/panel
   • Diseño moderno con monitoreo en tiempo real
   • Control completo del bot de Discord

🤖 DISCORD BOT:
   • Estado: ${discordBot ? '✅ CARGADO' : '⚠️  NO DISPONIBLE'}
   • Token: ${process.env.DISCORD_BOT_TOKEN ? '✅ CONFIGURADO' : '❌ FALTA'}
   • Control: Iniciar/Detener desde el panel

📦 MÓDULOS:
   • free-apis: ${modulesLoaded.freeApis ? '✅ Cargado' : '⚠️  Demo mode'}
   • knowledge-detector: ${modulesLoaded.knowledgeDetector ? '✅ Cargado' : '⚠️  Fallback'}
   • groq-enhanced: ${modulesLoaded.groqEnhanced ? '✅ Conectado a Groq' : '⚠️  Simple mode'}
   • knowledge-integration: ${modulesLoaded.knowledgeIntegration ? '✅ Cargado' : '⚠️  No disponible'}

🔍 ENDPOINTS PRINCIPALES:
   • https://a-i-icr7.onrender.com/health
   • https://a-i-icr7.onrender.com/api/status
   • https://a-i-icr7.onrender.com/api/discord-status
   • https://a-i-icr7.onrender.com/api/chat (POST)
   • https://a-i-icr7.onrender.com/api/demo

💡 CONFIGURACIÓN:
   • Groq API: ${process.env.GROQ_API_KEY ? '✅ Presente' : '❌ Falta'}
   • Discord Token: ${process.env.DISCORD_BOT_TOKEN ? '✅ Presente' : '❌ Falta'}
   • Server: ✅ Funcionando
   • Panel: ✅ Disponible
   • Status: 🟢 ONLINE
            `);
        });
        
    } catch (error) {
        console.error('❌ Error al iniciar el servidor:', error);
        process.exit(1);
    }
}

// Iniciar servidor
startServer();

export default app;
