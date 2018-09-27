const memConfig = {
  defaultFrequencyPref: 100,
  frequencyOptions: [1, 2, 3, 10, 20, 50, 100, 150, 200, 500],
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
