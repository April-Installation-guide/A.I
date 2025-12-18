import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// CORRECTO: Importaciones desde la raíz del proyecto (sin el /src extra)
// Todas las rutas deben empezar con ./ porque están en la misma carpeta base

// Importación de utils/
import { getFreeAPIs } from './utils/free-apis.js';
import { analyzeUserMessage } from './utils/knowledge-detector.js';

// Importación de services/
import { getGroqChatCompletion } from './services/groq-enhanced.js';
import { integrateKnowledge } from './services/knowledge-integration.js';

// Importación de config/
import { API_KEYS } from './config/constants.js';

// Configuración para ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurar variables de entorno
dotenv.config();

// Crear aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde la carpeta public
app.use(express.static('public'));

// Ruta principal - servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ruta de ejemplo para probar free-apis.js
app.get('/api/free-apis', async (req, res) => {
    try {
        const apis = await getFreeAPIs();
        res.json({ success: true, data: apis });
    } catch (error) {
        console.error('Error en /api/free-apis:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Ruta para el chatbot (ejemplo)
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Message is required' 
            });
        }

        // 1. Analizar el mensaje del usuario
        const analysis = analyzeUserMessage(message);
        
        // 2. Integrar conocimiento si es necesario
        const knowledge = await integrateKnowledge(message, analysis);
        
        // 3. Obtener respuesta de Groq
        const groqResponse = await getGroqChatCompletion(message, knowledge);
        
        // 4. Formatear respuesta
        const response = {
            success: true,
            message: groqResponse,
            analysis: analysis,
            timestamp: new Date().toISOString()
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('Error en /api/chat:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Ruta de salud para verificar que el servidor funciona
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
    });
});

// Ruta para verificar variables de entorno (sin exponer valores reales)
app.get('/api/config-check', (req, res) => {
    res.json({
        groqKey: process.env.GROQ_API_KEY ? '✓ Configurada' : '✗ No configurada',
        openaiKey: process.env.OPENAI_API_KEY ? '✓ Configurada' : '✗ No configurada',
        port: PORT,
        nodeEnv: process.env.NODE_ENV || 'development'
    });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Ruta no encontrada'
    });
});

// Middleware de manejo de errores global
app.use((err, req, res, next) => {
    console.error('Error global:', err);
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'Error interno del servidor' 
            : err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en puerto ${PORT}`);
    console.log(`📁 Directorio actual: ${__dirname}`);
    console.log(`🌍 URL: http://localhost:${PORT}`);
    console.log(`🔧 Entorno: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
