// ===============================
// Imports
// ===============================
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// utils - Importaciones seguras con manejo de errores
import { analyzeUserMessage } from './utils/knowledge-detector.js';

// services
import { getGroqChatCompletion } from './services/groq-enhanced.js';
import { integrateKnowledge } from './services/knowledge-integration.js';

// config
import { API_KEYS } from './config/constants.js';

// ===============================
// ES Modules setup (__dirname)
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===============================
// Environment variables
// ===============================
dotenv.config();

// ===============================
// Importación segura de free-apis.js
// ===============================
let getFreeAPIs = null;
let freeApisModule = {};

try {
    // Intenta importar el módulo real
    const freeApisModule = await import('./utils/free-apis.js');
    console.log('✅ Módulo free-apis.js cargado correctamente');
    
    // Si el módulo exporta una función getFreeAPIs, úsala
    if (typeof freeApisModule.getFreeAPIs === 'function') {
        getFreeAPIs = freeApisModule.getFreeAPIs;
    } else {
        // Si no, usa nuestra versión local
        console.log('⚠️  free-apis.js no exporta getFreeAPIs, usando versión interna');
        getFreeAPIs = createLocalFreeAPIs();
    }
} catch (error) {
    console.log('⚠️  No se pudo cargar free-apis.js, usando versión interna:', error.message);
    getFreeAPIs = createLocalFreeAPIs();
}

// Función local como fallback
function createLocalFreeAPIs() {
    const LOCAL_FREE_APIS = [
        {
            id: 1,
            name: 'REST Countries',
            description: 'Información sobre países del mundo',
            url: 'https://restcountries.com/',
            category: 'Geografía',
            auth: 'none',
            cors: true
        },
        {
            id: 2,
            name: 'JSONPlaceholder',
            description: 'API falsa para testing y prototipado',
            url: 'https://jsonplaceholder.typicode.com/',
            category: 'Testing',
            auth: 'none',
            cors: true
        },
        {
            id: 3,
            name: 'OpenWeatherMap',
            description: 'Datos meteorológicos (tier gratuito disponible)',
            url: 'https://openweathermap.org/api',
            category: 'Clima',
            auth: 'apiKey',
            cors: true
        }
    ];

    return async function() {
        return {
            success: true,
            count: LOCAL_FREE_APIS.length,
            apis: LOCAL_FREE_APIS,
            timestamp: new Date().toISOString(),
            note: 'Usando datos temporales - free-apis.js no disponible'
        };
    };
}

// ===============================
// Funciones para usar las APIs de tu módulo
// ===============================
async function useFreeAPIs() {
    try {
        // Si tenemos acceso al módulo, usamos sus funciones
        if (freeApisModule) {
            const results = [];
            
            // Prueba algunas funciones del módulo
            const quoteResult = await freeApisModule.getRandomQuote?.();
            if (quoteResult?.success) {
                results.push({
                    type: 'quote',
                    data: `${quoteResult.quote} - ${quoteResult.author}`
                });
            }
            
            const cryptoResult = await freeApisModule.getCryptoPrice?.('bitcoin');
            if (cryptoResult?.success) {
                results.push({
                    type: 'crypto',
                    data: `Bitcoin: $${cryptoResult.prices.usd} USD`
                });
            }
            
            const factResult = await freeApisModule.getRandomFact?.();
            if (factResult?.success) {
                results.push({
                    type: 'fact',
                    data: factResult.fact
                });
            }
            
            if (results.length > 0) {
                return {
                    success: true,
                    demoResults: results,
                    message: 'APIs funcionando correctamente',
                    timestamp: new Date().toISOString()
                };
            }
        }
        
        // Si no hay módulo o no funcionó, devolvemos info básica
        return await getFreeAPIs();
        
    } catch (error) {
        console.error('Error usando APIs:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
            fallbackData: {
                message: 'Módulo free-apis.js disponible pero con errores'
            }
        };
    }
}

// ===============================
// App initialization
// ===============================
const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// Middlewares
// ===============================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// ===============================
// Routes
// ===============================

// Home
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Test free APIs
app.get('/api/free-apis', async (req, res) => {
    try {
        const apis = await getFreeAPIs();
        res.json({ 
            success: true, 
            data: apis,
            hasModule: !!freeApisModule,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error en /api/free-apis:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
            fallbackData: {
                success: true,
                count: 3,
                apis: [
                    {
                        name: 'REST Countries',
                        description: 'API de países',
                        url: 'https://restcountries.com/'
                    },
                    {
                        name: 'JSONPlaceholder',
                        description: 'API para testing',
                        url: 'https://jsonplaceholder.typicode.com/'
                    },
                    {
                        name: 'Quotable',
                        description: 'Citas aleatorias',
                        url: 'https://api.quotable.io/'
                    }
                ],
                isFallback: true
            }
        });
    }
});

// Demo de APIs específicas
app.get('/api/demo', async (req, res) => {
    try {
        const demoResults = await useFreeAPIs();
        res.json({
            success: true,
            ...demoResults,
            moduleAvailable: !!freeApisModule,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error en /api/demo:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Chatbot
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Message is required and must be a non-empty string'
            });
        }

        console.log(`📨 Mensaje recibido: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);

        // 1. Analyze user message
        let analysis = {};
        try {
            analysis = analyzeUserMessage(message);
        } catch (analysisError) {
            console.warn('Error en análisis, usando valores por defecto:', analysisError.message);
            analysis = {
                topic: 'general',
                requiresKnowledge: false,
                confidence: 0.5
            };
        }

        // 2. Integrate knowledge if needed
        let knowledge = null;
        try {
            knowledge = await integrateKnowledge(message, analysis);
        } catch (knowledgeError) {
            console.warn('Error integrando conocimiento:', knowledgeError.message);
            knowledge = null;
        }

        // 3. Get response from Groq
        let groqResponse = '';
        try {
            groqResponse = await getGroqChatCompletion(message, knowledge);
        } catch (groqError) {
            console.error('Error con Groq API:', groqError.message);
            
            // Fallback response si Groq falla
            groqResponse = `He recibido tu mensaje: "${message}". Actualmente estoy teniendo problemas para acceder a mi motor de IA principal. `;
            
            // Si tenemos el módulo de APIs, ofrecemos alternativas
            if (freeApisModule) {
                groqResponse += `Puedo ayudarte con: citas aleatorias, clima, criptomonedas, traducciones y datos de países usando APIs gratuitas.`;
            }
        }

        // 4. Final response
        res.json({
            success: true,
            message: groqResponse,
            analysis,
            timestamp: new Date().toISOString(),
            messageLength: message.length,
            hasKnowledge: !!knowledge,
            hasFreeAPIs: !!freeApisModule
        });

    } catch (error) {
        console.error('Error en /api/chat:', error);
        res.status(500).json({
            success: false,
            error: process.env.NODE_ENV === 'production' 
                ? 'Internal server error' 
                : error.message,
            timestamp: new Date().toISOString(),
            ...(process.env.NODE_ENV === 'development' && { 
                stack: error.stack
            })
        });
    }
});

// Ruta para probar APIs específicas
app.get('/api/test/:function', async (req, res) => {
    try {
        const { function: funcName } = req.params;
        const { param } = req.query;
        
        let result = null;
        
        if (freeApisModule) {
            switch(funcName) {
                case 'quote':
                    result = await freeApisModule.getRandomQuote?.();
                    break;
                case 'crypto':
                    result = await freeApisModule.getCryptoPrice?.(param || 'bitcoin');
                    break;
                case 'fact':
                    result = await freeApisModule.getRandomFact?.();
                    break;
                case 'translate':
                    result = await freeApisModule.translate?.(param || 'Hello world', 'es');
                    break;
                case 'weather':
                    // Usamos coordenadas de ejemplo (Madrid)
                    result = await freeApisModule.getWeather?.(40.4168, -3.7038);
                    break;
                case 'wikipedia':
                    result = await freeApisModule.searchWikipedia?.(param || 'artificial intelligence');
                    break;
                case 'country':
                    result = await freeApisModule.getCountryInfo?.(param || 'es');
                    break;
                default:
                    result = {
                        success: false,
                        error: `Función ${funcName} no encontrada`
                    };
            }
        } else {
            result = {
                success: false,
                error: 'Módulo free-apis.js no disponible'
            };
        }
        
        res.json({
            success: result?.success || false,
            function: funcName,
            param: param || 'default',
            result: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`Error en /api/test/${req.params.function}:`, error);
        res.status(500).json({
            success: false,
            error: error.message,
            function: req.params.function,
            timestamp: new Date().toISOString()
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        hasFreeAPIs: !!freeApisModule,
        hasGroqKey: !!process.env.GROQ_API_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY
    });
});

// Config check
app.get('/api/config-check', (req, res) => {
    res.json({
        groqKey: process.env.GROQ_API_KEY ? '✓ Configurada' : '✗ No configurada',
        openaiKey: process.env.OPENAI_API_KEY ? '✓ Configurada' : '✗ No configurada',
        port: PORT,
        nodeEnv: process.env.NODE_ENV || 'development',
        hasFreeAPIsModule: !!freeApisModule,
        moduleFunctions: freeApisModule ? Object.keys(freeApisModule) : []
    });
});

// ===============================
// 404 handler
// ===============================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Ruta no encontrada',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
        availableRoutes: [
            'GET /',
            'GET /api/free-apis',
            'GET /api/demo',
            'GET /api/test/:function',
            'POST /api/chat',
            'GET /api/health',
            'GET /api/config-check'
        ]
    });
});

// ===============================
// Global error handler
// ===============================
app.use((err, req, res, next) => {
    console.error('🔥 Error global:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });
    
    const statusCode = err.status || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.status(statusCode).json({
        success: false,
        error: isProduction ? 'Error interno del servidor' : err.message,
        timestamp: new Date().toISOString(),
        ...(!isProduction && { 
            stack: err.stack
        })
    });
});

// ===============================
// Start server
// ===============================
app.listen(PORT, () => {
    console.log(`
✅ Servidor corriendo en puerto ${PORT}
📁 Directorio base: ${__dirname}
🌍 URL local: http://localhost:${PORT}
🔧 Entorno: ${process.env.NODE_ENV || 'development'}
📅 Iniciado: ${new Date().toLocaleString()}
🔄 Uptime: ${process.uptime()} segundos

📊 Módulos cargados:
   • free-apis: ${freeApisModule ? '✅ Disponible' : '⚠️  No disponible'}
   • Groq API: ${process.env.GROQ_API_KEY ? '✅ Configurada' : '⚠️  No configurada'}
   • OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Configurada' : '⚠️  No configurada'}

🚀 Rutas disponibles:
   • GET  /                       → Página principal
   • GET  /api/free-apis          → Lista de APIs gratuitas
   • GET  /api/demo               → Demo de APIs en acción
   • GET  /api/test/:function     → Probar APIs específicas
   • POST /api/chat               → Chatbot AI
   • GET  /api/health             → Estado del servidor
   • GET  /api/config-check       → Verificación de configuración
  `);
});

export default app;
