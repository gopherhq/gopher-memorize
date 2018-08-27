const _ = require("lodash");
const sharedConfig = require("./lib/config");
const { getNextInterval } = require("./lib/date-helpers");
const { memorizationControls } = require("./lib/ui-helpers");

module.exports = function(gopherApp, config) {
  /**
   * Set up config
   */
  const memConfig = Object.assign({}, gopherApp.config, config);
  sharedConfig.setConfig(memConfig); // Shares config with helpers

  /**
   * Start memorizing task
   * @param {object} gopher
   */
  function memorizeTask(gopher) {
    const reminderCount = gopher.webhook.getTaskData("mem.reminder_count", 1);
    const frequencyPref = gopher.webhook.getTaskData(
      "mem.frequency_pref",
      memConfig.defaultFrequencyPref
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
    const frequencyPref = gopher.webhook.getTaskData(
      "mem.frequency_pref",
      memConfig.defaultFrequencyPref
    );
    const userTimezone = gopher.get("user.timezone", "GMT");
    return memorizationControls(
      frequencyPref,
      reminderCount,
      null,
      userTimezone
    );
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
   * Skills can directly invoke middleware to add to the gopher.skills object. Any
   * handler can then invoke a skill like: gopher.skills.memorize.renderMemorizationControls();
   * Explictly requiring dependencies is clear and self-documenting. Passing via
   * middleware could be used for sharing pre-configured objects like loggers, logged in user, etc.
   * Downstream middleware can also add an exported skill to middleware.
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
    changeMemFrequency,
    getMemInfo
  };
};
