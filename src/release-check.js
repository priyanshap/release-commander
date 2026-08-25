const fs = require('node:fs');

function isProductionReleaseAllowed() {
  const config = JSON.parse(
    fs.readFileSync('release.config.json', 'utf8')
  );
  return config.environment === 'production'
    && config.allowProductionRelease === true;
}

module.exports = { isProductionReleaseAllowed };
