# 🔧 GUÍA DE CONFIGURACIÓN DE VARIABLES DE ENTORNO

## 📋 Estado Actual

✅ **Backend .env**: Configurado con valores base de desarrollo
✅ **Frontend .env**: URLs configuradas correctamente
⚠️ **APIs Faltantes**: Se necesitan API keys para funcionalidad completa

---

## 🚀 CONFIGURACIÓN RÁPIDA (Recomendada)

### Paso 1: APIs GRATUITAS Esenciales

#### 1. 🪙 **CoinMarketCap API** (GRATIS - 10,000 calls/mes)
```bash
# 1. Ve a: https://coinmarketcap.com/api/
# 2. Regístrate gratis
# 3. Ve a "API Keys" y copia tu key
# 4. Agrega al backend/.env:
CMC_API_KEY=tu_key_aqui
```

#### 2. 📱 **Telegram Bot** (GRATIS) - ¡AHORA CON MÚLTIPLES BOTS!

**Opción A: Configuración Simple (1 Bot)**
```bash
# 1. Habla con @BotFather en Telegram
# 2. Usa /newbot y sigue instrucciones
# 3. Copia el token del bot
# 4. Obtén tu chat ID enviando /start a @userinfobot
# 5. Agrega al backend/.env:
TELEGRAM_BOT_TOKEN=1234567890:AABBCCddee_token_completo_aqui
TELEGRAM_CHAT_ID=123456789
```

**Opción B: Múltiples Bots (RECOMENDADO)**
```bash
# 🤖 SISTEMA MULTI-BOT para mejor organización:

# Bot Principal - Señales de trading críticas
TELEGRAM_BOT_TOKEN_PRIMARY=token_bot_principal_aqui
TELEGRAM_CHAT_ID_PRIMARY=chat_principal_aqui

# Bot Secundario - Análisis y reportes
TELEGRAM_BOT_TOKEN_SECONDARY=token_bot_secundario_aqui
TELEGRAM_CHAT_ID_SECONDARY=chat_secundario_aqui

# Configuración automática con script:
node setup-multi-telegram.js
```

**📚 Documentación completa:** [MULTI_TELEGRAM_GUIDE.md](./MULTI_TELEGRAM_GUIDE.md)

### Paso 2: APIs OPCIONALES (Para trading real)

#### 3. 📈 **Binance API** (Opcional - Solo para trading real)
```bash
# ⚠️ SOLO si vas a hacer trading real
# 1. Ve a: https://www.binance.com/en/my/settings/api-management
# 2. Crea API key (Spot & Futures)
# 3. Agrega al backend/.env:
BINANCE_API_KEY=tu_api_key_aqui
BINANCE_SECRET_KEY=tu_secret_key_aqui
```

---

## 🛠️ CONFIGURACIÓN PASO A PASO

### Backend - Archivo: `backend/.env`

```bash
# ================================
# 🔥 CONFIGURACIÓN MÍNIMA PARA TESTING
# ================================

# CoinMarketCap API (OBLIGATORIO para datos de mercado)
CMC_API_KEY=tu_coinmarketcap_key_aqui

# Telegram Bot (RECOMENDADO para alertas)
TELEGRAM_BOT_TOKEN=tu_telegram_bot_token_aqui
TELEGRAM_CHAT_ID=tu_telegram_chat_id_aqui

# ================================
# 🚀 CONFIGURACIÓN AVANZADA (Opcional)
# ================================

# Binance API (Solo para trading real)
BINANCE_API_KEY=tu_binance_api_key_aqui
BINANCE_SECRET_KEY=tu_binance_secret_key_aqui

# MongoDB (Si quieres persistencia)
MONGODB_URI=mongodb://localhost:27017/cryptotrading
```

### Frontend - Archivo: `frontend-web/.env`

```bash
# ✅ YA CONFIGURADO CORRECTAMENTE
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

---

## 🔑 OBTENCIÓN DE API KEYS

### 1. CoinMarketCap API (GRATIS)

1. **Regístrate:** https://coinmarketcap.com/api/
2. **Plan Gratuito:** 10,000 calls/mes
3. **Copia tu key:** Dashboard → API Keys
4. **Pega en .env:**
   ```bash
   CMC_API_KEY=12345678-1234-1234-1234-123456789abc
   ```

### 2. Telegram Bot (GRATIS)

1. **Crear Bot:**
   - Habla con @BotFather en Telegram
   - Envía: `/newbot`
   - Elige nombre y username
   - Copia el token

2. **Obtener Chat ID:**
   - Habla con @userinfobot
   - Envía: `/start`
   - Copia tu user ID

3. **Configurar:**
   ```bash
   TELEGRAM_BOT_TOKEN=1234567890:AABBCC_token_completo_del_bot
   TELEGRAM_CHAT_ID=123456789
   ```

### 3. Binance API (Opcional)

⚠️ **Solo para trading real con dinero real**

1. **Regístrate:** https://www.binance.com/
2. **Ve a:** Account → API Management
3. **Crear API Key:**
   - Habilita: Spot & Margin Trading
   - Habilita: Futures Trading (si usas futuros)
   - Restricción IP: Agrega tu IP para seguridad
4. **Configurar:**
   ```bash
   BINANCE_API_KEY=tu_api_key_de_64_caracteres
   BINANCE_SECRET_KEY=tu_secret_key_de_64_caracteres
   ```

---

## 🎯 CONFIGURACIÓN RECOMENDADA POR FASE

### FASE 1: Testing Básico (Actual)
```bash
# Solo estas 2 APIs:
CMC_API_KEY=tu_coinmarketcap_key
TELEGRAM_BOT_TOKEN=tu_telegram_token
TELEGRAM_CHAT_ID=tu_chat_id
```

### FASE 2: Trading Demo
```bash
# Agregar Binance Testnet:
BINANCE_API_KEY=testnet_api_key
BINANCE_SECRET_KEY=testnet_secret_key
# + las APIs de FASE 1
```

### FASE 3: Trading Real
```bash
# Binance APIs reales:
BINANCE_API_KEY=real_api_key
BINANCE_SECRET_KEY=real_secret_key
# + MongoDB para persistencia
MONGODB_URI=mongodb://localhost:27017/cryptotrading
```

---

## ⚡ CONFIGURACIÓN RÁPIDA

### Script de Configuración Automática

```bash
# 1. Copia este template al backend/.env:
cat > backend/.env << 'EOF'
# CONFIGURACIÓN MÍNIMA
NODE_ENV=development
PORT=3001

# RISK MANAGEMENT
DEFAULT_MAX_RISK_PER_TRADE=2
DEFAULT_MAX_LEVERAGE=20
DEFAULT_MIN_RR_RATIO=2

# APIs ESENCIALES (COMPLETAR)
CMC_API_KEY=AQUI_TU_COINMARKETCAP_KEY
TELEGRAM_BOT_TOKEN=AQUI_TU_TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=AQUI_TU_TELEGRAM_CHAT_ID

# CONFIGURACIÓN DE DESARROLLO
DEBUG_MODE=true
LOG_LEVEL=info
EOF

# 2. Edita el archivo y completa las APIs
```

---

## 🧪 TESTING DE CONFIGURACIÓN

### Verificar APIs:

```bash
# 1. Reiniciar backend
cd backend && npm run dev

# 2. Verificar logs - deberías ver:
# ✅ CoinMarketCap API conectada
# ✅ Telegram Bot configurado
# ✅ Datos de mercado cargándose

# 3. Test manual:
curl http://localhost:3001/api/market/macro
# Debe devolver Fear & Greed Index
```

---

## 🔒 SEGURIDAD

### ⚠️ IMPORTANTES:

1. **Nunca commitees** las API keys al repositorio
2. **Usa .env** siempre para keys sensibles
3. **Restricción IP** en Binance API
4. **Permisos mínimos** en todas las APIs
5. **Revisa logs** regularmente

### 🛡️ Backup de Configuración:

```bash
# Respaldar configuración (sin keys sensibles)
cp backend/.env backend/.env.backup
```

---

## 🚨 SOLUCIÓN DE PROBLEMAS

### Problema: "API key not configured"
**Solución:** Verifica que la key esté en .env y reinicia el servidor

### Problema: "Invalid API key"
**Solución:** Regenera la key en el dashboard del proveedor

### Problema: "Rate limit exceeded"
**Solución:** Espera el reset o cambia a plan premium

### Problema: Telegram bot no responde
**Solución:** Verifica que el bot esté iniciado (/start)

---

## 🎉 RESULTADO ESPERADO

Con las APIs configuradas correctamente:

✅ **Panel de Precios**: Datos reales de CoinMarketCap
✅ **Fear & Greed**: Índice actualizado diariamente
✅ **Notificaciones**: Alertas automáticas por Telegram
✅ **Trading Signals**: Generación basada en datos reales
✅ **Risk Management**: Cálculos precisos con datos live

---

**🚀 ¡Listo! Tu sistema estará completamente funcional con datos reales.**