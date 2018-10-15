const memConfig = {
  defaultFrequencyPref: 100,
  frequencyOptions: [10, 20, 50, 100, 150, 200, 500],
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

/**
 * Get frequency options from webhook or general config
 * @param {object} gopher
 */
function getFrequencyOptions(gopher) {
  const frequencyOptions = gopher.webhook.getExtensionData(
    "mem.frequencyOptions",
    gopher.config.frequencyOptions
  );
  if (typeof frequencyOptions === "string") {
    return frequencyOptions.split(",");
  } else if (frequencyOptions instanceof Array) {
    return frequencyOptions;
  } else {
    console.warn(
      "Frequency Options preference was an unsupported type: " +
        typeof frequencyOptions +
        "Returning default frequency options"
    );
    return gopher.config.frequencyOptions;
  }
}

// Get the tasks' current frequency preference
function getCurrentFrequencyPref(gopher) {
  const defaultFrequencyPref =
    gopher.webhook.getExtensionData("mem.defaultFrequencyPref") ||
    memConfig.defaultFrequencyPref;

  return gopher.webhook.getTaskData("mem.frequency_pref", defaultFrequencyPref);
}

module.exports = {
  getFrequencyOptions,
  getCurrentFrequencyPref,
  setConfig,
  memConfig
};
