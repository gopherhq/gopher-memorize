let memConfig = {
  defaultFrequencyPref: 1,
  frequencyPrefOptions: [0.1, 0.2, 0.5, 1, 1.5, 2, 5],
  decayExponent: 2.5, // (reminderCount ^ decayExponent) * frequencyPref;
  namespace: "mem"
};

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
