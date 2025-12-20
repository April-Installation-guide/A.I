import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ===============================
// Configuración inicial
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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
        // Función por defecto
        analyzeUserMessage = (message) => ({
            topic: 'general',
            requiresKnowledge: message.length > 20 && /qué|quien|cómo|por qué|define|explica/i.test(message),
            confidence: 0.7,
            categories: ['general'],
            keywords: message.toLowerCase().split(' ').filter(w => w.length > 3)
        });
    }
    return false;
}

// 3. Groq Enhanced Module
let getGroqChatCompletion = null;
async function loadGroqEnhanced() {
    try {
        // Primero intentamos importar dinámicamente
        const module = await import('./services/groq-enhanced.js');
        
        // Verificar si es default export
        const GroqEnhanced = module.default || module.GroqEnhanced || module;
        
        if (GroqEnhanced && process.env.GROQ_API_KEY) {
            const instance = new GroqEnhanced(process.env.GROQ_API_KEY);
            
            getGroqChatCompletion = async (message, knowledge) => {
                try {
                    // Usar la función existente o crear una wrapper
                    if (typeof instance.generateEnhancedResponse === 'function') {
                        const result = await instance.generateEnhancedResponse(message, [], 'user');
                        return result.response || result.message || 'No response generated';
                    } else if (typeof instance.chat === 'function') {
                        return await instance.chat(message);
                    } else {
                        return `[Groq] Received: ${message}`;
                    }
                } catch (error) {
                    console.error('Error calling Groq:', error.message);
                    return `Fallback: ${message}`;
                }
            };
            
            modulesLoaded.groqEnhanced = true;
            console.log('✅ Módulo groq-enhanced.js cargado');
            return true;
        }
    } catch (error) {
        console.log('⚠️  No se pudo cargar groq-enhanced.js:', error.message);
    }
    
    // Fallback
    getGroqChatCompletion = async (message) => {
        return `Bot: He recibido tu mensaje "${message}". (Modo simple - Groq no disponible)`;
    };
    return false;
}

// 4. Knowledge Integration Module
let integrateKnowledge = null;
async function loadKnowledgeIntegration() {
    try {
        const module = await import('./services/knowledge-integration.js');
        
        // Manejar diferentes tipos de exportación
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
    
    integrateKnowledge = async () => null;
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
    
    // Datos de fallback
    return {
        success: true,
        count: 3,
        apis: [
            {
                name: 'REST Countries',
                description: 'Información sobre países',
                url: 'https://restcountries.com/',
                category: 'Geography',
                free: true
            },
            {
                name: 'Quotable',
                description: 'Citas y frases inspiradoras',
                url: 'https://api.quotable.io/',
                category: 'Quotes',
                free: true
            },
            {
                name: 'OpenWeatherMap',
                description: 'Datos del clima',
                url: 'https://openweathermap.org/api',
                category: 'Weather',
                free: true
            }
        ],
        timestamp: new Date().toISOString(),
        note: 'Usando datos de respaldo'
    };
}

// ===============================
// Cargar todos los módulos al inicio
// ===============================
async function loadAllModules() {
    console.log('📦 Cargando módulos...');
    
    await Promise.allSettled([
        loadFreeAPIs(),
        loadKnowledgeDetector(),
        loadGroqEnhanced(),
        loadKnowledgeIntegration()
    ]);
    
    console.log('📊 Estado de módulos:', modulesLoaded);
}

// ===============================
// Routes
// ===============================

// 1. Home
app.get('/', (req, res) => {
    res.json({
        service: 'Mancy Discord Bot API',
        version: '1.0.0',
        status: 'running',
        endpoints: [
            'GET /health',
            'GET /api/status',
            'GET /api/free-apis',
            'POST /api/chat',
            'GET /api/modules',
            'GET /api/test/:function'
        ],
        documentation: 'Ver README.md para más información'
    });
});

// 2. Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node: process.version
    });
});

// 3. API Status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'operational',
        serverTime: new Date().toISOString(),
        modules: modulesLoaded,
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        hasGroqKey: !!process.env.GROQ_API_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY
    });
});

// 4. List Free APIs
app.get('/api/free-apis', async (req, res) => {
    try {
        const apis = await getFreeAPIsList();
        res.json({
            success: true,
            data: apis,
            modules: modulesLoaded,
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

// 5. Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'El mensaje es requerido y debe ser texto'
            });
        }
        
        console.log(`💬 Chat request: "${message.substring(0, 100)}"`);
        
        // Paso 1: Analizar mensaje
        let analysis = { topic: 'general', requiresKnowledge: false };
        if (analyzeUserMessage) {
            analysis = analyzeUserMessage(message);
        }
        
        // Paso 2: Integrar conocimiento si es necesario
        let knowledge = null;
        if (analysis.requiresKnowledge && integrateKnowledge) {
            knowledge = await integrateKnowledge(message, analysis);
        }
        
        // Paso 3: Generar respuesta
        let response = '';
        if (getGroqChatCompletion) {
            response = await getGroqChatCompletion(message, knowledge);
        } else {
            response = `Bot: "${message}"`;
            
            // Añadir información adicional si tenemos APIs
            if (modulesLoaded.freeApis) {
                response += '\n\n💡 También puedo ayudarte con: citas, clima, datos de países y más.';
            }
        }
        
        // Respuesta exitosa
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

// 6. Test specific API functions
app.get('/api/test/:function', async (req, res) => {
    const { function: funcName } = req.params;
    const { param } = req.query;
    
    try {
        let result = null;
        let moduleUsed = 'none';
        
        if (modulesLoaded.freeApis && freeApisModule[funcName]) {
            moduleUsed = 'freeApis';
            
            switch(funcName) {
                case 'getRandomQuote':
                    result = await freeApisModule.getRandomQuote();
                    break;
                case 'getCryptoPrice':
                    result = await freeApisModule.getCryptoPrice(param || 'bitcoin');
                    break;
                case 'getRandomFact':
                    result = await freeApisModule.getRandomFact();
                    break;
                case 'translate':
                    result = await freeApisModule.translate(param || 'Hello world', 'es');
                    break;
                case 'getWeather':
                    result = await freeApisModule.getWeather(40.4168, -3.7038);
                    break;
                case 'searchWikipedia':
                    result = await freeApisModule.searchWikipedia(param || 'artificial intelligence');
                    break;
                case 'getCountryInfo':
                    result = await freeApisModule.getCountryInfo(param || 'es');
                    break;
                default:
                    if (typeof freeApisModule[funcName] === 'function') {
                        result = await freeApisModule[funcName](param);
                    } else {
                        result = { error: `Función ${funcName} no encontrada` };
                    }
            }
        } else {
            // Datos de demostración
            result = {
                success: true,
                demo: true,
                function: funcName,
                message: `Función ${funcName} no disponible en este momento`,
                sampleData: {
                    quote: "La práctica hace al maestro.",
                    weather: { temp: 22, condition: "soleado" },
                    fact: "Los pingüinos pueden saltar hasta 6 pies en el aire.",
                    translation: "Hola mundo"
                }[funcName] || `Prueba ${funcName} con ?param=valor`
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

// 7. Module Status
app.get('/api/modules', (req, res) => {
    res.json({
        modules: modulesLoaded,
        loadedCount: Object.values(modulesLoaded).filter(Boolean).length,
        totalCount: Object.keys(modulesLoaded).length,
        details: {
            freeApis: modulesLoaded.freeApis ? 'Operativo' : 'No disponible',
            knowledgeDetector: modulesLoaded.knowledgeDetector ? 'Operativo' : 'Usando fallback',
            groqEnhanced: modulesLoaded.groqEnhanced ? 'Operativo' : 'Usando fallback',
            knowledgeIntegration: modulesLoaded.knowledgeIntegration ? 'Operativo' : 'No disponible'
        },
        timestamp: new Date().toISOString()
    });
});

// 8. Quick Demo
app.get('/api/demo', async (req, res) => {
    try {
        // Probar diferentes funciones
        const tests = [];
        
        // Test 1: Free APIs (si está disponible)
        if (modulesLoaded.freeApis) {
            try {
                const quote = await freeApisModule.getRandomQuote?.();
                if (quote) tests.push({ type: 'quote', data: quote });
            } catch (e) {}
        }
        
        // Test 2: Análisis de texto
        if (analyzeUserMessage) {
            const analysis = analyzeUserMessage("¿Qué es la inteligencia artificial?");
            tests.push({ type: 'analysis', data: analysis });
        }
        
        // Test 3: Chat simple
        const chatResponse = getGroqChatCompletion ? 
            await getGroqChatCompletion("Hola, ¿cómo estás?") : 
            "Chat no disponible";
        tests.push({ type: 'chat', data: chatResponse });
        
        res.json({
            success: true,
            demo: true,
            tests: tests,
            modules: modulesLoaded,
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

// 9. Environment Check
app.get('/api/env-check', (req, res) => {
    // Lista segura de variables (sin valores sensibles)
    const envVars = {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        GROQ_API_KEY: process.env.GROQ_API_KEY ? '***SET***' : 'NOT SET',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '***SET***' : 'NOT SET',
        BOT_PREFIX: process.env.BOT_PREFIX,
        ENABLE_MEMORY: process.env.ENABLE_MEMORY
    };
    
    res.json({
        environment: envVars,
        hasRequiredKeys: !!process.env.GROQ_API_KEY,
        timestamp: new Date().toISOString()
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
            'GET  /health',
            'GET  /api/status',
            'GET  /api/free-apis',
            'POST /api/chat',
            'GET  /api/modules',
            'GET  /api/test/:function',
            'GET  /api/demo',
            'GET  /api/env-check'
        ],
        timestamp: new Date().toISOString()
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('🔥 Error global:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    });
    
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 
            'Error interno del servidor' : err.message,
        timestamp: new Date().toISOString()
    });
});

// ===============================
// Inicialización y arranque
// ===============================
async function startServer() {
    try {
        // Cargar módulos
        await loadAllModules();
        
        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`
🚀 SERVIDOR INICIADO CORRECTAMENTE
================================
📡 Puerto: ${PORT}
🌍 URL: http://localhost:${PORT}
📁 Directorio: ${__dirname}
🔧 Entorno: ${process.env.NODE_ENV || 'development'}
⏰ Hora: ${new Date().toLocaleString()}

📦 MÓDULOS CARGADOS:
${Object.entries(modulesLoaded).map(([name, loaded]) => 
    `   ${loaded ? '✅' : '⚠️ '} ${name}: ${loaded ? 'CARGADO' : 'NO DISPONIBLE'}`).join('\n')}

🔍 ENDPOINTS DISPONIBLES:
   • GET  /              → Información del servicio
   • GET  /health        → Health check
   • GET  /api/status    → Estado del sistema
   • GET  /api/free-apis → Lista de APIs gratuitas
   • POST /api/chat      → Chatbot AI
   • GET  /api/modules   → Estado de módulos
   • GET  /api/test/*    → Probar funciones
   • GET  /api/demo      → Demo rápido
   • GET  /api/env-check → Verificar variables de entorno

💡 CONFIGURACIÓN:
   • Groq API Key: ${process.env.GROQ_API_KEY ? 'PRESENTE' : 'NO CONFIGURADA'}
   • OpenAI API Key: ${process.env.OPENAI_API_KEY ? 'PRESENTE' : 'NO CONFIGURADA'}
   • Bot Prefix: ${process.env.BOT_PREFIX || '! (default)'}
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
