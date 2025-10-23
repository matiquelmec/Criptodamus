#!/usr/bin/env node

// 🤖 Script de Configuración Rápida para Múltiples Bots de Telegram

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(`
🤖 CONFIGURACIÓN DE MÚLTIPLES BOTS DE TELEGRAM
==============================================

Este script te ayudará a configurar hasta 3 bots de Telegram:

1. 🎯 Bot Principal   - Señales de trading y alertas críticas
2. 📊 Bot Secundario  - Análisis técnicos y reportes
3. 🧪 Bot Desarrollo  - Testing y debug (opcional)

📋 Antes de continuar, asegúrate de tener:
• Los tokens de los bots creados con @BotFather
• Los chat IDs donde quieres recibir mensajes

¿Quieres continuar? (y/n): `);

rl.question('', async (answer) => {
  if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
    console.log('❌ Configuración cancelada.');
    rl.close();
    return;
  }

  console.log('\n🚀 Iniciando configuración...\n');
  await configureMultipleBots();
});

async function configureMultipleBots() {
  const config = {};

  console.log('🎯 BOT PRINCIPAL (Señales de Trading)');
  console.log('📖 Este bot recibirá: señales de trading, alertas de riesgo, extremos de mercado');
  await askQuestion('   Token del Bot Principal: ', (answer) => {
    config.TELEGRAM_BOT_TOKEN_PRIMARY = answer;
  });

  await askQuestion('   Chat ID Principal: ', (answer) => {
    config.TELEGRAM_CHAT_ID_PRIMARY = answer;
  });

  console.log('\n📊 BOT SECUNDARIO (Análisis y Reportes)');
  console.log('📖 Este bot recibirá: análisis técnicos, reportes diarios/semanales, alertas del sistema');
  await askQuestion('   Token del Bot Secundario: ', (answer) => {
    config.TELEGRAM_BOT_TOKEN_SECONDARY = answer;
  });

  await askQuestion('   Chat ID Secundario: ', (answer) => {
    config.TELEGRAM_CHAT_ID_SECONDARY = answer;
  });

  console.log('\n🧪 BOT DE DESARROLLO (Opcional)');
  console.log('📖 Este bot recibirá: mensajes de debug, testing, desarrollo');
  await askQuestion('   ¿Configurar Bot de Desarrollo? (y/n): ', async (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      await askQuestion('     Token del Bot Dev: ', (answer) => {
        config.TELEGRAM_BOT_TOKEN_DEV = answer;
      });
      await askQuestion('     Chat ID Dev: ', (answer) => {
        config.TELEGRAM_CHAT_ID_DEV = answer;
      });
    }
  });

  console.log('\n🔄 COMPATIBILIDAD');
  console.log('📖 Para mantener compatibilidad con la configuración anterior');
  await askQuestion('   ¿Usar Bot Principal como fallback? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      config.TELEGRAM_BOT_TOKEN = config.TELEGRAM_BOT_TOKEN_PRIMARY;
      config.TELEGRAM_CHAT_ID = config.TELEGRAM_CHAT_ID_PRIMARY;
    }
  });

  // Escribir configuración
  await writeConfiguration(config);
}

function askQuestion(question, callback) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      callback(answer);
      resolve();
    });
  });
}

async function writeConfiguration(config) {
  const envPath = path.join(__dirname, 'backend', '.env');

  try {
    // Leer archivo .env actual
    let envContent = fs.readFileSync(envPath, 'utf8');

    console.log('\n📝 Actualizando configuración...');

    // Agregar sección de múltiples bots
    const multiBotSection = `

# ================================
# MÚLTIPLES BOTS TELEGRAM - CONFIGURADO AUTOMÁTICAMENTE
# ================================

# Bot Principal (Señales de Trading y Alertas Críticas)
TELEGRAM_BOT_TOKEN_PRIMARY=${config.TELEGRAM_BOT_TOKEN_PRIMARY || ''}
TELEGRAM_CHAT_ID_PRIMARY=${config.TELEGRAM_CHAT_ID_PRIMARY || ''}

# Bot Secundario (Análisis, Reportes y Notificaciones Generales)
TELEGRAM_BOT_TOKEN_SECONDARY=${config.TELEGRAM_BOT_TOKEN_SECONDARY || ''}
TELEGRAM_CHAT_ID_SECONDARY=${config.TELEGRAM_CHAT_ID_SECONDARY || ''}

# Bot de Desarrollo/Testing (Opcional)
TELEGRAM_BOT_TOKEN_DEV=${config.TELEGRAM_BOT_TOKEN_DEV || ''}
TELEGRAM_CHAT_ID_DEV=${config.TELEGRAM_CHAT_ID_DEV || ''}
`;

    // Actualizar variables existentes
    Object.keys(config).forEach(key => {
      if (config[key]) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        const newLine = `${key}=${config[key]}`;

        if (envContent.match(regex)) {
          envContent = envContent.replace(regex, newLine);
        }
      }
    });

    // Agregar sección de múltiples bots al final
    envContent += multiBotSection;

    // Escribir archivo actualizado
    fs.writeFileSync(envPath, envContent);

    console.log('\n✅ Configuración guardada exitosamente!');

    // Mostrar resumen
    console.log('\n📋 RESUMEN DE CONFIGURACIÓN:');
    console.log('=====================================');

    if (config.TELEGRAM_BOT_TOKEN_PRIMARY) {
      console.log('🎯 Bot Principal: ✅ Configurado');
      console.log(`   - Recibirá: Señales trading, alertas de riesgo`);
    }

    if (config.TELEGRAM_BOT_TOKEN_SECONDARY) {
      console.log('📊 Bot Secundario: ✅ Configurado');
      console.log(`   - Recibirá: Análisis técnicos, reportes`);
    }

    if (config.TELEGRAM_BOT_TOKEN_DEV) {
      console.log('🧪 Bot Desarrollo: ✅ Configurado');
      console.log(`   - Recibirá: Debug, testing`);
    }

    console.log('\n🚀 PRÓXIMOS PASOS:');
    console.log('==================');
    console.log('1. El servidor se reiniciará automáticamente');
    console.log('2. Verifica las conexiones: curl http://localhost:3001/api/multi-telegram/stats');
    console.log('3. Prueba los bots: curl -X POST http://localhost:3001/api/multi-telegram/test/all-bots');
    console.log('4. Lee la documentación: MULTI_TELEGRAM_GUIDE.md');

    console.log('\n🔧 APIs DISPONIBLES:');
    console.log('====================');
    console.log('• GET  /api/multi-telegram/config       - Ver configuración');
    console.log('• GET  /api/multi-telegram/stats        - Ver estadísticas');
    console.log('• POST /api/multi-telegram/send/signal  - Enviar señal trading');
    console.log('• POST /api/multi-telegram/broadcast    - Mensaje a todos');

    console.log('\n🎯 ENRUTAMIENTO AUTOMÁTICO:');
    console.log('============================');
    console.log('• Señales trading     → Bot Principal');
    console.log('• Alertas de riesgo   → Bot Principal');
    console.log('• Análisis técnicos   → Bot Secundario');
    console.log('• Reportes diarios    → Bot Secundario');
    console.log('• Debug/Testing       → Bot Desarrollo');

  } catch (error) {
    console.error('\n❌ Error al escribir configuración:', error.message);
    console.log('\n🛠️  Configuración manual requerida:');
    console.log('====================================');
    console.log('Edita el archivo backend/.env y agrega:');
    console.log('');
    Object.keys(config).forEach(key => {
      if (config[key]) {
        console.log(`${key}=${config[key]}`);
      }
    });
  }

  rl.close();
}

// Test de conectividad automático
async function testConnections() {
  console.log('\n🧪 Probando conexiones...');

  try {
    const response = await fetch('http://localhost:3001/api/multi-telegram/test-connections', {
      method: 'POST'
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Test de conexiones completado');
      console.log('📊 Resultados disponibles en: /api/multi-telegram/stats');
    } else {
      console.log('⚠️ Algunas conexiones fallaron - revisa la configuración');
    }
  } catch (error) {
    console.log('⏳ El servidor está reiniciando - prueba las conexiones manualmente en unos segundos');
  }
}

process.on('SIGINT', () => {
  console.log('\n❌ Configuración cancelada.');
  rl.close();
  process.exit(0);
});

// Agregar test automático después de 3 segundos
setTimeout(async () => {
  if (rl.closed) {
    await testConnections();
  }
}, 3000);