# 🤖 GUÍA DE MÚLTIPLES BOTS DE TELEGRAM

## 📋 Visión General

El sistema ahora soporta **múltiples bots de Telegram** que permiten separar diferentes tipos de notificaciones y organizar mejor la información. Esto te permite tener:

1. **Bot Principal** - Señales de trading críticas y alertas de riesgo
2. **Bot Secundario** - Análisis técnicos, reportes y notificaciones generales
3. **Bot de Desarrollo** - Mensajes de debug y testing

---

## 🏗️ Arquitectura del Sistema

### **Enrutamiento Inteligente**
```
📊 Señales Trading    → Bot Principal
🚨 Alertas de Riesgo  → Bot Principal
📈 Análisis Técnico   → Bot Secundario
📊 Reportes Diarios   → Bot Secundario
🧪 Debug/Testing      → Bot Dev
```

### **Fallbacks de Seguridad**
- Si un bot no está configurado, se usa el bot principal
- Si el bot principal no está configurado, se usa el sistema original
- Compatibilidad total con configuración anterior

---

## 🔧 CONFIGURACIÓN PASO A PASO

### **Paso 1: Crear los Bots en Telegram**

#### Bot Principal (Trading Signals)
1. Habla con **@BotFather** en Telegram
2. Envía: `/newbot`
3. Nombre: "TradingBot Principal"
4. Username: "tu_trading_principal_bot"
5. **Guarda el token** que te da

#### Bot Secundario (Analysis & Reports)
1. Crea otro bot con @BotFather
2. Nombre: "TradingBot Análisis"
3. Username: "tu_trading_analysis_bot"
4. **Guarda el token**

#### Bot de Desarrollo (opcional)
1. Crea un tercer bot para testing
2. Nombre: "TradingBot Dev"
3. Username: "tu_trading_dev_bot"
4. **Guarda el token**

### **Paso 2: Obtener Chat IDs**

#### Opción A: Para Chat Personal
1. Habla con **@userinfobot**
2. Envía `/start`
3. Copia tu **User ID**

#### Opción B: Para Grupo/Canal
1. Agrega el bot al grupo
2. Envía un mensaje cualquiera
3. Ve a: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Busca el **chat_id** en la respuesta

### **Paso 3: Configurar Variables de Entorno**

Edita `backend/.env` y agrega:

```bash
# ================================
# MÚLTIPLES BOTS TELEGRAM
# ================================

# Bot Principal (Señales de Trading y Alertas Críticas)
TELEGRAM_BOT_TOKEN_PRIMARY=1234567890:AABBCCddee_tu_token_principal_aqui
TELEGRAM_CHAT_ID_PRIMARY=123456789

# Bot Secundario (Análisis, Reportes y Notificaciones Generales)
TELEGRAM_BOT_TOKEN_SECONDARY=0987654321:FFGGHHiijj_tu_token_secundario_aqui
TELEGRAM_CHAT_ID_SECONDARY=987654321

# Bot de Desarrollo/Testing (Opcional)
TELEGRAM_BOT_TOKEN_DEV=1122334455:KKLLMMnnoo_tu_token_dev_aqui
TELEGRAM_CHAT_ID_DEV=555666777

# Compatibilidad (fallback - usar token principal aquí)
TELEGRAM_BOT_TOKEN=1234567890:AABBCCddee_tu_token_principal_aqui
TELEGRAM_CHAT_ID=123456789
```

### **Paso 4: Reiniciar el Servidor**

```bash
# El servidor se reiniciará automáticamente con nodemon
# O manualmente:
cd backend && npm run dev
```

---

## 🚀 USO DEL SISTEMA

### **APIs Disponibles**

#### **Configuración y Estado**
```bash
# Ver configuración actual
GET /api/multi-telegram/config

# Ver estadísticas de todos los bots
GET /api/multi-telegram/stats

# Probar conexión de todos los bots
POST /api/multi-telegram/test-connections
```

#### **Envío de Mensajes**
```bash
# Enviar señal de trading (Bot Principal)
POST /api/multi-telegram/send/signal
{
  "signal": {
    "symbol": "BTCUSDT",
    "direction": "long",
    "confluenceScore": 85,
    "entry": 45000,
    "stopLoss": 43000,
    "takeProfit": 49000
  }
}

# Enviar alerta de mercado
POST /api/multi-telegram/send/market-alert
{
  "alertType": "market_extreme",
  "data": {
    "symbol": "BTCUSDT",
    "type": "oversold",
    "value": "RSI 25",
    "severity": "high"
  }
}

# Enviar mensaje a bot específico
POST /api/multi-telegram/send/custom
{
  "bot": "secondary",
  "message": "📊 Análisis personalizado de BTC"
}

# Broadcast a todos los bots
POST /api/multi-telegram/broadcast
{
  "message": "🚨 Mensaje importante para todos"
}
```

#### **Reportes**
```bash
# Reporte diario (Bot Secundario)
POST /api/multi-telegram/send/daily-report
{
  "reportData": {
    "totalPnL": 5.2,
    "successfulTrades": 8,
    "totalTrades": 10,
    "winRate": 80
  }
}

# Reporte semanal (Bot Secundario)
POST /api/multi-telegram/send/weekly-report
{
  "reportData": {
    "weeklyPnL": 15.6,
    "totalTrades": 35,
    "winRate": 77.1,
    "maxDrawdown": 3.2
  }
}
```

### **Testing y Debug**
```bash
# Mensaje de debug (Bot Dev)
POST /api/multi-telegram/test/debug
{
  "message": "Testing new feature"
}

# Test a todos los bots
POST /api/multi-telegram/test/all-bots
{
  "message": "Prueba de conectividad"
}
```

---

## ⚙️ CONFIGURACIÓN AVANZADA

### **Personalizar Enrutamiento**

```bash
# Cambiar regla de enrutamiento
POST /api/multi-telegram/routing/set-rule
{
  "messageType": "market_analysis",
  "botName": "primary"
}

# Habilitar/deshabilitar enrutamiento
POST /api/multi-telegram/routing/toggle
{
  "enabled": false
}

# Cambiar bot por defecto
POST /api/multi-telegram/set-default-bot
{
  "botName": "secondary"
}
```

### **Reglas de Enrutamiento por Defecto**

| Tipo de Mensaje | Bot Asignado | Descripción |
|-----------------|--------------|-------------|
| `signal_alert` | Principal | Señales de trading |
| `risk_alert` | Principal | Alertas de riesgo |
| `position_update` | Principal | Updates de posiciones |
| `market_extreme` | Principal | Extremos de mercado |
| `market_analysis` | Secundario | Análisis técnico |
| `daily_report` | Secundario | Reportes diarios |
| `weekly_report` | Secundario | Reportes semanales |
| `system_alert` | Secundario | Alertas del sistema |
| `debug` | Dev | Mensajes de debug |
| `test` | Dev | Mensajes de prueba |

---

## 🔍 MONITOREO Y ESTADÍSTICAS

### **Verificar Estado**
```bash
curl http://localhost:3001/api/multi-telegram/stats
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "multiBot": {
      "totalBots": 3,
      "activeBots": 2,
      "routingEnabled": true,
      "defaultBot": "primary"
    },
    "bots": {
      "primary": {
        "messagesSent": 45,
        "messagesSuccess": 43,
        "messagesFailed": 2,
        "successRate": "95.6%",
        "enabled": true
      },
      "secondary": {
        "messagesSent": 23,
        "messagesSuccess": 23,
        "messagesFailed": 0,
        "successRate": "100.0%",
        "enabled": true
      },
      "dev": {
        "messagesSent": 5,
        "messagesSuccess": 5,
        "messagesFailed": 0,
        "successRate": "100.0%",
        "enabled": false
      }
    }
  }
}
```

---

## 🎯 CASOS DE USO RECOMENDADOS

### **Configuración Básica (2 Bots)**
```bash
# Bot Principal - Solo trading crítico
TELEGRAM_BOT_TOKEN_PRIMARY=tu_token_principal
TELEGRAM_CHAT_ID_PRIMARY=tu_chat_principal

# Bot Secundario - Todo lo demás
TELEGRAM_BOT_TOKEN_SECONDARY=tu_token_secundario
TELEGRAM_CHAT_ID_SECONDARY=tu_chat_secundario
```

**Ventajas:**
- ✅ Separación clara entre trading y análisis
- ✅ Chat principal solo con señales importantes
- ✅ Chat secundario con análisis detallados

### **Configuración Avanzada (3 Bots)**
```bash
# Principal - Trading signals
# Secundario - Analysis & reports
# Dev - Testing & debug
```

**Ventajas:**
- ✅ Máxima organización
- ✅ Testing sin interrumpir producción
- ✅ Debug separado del trading

### **Configuración por Grupos**
```bash
# Bot Principal → Grupo "Trading Signals"
# Bot Secundario → Grupo "Market Analysis"
# Bot Dev → Chat personal
```

**Ventajas:**
- ✅ Notificaciones a diferentes audiencias
- ✅ Colaboración en equipo
- ✅ Histórico organizado por tema

---

## 🛠️ MIGRACIÓN DESDE CONFIGURACIÓN ANTERIOR

### **Sin Cambios Necesarios**
Tu configuración actual seguirá funcionando:
```bash
TELEGRAM_BOT_TOKEN=tu_token_actual
TELEGRAM_CHAT_ID=tu_chat_actual
```

### **Migración Gradual**
1. **Mantén** tu configuración actual
2. **Agrega** nuevos bots según necesites:
   ```bash
   # Tu config actual (seguirá funcionando)
   TELEGRAM_BOT_TOKEN=token_actual
   TELEGRAM_CHAT_ID=chat_actual

   # Nuevos bots (opcionales)
   TELEGRAM_BOT_TOKEN_SECONDARY=nuevo_token
   TELEGRAM_CHAT_ID_SECONDARY=nuevo_chat
   ```
3. **El sistema usa** tu configuración actual como bot principal
4. **Nuevas funciones** usan los bots adicionales

---

## 🧪 TESTING

### **Test de Conectividad**
```bash
# Probar todos los bots
curl -X POST http://localhost:3001/api/multi-telegram/test-connections

# Enviar mensaje de prueba
curl -X POST http://localhost:3001/api/multi-telegram/test/all-bots \
  -H "Content-Type: application/json" \
  -d '{"message": "Test desde API"}'
```

### **Test de Enrutamiento**
```bash
# Enviar señal de trading (debería ir al bot principal)
curl -X POST http://localhost:3001/api/multi-telegram/send/signal \
  -H "Content-Type: application/json" \
  -d '{
    "signal": {
      "symbol": "BTCUSDT",
      "direction": "long",
      "confluenceScore": 85,
      "entry": 45000,
      "stopLoss": 43000,
      "takeProfit": 49000
    }
  }'
```

---

## 📊 VENTAJAS DEL SISTEMA MULTI-BOT

### **Organización**
- ✅ **Separación clara** entre tipos de mensajes
- ✅ **Chat principal limpio** solo con trading
- ✅ **Análisis detallados** en chat separado

### **Productividad**
- ✅ **Sin interrupciones** por mensajes no críticos
- ✅ **Historiales especializados** por tema
- ✅ **Búsqueda más fácil** de información específica

### **Escalabilidad**
- ✅ **Diferentes audiencias** para diferentes bots
- ✅ **Trabajo en equipo** con grupos especializados
- ✅ **Testing sin interferir** producción

### **Flexibilidad**
- ✅ **Configuración gradual** sin romper lo existente
- ✅ **Enrutamiento personalizable** según necesidades
- ✅ **Fallbacks automáticos** si algo falla

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### **Bot no recibe mensajes**
1. Verificar token y chat ID correctos
2. Verificar que el bot esté configurado como `enableNotifications: true`
3. Probar conexión: `POST /api/multi-telegram/test-connections`

### **Enrutamiento no funciona**
1. Verificar que `routingEnabled: true`
2. Revisar reglas de enrutamiento: `GET /api/multi-telegram/config`
3. Verificar logs del servidor para errores

### **Fallback al bot principal**
Es normal si:
- El bot específico no está configurado
- El bot específico no tiene `enableNotifications: true`
- Hay un error temporal con el bot

---

**🚀 ¡Tu sistema multi-bot está listo para usar!**

El enrutamiento inteligente llevará cada mensaje al bot correcto, manteniendo tu experiencia de trading organizada y eficiente.