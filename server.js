import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const app = express();
const PORT = process.env.PORT || 11000;

// Para usar __dirname con ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 1. Servir archivos estáticos de la raíz
app.use(express.static(__dirname));

// 2. Servir la carpeta 'public' si existe
app.use(express.static(join(__dirname, 'public')));

// 3. Ruta raíz: sirve tu index.html (no el JSON)
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

// 4. Mueve el endpoint de estado a /api/status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Mancy Bot Server',
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

// 5. Mantén el panel en /panel (opcional)
app.get('/panel', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Mancy Panel</title>
            <style>
                body { font-family: Arial; background: #111; color: white; padding: 20px; }
                h1 { color: #4CAF50; }
                .card { 
                    background: #222; 
                    padding: 15px; 
                    margin: 10px 0; 
                    border-radius: 8px;
                    border-left: 4px solid;
                }
                .success { border-left-color: #4CAF50; }
                .warning { border-left-color: #ff9800; }
                .danger { border-left-color: #f44336; }
            </style>
        </head>
        <body>
            <h1>🤖 Panel de Administración - Mancy Bot</h1>
            <div class="card ${process.env.DISCORD_BOT_TOKEN ? 'success' : 'danger'}">
                <h3>Discord Bot Token</h3>
                <p>${process.env.DISCORD_BOT_TOKEN ? '✅ Configurado' : '❌ NO configurado'}</p>
            </div>
            <div class="card ${process.env.GROQ_API_KEY ? 'success' : 'warning'}">
                <h3>Groq API Key</h3>
                <p>${process.env.GROQ_API_KEY ? '✅ Configurada' : '⚠️ Recomendada'}</p>
            </div>
            <div class="card success">
                <h3>Servidor Web</h3>
                <p>✅ Activo en puerto: ${PORT}</p>
                <p><a href="/" style="color: #4CAF50;">Ir al Control Principal</a></p>
            </div>
        </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`✅ Servidor funcionando en puerto ${PORT}`);
    console.log(`🔗 URL Principal: http://localhost:${PORT}`);
    console.log(`📊 Panel Admin: http://localhost:${PORT}/panel`);
    console.log(`📡 API Status: http://localhost:${PORT}/api/status`);
    
    console.log('\n🔍 Variables de entorno:');
    console.log(`   DISCORD_BOT_TOKEN: ${process.env.DISCORD_BOT_TOKEN ? '✅ Presente' : '❌ Faltante'}`);
    console.log(`   GROQ_API_KEY: ${process.env.GROQ_API_KEY ? '✅ Presente' : '❌ Faltante'}`);
    console.log(`   PORT: ${process.env.PORT || '11000 (default)'}`);
});
