const _ = require("lodash");
const sharedConfig = require("./lib/config");
const memConfig = sharedConfig.memConfig;
const { getNextInterval } = require("./lib/date-helpers");
const {
  memorizationControls,
  didYouRemember,
  changeFrequencyButtonsWithChart
} = require("./lib/ui-helpers");

module.exports = function(gopherApp, instanceConfig) {
  /**
   * Set up config
   */
  Object.assign(gopherApp.config, memConfig, instanceConfig);

  sharedConfig.setConfig(gopherApp.config); // Share config with helpers
  // gopherApp.config = sharedConfig.memConfig; // Share with gopherApp

  gopherApp.onSettingsViewed(gopher => {
    const settingsForm = gopher.webhook.settingsForm({
      namespace: "mem",
      title: "Memorization Settings"
    });

    settingsForm.input({
      name: "defaultFrequencyPref",
      title: "Default Frequency",
      placeholder: "Enter a default frequency",
      defaultValue: memConfig.defaultFrequencyPref,
      helpText: `Start memorizations using this frequency`
    });

    settingsForm.input({
      name: "frequencyOptions",
      title: "Frequency Options",
      defaultValue: memConfig.frequencyOptions.join(","),
      helpText: `Alternate memorization frequencies. (The "seldom" to "often" email buttons.)`
    });

    settingsForm.submitButton({
      submitText: "Save Settings"
    });

    settingsForm.populate(gopher.webhook.getExtensionData("mem"));

    //     settingsForm.text(`
    // **Memorization Summary**
    // Here are your current memorization options, with **1** being the default for all new memorizations. Change settings above to adjust these settings.
    // **0.1** – 3 days, 6 days, 12 days
    // **0.2** – 5 days, 8 days, 12 days
    // **0.5** – 5 days, 8 days, 12 days
    // **1** – 5 days, 8 days, 12 days
    // **1.5** – 5 days, 8 days, 12 days
    // **2** – 5 days, 8 days, 12 days
    // **5** – 5 days, 8 days, 12 days
    // `);
  });

  gopherApp.beforeSettingsSaved(gopher => {
    const action = gopher.get("settings.url_params.action");
    // TODO: Validate numbers
    return {
      webhook: {
        status: "warning",
        message: "This is  a warning message"
      }
    };
  });

  /**
   * Start memorizing task
   * Call from within a handler.
   * @param {object} gopher
   */
  function memorizeTask(gopher) {
    const reminderCount = gopher.webhook.getTaskData("mem.reminder_count", 0);
    const defaultFrequencyPref =
      gopher.webhook.getExtensionData("mem.defaultFrequencyPref") ||
      memConfig.defaultFrequencyPref;
    const frequencyPref = gopher.webhook.getTaskData(
      "mem.frequency_pref",
      defaultFrequencyPref
    );
    gopher.webhook.setTaskData("mem.reminder_count", reminderCount + 1);
    gopher.webhook.setTaskData("mem.frequency_pref", frequencyPref);
    const nextReminder = getNextInterval(reminderCount, frequencyPref);
    gopher.webhook.setTriggerTimestamp(nextReminder);
    return nextReminder;
  }

  /**
   * Render UI to show and change memorization frequency
   * @param {object} gopher
   */
  function renderMemorizationControls(gopher) {
    const reminderCount = gopher.webhook.getTaskData("mem.reminder_count", 1);
    const defaultFrequencyPref =
      gopher.webhook.getExtensionData("mem.defaultFrequencyPref") ||
      memConfig.defaultFrequencyPref;

    const frequencyPref = gopher.webhook.getTaskData(
      "mem.frequency_pref",
      defaultFrequencyPref
    );
    const frequencyOptions = _getFrequencyOptions(gopher);
    const nextReminder = gopher.get("task.trigger_time");

    const userTimezone = gopher.get("user.timezone", "GMT");
    return memorizationControls(
      frequencyPref,
      reminderCount,
      nextReminder,
      userTimezone,
      frequencyOptions
    );
  }

  function renderDidYouRemember(gopher) {
    const reminderCount = gopher.webhook.getTaskData("mem.reminder_count", 1);
    const defaultFrequencyPref =
      gopher.webhook.getExtensionData("mem.defaultFrequencyPref") ||
      memConfig.defaultFrequencyPref;

    const frequencyPref = gopher.webhook.getTaskData(
      "mem.frequency_pref",
      defaultFrequencyPref
    );
    const frequencyOptions = _getFrequencyOptions(gopher);

    const userTimezone = gopher.get("user.timezone", "GMT");
    return didYouRemember(
      frequencyPref,
      reminderCount,
      null,
      userTimezone,
      frequencyOptions
    );
  }

  /**
   * Get frequency options from webhook or general config
   * @param {object} gopher
   */
  function _getFrequencyOptions(gopher) {
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

  /**
   * Change memorization frequency
   * @param {Number} freq Floating point number
   */
  function changeMemFrequency(gopher, freq) {
    gopher.webhook.setTaskData("mem.frequency_pref", freq);
    return memorizeTask(gopher); // Recalculate due date based on newly set pref
  }

  /**
   * Get info about the memorization
   */
  function getMemInfo(gopher) {
    const reminderCount = gopher.webhook.getTaskData("mem.reminder_count", 1);
    const frequencyPref = gopher.webhook.getTaskData(
      "mem.frequency_pref",
      memConfig.defaultFrequencyPref
    );
    return { reminderCount, frequencyPref };
  }

  /**
   * Also add memorization skills to gopher.skills object
   * Ref: https://github.com/gopherhq/gopher-app#adding-to-gopherskills-with-middlware
   */
  gopherApp.app.use(function(req, res, next) {
    const gopher = res.locals.gopher;
    gopher.skills.memorize = gopher.skills.memorize || {};
    gopher.skills.memorize.renderMemorizationControls = renderMemorizationControls.bind(
      null,
      gopher
    );
    next();
  });

  return {
    memorizeTask,
    renderMemorizationControls,
    renderDidYouRemember,
    changeFrequencyButtonsWithChart,
    changeMemFrequency,
    getMemInfo
  };
};
