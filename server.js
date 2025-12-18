// ===============================
// Imports
// ===============================
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// utils
import { getFreeAPIs } from './src/utils/free-apis.js';
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
// App initialization
// ===============================
const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// Middlewares
// ===============================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (IMPORTANTE usar __dirname en Render)
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
    res.json({ success: true, data: apis });
  } catch (error) {
    console.error('Error en /api/free-apis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Chatbot
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // 1. Analyze user message
    const analysis = analyzeUserMessage(message);

    // 2. Integrate knowledge if needed
    const knowledge = await integrateKnowledge(message, analysis);

    // 3. Get response from Groq
    const groqResponse = await getGroqChatCompletion(message, knowledge);

    // 4. Final response
    res.json({
      success: true,
      message: groqResponse,
      analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error en /api/chat:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});

// Config check (no secrets exposed)
app.get('/api/config-check', (req, res) => {
  res.json({
    groqKey: process.env.GROQ_API_KEY ? '✓ Configurada' : '✗ No configurada',
    openaiKey: process.env.OPENAI_API_KEY ? '✓ Configurada' : '✗ No configurada',
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development'
  });
});

// ===============================
// 404 handler
// ===============================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  });
});

// ===============================
// Global error handler
// ===============================
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

// ===============================
// Start server
// ===============================
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en puerto ${PORT}`);
  console.log(`📁 Directorio base: ${__dirname}`);
  console.log(`🌍 URL local: http://localhost:${PORT}`);
  console.log(`🔧 Entorno: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
