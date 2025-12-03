# ========== ETAPA 1: CONSTRUCCIÓN ==========
FROM node:18-slim AS builder

# Instalar dependencias del sistema para Tesseract.js
RUN apt-get update && apt-get install -y \
    # Librerías gráficas para Tesseract
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
    # Herramientas de compilación
    build-essential \
    python3 \
    # Librerías para PDF y procesamiento
    poppler-utils \
    # Limpiar cache para reducir tamaño
    && rm -rf /var/lib/apt/lists/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json primero (para cache de dependencias)
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm ci --only=production

# ========== ETAPA 2: EJECUCIÓN ==========
FROM node:18-slim AS runner

# Instalar solo las librerías RUNTIME necesarias (más pequeñas)
RUN apt-get update && apt-get install -y \
    # Runtime de Tesseract
    libcairo2 \
    libjpeg62-turbo \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgif7 \
    librsvg2-2 \
    # Runtime para PDF
    poppler-utils \
    # Tesseract OCR engine y datos de idioma español
    tesseract-ocr \
    tesseract-ocr-spa \
    tesseract-ocr-eng \
    # Limpiar
    && rm -rf /var/lib/apt/lists/*

# Crear usuario no-root para seguridad
RUN groupadd -r mancy && useradd -r -g mancy -m -d /app mancy

# Cambiar a usuario no-root
USER mancy

# Crear directorios necesarios
RUN mkdir -p /app/uploads && chown mancy:mancy /app/uploads

WORKDIR /app

# Copiar node_modules desde la etapa de construcción
COPY --from=builder --chown=mancy:mancy /app/node_modules ./node_modules

# Copiar el resto de la aplicación
COPY --chown=mancy:mancy . .

# Exponer puerto
EXPOSE 10000

# Variables de entorno
ENV NODE_ENV=production \
    PORT=10000 \
    MAX_FILE_SIZE=10MB \
    UPLOADS_DIR=/app/uploads

# Comando de inicio
CMD ["node", "server.js"]