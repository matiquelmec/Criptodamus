# 🛡️ CRYPTOTRADING AI ADVISOR - RISK MANAGEMENT MODULE

Sistema de gestión de riesgos para trading de futuros de criptomonedas, implementando todas las reglas críticas del documento base.

## 🎯 OBJETIVO PRINCIPAL

**NO PERDER DINERO** - El sistema prioriza la protección del capital sobre las ganancias máximas.

## ⚡ INSTALACIÓN RÁPIDA

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# Ejecutar tests
npm test

# Desarrollo
npm run dev

# Producción
npm start
```

## 🛡️ FUNCIONALIDADES CRÍTICAS

### **1. Calculadora de Posición**
```javascript
POST /api/risk/calculate-position
{
  "accountBalance": 1000,
  "entryPrice": 50000,
  "stopLossPrice": 48000,
  "riskPercent": 2,
  "leverage": 10
}
```

**Validaciones implementadas:**
- ✅ Máximo 2-3% de riesgo por operación
- ✅ Control de apalancamiento (máx 20x)
- ✅ Cálculo automático de position size
- ✅ Verificación de capital suficiente

### **2. Calculadora de Take Profit**
```javascript
POST /api/risk/calculate-take-profit
{
  "entryPrice": 50000,
  "stopLossPrice": 48000,
  "riskRewardRatio": 2
}
```

**Características:**
- ✅ Ratio R/R mínimo 2:1
- ✅ Cálculo automático basado en distancia de SL
- ✅ Soporte para LONG y SHORT

### **3. Validador de Stop Loss**
```javascript
POST /api/risk/validate-stop-loss
{
  "entryPrice": 50000,
  "stopLossPrice": 48000,
  "supportLevel": 47500,
  "resistanceLevel": 52500
}
```

**Validaciones:**
- ✅ Ubicación lógica del SL
- ✅ Distancia adecuada de soportes/resistencias
- ✅ Control de riesgo por unidad (máx 10%)

### **4. Protección de Beneficios**
```javascript
POST /api/risk/check-breakeven
{
  "entryPrice": 50000,
  "currentPrice": 70000,
  "currentStopLoss": 48000,
  "profitThreshold": 40
}
```

**Funcionalidad:**
- ✅ Movimiento automático de SL a breakeven
- ✅ Activación con 40%+ de beneficio
- ✅ "Dormir tranquilo" con posiciones protegidas

### **5. Detector de Malas Rachas**
```javascript
POST /api/risk/check-trading-streak
{
  "recentTrades": [
    {"pnl": -50},
    {"pnl": -30},
    {"pnl": -40}
  ],
  "portfolioBalance": 850,
  "initialBalance": 1000
}
```

**Protecciones:**
- ✅ Alerta tras 3 pérdidas consecutivas
- ✅ Stop de emergencia con 20% de drawdown
- ✅ Recomendaciones de pausa

## 📊 CONFIGURACIÓN DEL SISTEMA

### **Variables de Entorno Críticas**
```bash
# Risk Management
DEFAULT_MAX_RISK_PER_TRADE=2     # 2% máximo por trade
DEFAULT_MAX_LEVERAGE=20          # 20x máximo
DEFAULT_MIN_RR_RATIO=2           # 2:1 mínimo
MAX_CONSECUTIVE_LOSSES=3         # Pausa tras 3 pérdidas
EMERGENCY_STOP_PERCENT=20        # Stop con 20% drawdown

# Trading
BREAKEVEN_PROFIT_THRESHOLD=40    # 40% para mover SL
```

## 🧪 TESTING EXHAUSTIVO

```bash
# Ejecutar todos los tests
npm test

# Tests con coverage
npm run test:coverage

# Tests en modo watch
npm run test:watch
```

**Cobertura actual:**
- ✅ Cálculo de posiciones (LONG/SHORT)
- ✅ Validaciones de seguridad
- ✅ Casos extremos y errores
- ✅ Integración completa
- ✅ Escenarios de uso real

## 📋 EJEMPLOS DE USO

### **Escenario 1: Setup de Trade BTC LONG**
```javascript
// 1. Calcular posición
const position = await fetch('/api/risk/calculate-position', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accountBalance: 1000,
    entryPrice: 50000,
    stopLossPrice: 48000,
    leverage: 10
  })
});

// 2. Validar Stop Loss
const validation = await fetch('/api/risk/validate-stop-loss', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entryPrice: 50000,
    stopLossPrice: 48000,
    supportLevel: 47500
  })
});

// 3. Calcular Take Profit
const takeProfit = await fetch('/api/risk/calculate-take-profit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entryPrice: 50000,
    stopLossPrice: 48000,
    riskRewardRatio: 2
  })
});
```

### **Escenario 2: Monitoreo de Trade Activo**
```javascript
// Verificar si mover SL a breakeven
const breakevenCheck = await fetch('/api/risk/check-breakeven', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    entryPrice: 50000,
    currentPrice: 70000,  // 40% ganancia
    currentStopLoss: 48000
  })
});

if (breakevenCheck.action === 'move_to_breakeven') {
  console.log('🛡️ MOVER STOP LOSS A BREAKEVEN');
  // Ejecutar en exchange
}
```

## 🔄 INTEGRACIÓN CON FRONTEND

```javascript
// React/React Native
import { RiskManagerAPI } from './api/riskManager';

const riskAPI = new RiskManagerAPI('http://localhost:3001');

// Calcular posición en tiempo real
const handleCalculatePosition = async () => {
  const result = await riskAPI.calculatePosition({
    accountBalance: user.balance,
    entryPrice: currentPrice,
    stopLossPrice: userStopLoss,
    leverage: selectedLeverage
  });

  if (result.success) {
    setPositionSize(result.data.positionSize);
    setRiskAmount(result.data.riskAmount);
  }
};
```

## 📊 LOGGING Y MONITOREO

El sistema registra todas las decisiones críticas:

```bash
# Logs disponibles
./logs/risk-decisions.log    # Decisiones de risk management
./logs/error.log            # Errores críticos
./logs/combined.log         # Log combinado
```

**Métricas monitoreadas:**
- 📊 Número de posiciones calculadas
- ⚠️ Alertas de riesgo activadas
- 🛡️ Protecciones de breakeven ejecutadas
- 🚨 Stops de emergencia activados

## 📊 **NUEVAS FUNCIONALIDADES - MARKET DATA**

### **APIs de Exchanges Integradas**
```javascript
// Obtener precio en tiempo real
GET /api/market/price/BTC/USDT

// Todos los precios
GET /api/market/prices

// Datos completos de mercado
GET /api/market/data/BTC/USDT

// Top cryptos por market cap
GET /api/market/top/20

// Datos macro (Fear & Greed Index)
GET /api/market/macro

// Datos de futuros (funding rate)
GET /api/market/futures/BTC/USDT

// Oportunidades de trading
GET /api/market/opportunities
```

### **Endpoint Integrado: Cálculo con Datos Reales**
```javascript
POST /api/market/calculate-with-live-data
{
  "symbol": "BTC/USDT",
  "accountBalance": 1000,
  "direction": "LONG",
  "riskPercent": 2,
  "leverage": 10
}

// Respuesta incluye:
// - Precio actual en tiempo real
// - Cálculo de posición optimizado
// - Stop Loss y Take Profit sugeridos
// - Análisis de mercado integrado
```

## 🚀 PRÓXIMOS PASOS

1. ✅ **Sistema de gestión de riesgos**
2. ✅ **APIs de exchanges (Binance) y datos de mercado**
3. **Módulo de análisis técnico** (RSI, Fibonacci, S/R)
4. **Sistema de alertas Telegram**
5. **Dashboard web/mobile**
6. **Backtesting**

## ⚠️ ADVERTENCIAS IMPORTANTES

- **SOLO DINERO QUE PUEDAS PERDER**: Este sistema no elimina el riesgo del trading
- **NO ENDEUDAMIENTO**: Jamás usar dinero prestado para trading
- **TESTS OBLIGATORIOS**: Siempre probar en demo antes de usar capital real
- **MONITOREO CONSTANTE**: El sistema requiere supervisión humana

## 📞 SOPORTE

Para bugs o mejoras, revisar:
1. Tests existentes en `/tests/`
2. Logs en `/logs/`
3. Configuración en `.env`
4. Documentación en `PROYECTO_MEMORIA.md`

---

**🎯 RECORDATORIO**: El objetivo principal es NO PERDER DINERO, no maximizar ganancias.