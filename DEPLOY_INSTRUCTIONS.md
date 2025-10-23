# 🚀 DEPLOY INSTRUCTIONS - SUPER SIMPLE

## Paso 1: Subir vercel.json
```bash
git add vercel.json
git commit -m "Add Vercel configuration"
git push origin master
```

## Paso 2: Deploy en Vercel
1. Ve a: https://vercel.com/new
2. Click "Import Git Repository"
3. Selecciona: matiquelmec/Criptodamus
4. Configuración automática:
   - Framework: Other
   - Root Directory: frontend-web
   - Build Command: npm run build
   - Output Directory: dist

## Paso 3: Variables de Entorno
En Vercel Dashboard > Settings > Environment Variables:
- VITE_API_URL = https://criptodamus.vercel.app
- NODE_ENV = production

## Paso 4: Deploy
Click "Deploy" y esperar 2-3 minutos

## URLs finales:
- Frontend: https://criptodamus.vercel.app
- API: https://criptodamus.vercel.app/api/health

## 🎯 Test URLs:
- https://criptodamus.vercel.app/api/signals/scan/top-movers
- https://criptodamus.vercel.app/api/averaging/analyze/BTCUSDT

¡Listo! Sistema funcionando 24/7 🚀