const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '..', '.test-build');
fs.writeFileSync(path.join(output, 'package.json'), JSON.stringify({ type: 'commonjs' }));
require('./smoke.cjs');
