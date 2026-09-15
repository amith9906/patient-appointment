const { performance } = require('perf_hooks');
const doctorController = require('./src/controllers/doctorController');

async function testDirectTiming() {
  const req = {
    user: { id: 'u1', role: 'admin', hospitalId: 'h1', email: 'admin@local.test' },
    query: {}
  };
  const res = {
    statusCode: 200,
    json: function(data) {
      this.data = data;
      return this;
    },
    status: function(code) {
      this.statusCode = code;
      return this;
    }
  };

  console.log('--- STARTING DIRECT CONTROLLER INSTRUMENTATION TEST ---');
  const outerStart = performance.now();
  await doctorController.getAll(req, res);
  const outerEnd = performance.now();
  console.log(`Total Controller Execution Time: ${(outerEnd - outerStart).toFixed(2)}ms`);
  process.exit(0);
}

testDirectTiming().catch((err) => {
  console.error(err);
  process.exit(1);
});
