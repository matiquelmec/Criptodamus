/**
 * SCRIPT DE VERIFICACIÓN DE CONECTIVIDAD
 * Prueba la comunicación entre frontend y backend
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001';

const tests = [
  {
    name: 'Health Check',
    endpoint: '/api/health',
    method: 'GET'
  },
  {
    name: 'Signals Top Movers',
    endpoint: '/api/signals/scan/top-movers',
    method: 'GET'
  },
  {
    name: 'Signal Generation',
    endpoint: '/api/signals/generate/BTCUSDT',
    method: 'POST',
    data: {
      timeframe: '4h',
      accountBalance: 10000
    }
  },
  {
    name: 'Signals Config',
    endpoint: '/api/signals/config',
    method: 'GET'
  },
  {
    name: 'Signals Stats',
    endpoint: '/api/signals/stats',
    method: 'GET'
  }
];

async function testEndpoint(test) {
  const { name, endpoint, method, data } = test;
  const url = `${API_BASE}${endpoint}`;

  try {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   URL: ${method} ${url}`);

    const start = Date.now();
    let response;

    if (method === 'GET') {
      response = await axios.get(url, { timeout: 10000 });
    } else if (method === 'POST') {
      response = await axios.post(url, data, { timeout: 10000 });
    }

    const duration = Date.now() - start;

    console.log(`✅ Success (${duration}ms)`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Data Type: ${typeof response.data}`);

    if (response.data) {
      if (response.data.success !== undefined) {
        console.log(`   Success Flag: ${response.data.success}`);
      }

      if (response.data.data) {
        console.log(`   Has Data: Yes (${typeof response.data.data})`);

        // Información específica por endpoint
        if (endpoint.includes('top-movers') && response.data.data.signals) {
          console.log(`   Signals Found: ${response.data.data.signals.length}`);
        }

        if (endpoint.includes('stats') && response.data.data.performance) {
          console.log(`   Signals Generated: ${response.data.data.performance.signalsGenerated}`);
        }
      }
    }

    return { success: true, duration, status: response.status };

  } catch (error) {
    console.log(`❌ Failed`);

    if (error.code === 'ECONNREFUSED') {
      console.log(`   Error: Backend no está ejecutándose en puerto 3001`);
    } else if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.statusText}`);
      if (error.response.data?.message) {
        console.log(`   Message: ${error.response.data.message}`);
      }
    } else {
      console.log(`   Error: ${error.message}`);
    }

    return { success: false, error: error.message };
  }
}

async function runConnectivityTests() {
  console.log('🚀 INICIANDO PRUEBAS DE CONECTIVIDAD');
  console.log('=====================================');

  const results = {
    total: tests.length,
    passed: 0,
    failed: 0,
    details: []
  };

  for (const test of tests) {
    const result = await testEndpoint(test);
    results.details.push({ ...test, result });

    if (result.success) {
      results.passed++;
    } else {
      results.failed++;
    }

    // Pausa entre tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📊 RESUMEN DE PRUEBAS');
  console.log('====================');
  console.log(`Total: ${results.total}`);
  console.log(`✅ Exitosas: ${results.passed}`);
  console.log(`❌ Fallidas: ${results.failed}`);
  console.log(`📈 Tasa de éxito: ${(results.passed / results.total * 100).toFixed(1)}%`);

  if (results.failed > 0) {
    console.log('\n⚠️  PROBLEMAS DETECTADOS:');
    results.details
      .filter(detail => !detail.result.success)
      .forEach(detail => {
        console.log(`   • ${detail.name}: ${detail.result.error}`);
      });

    console.log('\n🔧 POSIBLES SOLUCIONES:');
    console.log('   1. Verificar que el backend esté ejecutándose: npm run dev');
    console.log('   2. Confirmar puerto 3001 disponible');
    console.log('   3. Revisar configuración CORS en backend');
    console.log('   4. Verificar endpoints en routes/signals.js');
  } else {
    console.log('\n🎉 ¡TODAS LAS PRUEBAS EXITOSAS!');
    console.log('   El backend y los endpoints están funcionando correctamente.');
  }

  return results;
}

// Verificar si es ejecutado directamente
if (require.main === module) {
  runConnectivityTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Error ejecutando pruebas:', error.message);
      process.exit(1);
    });
}

module.exports = { runConnectivityTests, testEndpoint };