let memConfig = {};

/**
 * Make config options available to helper methods
 * @param {object} memConfig Config options from
 */
function setConfig(newConfig) {
  for (let key in newConfig) {
    // assign without breaking memConfig reference
    memConfig[key] = newConfig[key];
  }
}

module.exports = {
  setConfig,
  memConfig
};
