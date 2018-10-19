const memConfig = {
  defaultFrequencyPref: 8,
  frequencyOptions: [1, 3, 6, 8, 15, 30, 50],
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
    if (frequencyOptions.trim() === "") return gopher.config.frequencyOptions;
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
