const {
  getFrequencyOptions,
  getCurrentFrequencyPref
} = require("../lib/config");
const { getIntervalDescription } = require("../lib/ui-helpers");

module.exports = function(gopherApp) {
  gopherApp.onSettingsViewed(gopher => {
    const storedData = gopher.webhook.getExtensionData("mem", {});

    // User can restore defaults by setting settings text === "".
    function setDefaultValue(key, value) {
      if (!storedData[key] || String(storedData[key]).trim() === "") {
        storedData[key] = value;
      }
    }

    const settingsPage = gopher.webhook.settingsPage({
      namespace: "mem",
      title: "Memorization Settings",
      menuTitle: "Memorization"
    });

    setDefaultValue(
      "defaultFrequencyPref",
      String(getCurrentFrequencyPref(gopher))
    );
    settingsPage.input({
      name: "defaultFrequencyPref",
      title: "Default Frequency",
      placeholder: "Enter a default frequency",
      // defaultValue: getCurrentFrequencyPref(gopher), // <-- Works when empty string is an acceptable value
      helpText: `Start memorizations using this frequency`
    });

    setDefaultValue(
      "frequencyOptions",
      String(getFrequencyOptions(gopher).join(","))
    );
    settingsPage.input({
      name: "frequencyOptions",
      title: "Frequency Options",
      helpText: `Alternate memorization frequencies. (The "more" to "less" email buttons.) Add or modify spacing. Preview memorization schedules below after saving.`
    });

    settingsPage.submitButton({
      submitText: "Save Settings"
    });

    settingsPage.populate(storedData);

    const preferenceDescriptions = getFrequencyOptions(gopher)
      .map(pref => getIntervalDescription(pref))
      .join("\n\n");
    settingsPage.text(
      `**Frequency Option Schedules** \n\n${preferenceDescriptions}`
    );
  });

  gopherApp.beforeSettingsSaved(gopher => {
    const action = gopher.get("settings.url_params.action");
    // TODO: Validate numbers
    return true;
    // return {
    //   webhook: {
    //     status: "warning",
    //     message: "This is  a warning message"
    //   }
    // };
  });
};
