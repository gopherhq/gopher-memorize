const { memConfig, getFrequencyOptions } = require("../lib/config");
const { getIntervalDescription } = require("../lib/ui-helpers");

module.exports = function(gopherApp) {
  gopherApp.onSettingsViewed(gopher => {
    const settingsPage = gopher.webhook.settingsPage({
      namespace: "mem",
      title: "Memorization Settings",
      menuTitle: "Memorization"
    });

    settingsPage.input({
      name: "defaultFrequencyPref",
      title: "Default Frequency",
      placeholder: "Enter a default frequency",
      defaultValue: String(memConfig.defaultFrequencyPref),
      helpText: `Start memorizations using this frequency`
    });

    settingsPage.input({
      name: "frequencyOptions",
      title: "Frequency Options",
      defaultValue: String(memConfig.frequencyOptions.join(",")),
      helpText: `Alternate memorization frequencies. (The "seldom" to "often" email buttons.)`
    });

    settingsPage.submitButton({
      submitText: "Save Settings"
    });

    settingsPage.populate(gopher.webhook.getExtensionData("mem"));

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
