# 🚀 CryptoTrading AI Advisor

Sistema avanzado de asesoría inteligente para trading de futuros de criptomonedas con análisis técnico automatizado y gestión de riesgos profesional.

## 📊 Estado del Proyecto

**✅ Backend**: 100% Completado (101 tests pasando)
**✅ Frontend**: SESIÓN 1 Completada (Foundation & Setup)
**🔄 En Desarrollo**: SESIÓN 2 - Dashboard Core

## 🏗️ Arquitectura del Sistema

```
cryptotrading-ai-advisor/
├── 📱 frontend-web/          # React 18 + TypeScript + Vite
├── 🖥️ backend/               # Node.js + Express API
├── 📚 docs/                  # Documentación
├── 🗄️ .claude/               # Configuración Claude Code
└── 📋 PROYECTO_MEMORIA.md    # Memoria técnica completa
```

## ⚡ Quick Start

### Backend (API Server)
```bash
cd backend
npm install
npm test          # 101 tests pasando ✅
npm run dev       # Puerto 3001
```

### Frontend (Dashboard Web)
```bash
cd frontend-web
npm install
npm run build     # Build exitoso ✅
npm run dev       # Puerto 3000 (auto-cambio a 3001 si ocupado)
```

## 🛠️ Stack Tecnológico

### Backend
- **Runtime**: Node.js + Express
- **Testing**: Jest (101 tests ✅)
- **APIs**: Binance, CoinMarketCap, Fear & Greed
- **WebSocket**: Tiempo real para precios
- **Risk Management**: Sistema completo de protección

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v3
- **State**: TanStack Query (React Query)
- **HTTP Client**: Axios
- **UI Components**: shadcn/ui base

## 🎯 Funcionalidades Implementadas

### ✅ Backend Completo (100%)
- **Risk Management**: Cálculo automático de posición, SL/TP óptimos
- **Market Data**: APIs integradas con datos en tiempo real
- **Technical Analysis**: RSI, Fibonacci, S/R, BBWP, patrones
- **Signal Generation**: Sistema de confluencia multi-indicador
- **Telegram Notifications**: Bot completo para alertas

### ✅ Frontend Foundation (SESIÓN 1)
- **Layout Profesional**: Header, Sidebar, Theme dark/light
- **API Integration**: 30+ endpoints configurados
- **Dashboard Base**: Cards estadísticas, health check
- **Responsive Design**: Mobile-first approach
- **TypeScript**: Tipado completo y seguro

## 📈 Próximos Desarrollos

### SESIÓN 2: Dashboard Core (Próximo)
- Panel de precios tiempo real con WebSocket
- Panel de señales trading con confluence visual
- Risk management widget interactivo

### SESIÓN 3: Features Avanzadas
- TradingView integration
- Análisis técnico visual avanzado
- Sistema de notificaciones real-time

### SESIÓN 4: Polish & Deploy
- UX/UI refinement
- Deploy a producción
- Documentación completa

## 🔧 Configuración de Desarrollo

### Variables de Entorno (.env)
```bash
# Backend
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/cryptotrading

# APIs (opcionales para desarrollo)
BINANCE_API_KEY=your_key
BINANCE_SECRET_KEY=your_secret
CMC_API_KEY=your_coinmarketcap_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

## 🧪 Testing

```bash
# Backend testing (101 tests)
cd backend
npm test

# Frontend build verification
cd frontend-web
npm run build
```

## 📊 Métricas de Calidad

- **Backend Tests**: 101/101 pasando ✅
- **Code Coverage**: Completa en módulos críticos
- **TypeScript**: 0 errores, tipado completo
- **Build**: Exitoso (313KB JS, 18KB CSS)
- **Performance**: Optimizado para producción

## 🤝 Contribución

### Estructura de Commits
- `feat:` Nueva funcionalidad
- `fix:` Corrección de bugs
- `docs:` Documentación
- `style:` Cambios de formato
- `refactor:` Refactoring de código
- `test:` Tests

### Workflow de Desarrollo
1. Feature branch desde `main`
2. Tests pasando
3. Pull request con review
4. Merge a `main`

## 📚 Documentación

- **Memoria Técnica**: `PROYECTO_MEMORIA.md` (28K+ líneas)
- **API Docs**: Swagger en `/api/docs` (próximamente)
- **Claude Code**: Configuración completa en `.claude/`

## 🔒 Seguridad

- API keys encriptadas
- Rate limiting implementado
- Validación de inputs
- No almacenamiento de claves privadas
- Logs sin información sensible

## 🚀 Deploy

### Frontend (Vercel/Netlify)
```bash
npm run build
# Deploy dist/ folder
```

### Backend (VPS/Cloud)
```bash
npm run build
npm start
```

## 📞 Soporte

- **Issues**: GitHub Issues
- **Docs**: Claude Code documentation
- **Status**: Sistema 100% funcional para desarrollo

---

**🎯 Objetivo**: Crear un sistema robusto que automatice el análisis técnico y la gestión de riesgos para trading de futuros de criptomonedas, priorizando siempre la protección del capital.

**⚠️ Disclaimer**: El trading de futuros es de alto riesgo. Usar solo con capital que estés dispuesto a perder.