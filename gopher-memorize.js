const _ = require("lodash");
const sharedConfig = require("./lib/config");
const memConfig = sharedConfig.memConfig;
const {
  getNextInterval,
  getFutureIntervals,
  getFriendlyDates
} = require("./lib/date-helpers");

const {
  memorizationControls,
  changeFrequencyButtonsWithChart,
  getFutureIntervalSentence,
  renderRepeatMessage
} = require("./lib/ui-helpers");

module.exports = function(gopherApp, instanceConfig) {
  /**
   * Set up config
   */
  Object.assign(gopherApp.config, memConfig, instanceConfig);

  sharedConfig.setConfig(gopherApp.config); // Share config with helpers
  // gopherApp.config = sharedConfig.memConfig; // Share with gopherApp

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

    function getIntervalDescription(frequencyOption) {
      let intervalSentence = `\n\n**${frequencyOption}** – `;
      intervalSentence += getFutureIntervals(10, frequencyOption)
        .map(unixTime => getFriendlyDates({ unixTime }))
        .map(
          friendlyDate =>
            friendlyDate.daysInFuture
              ? `${friendlyDate.daysInFuture} days`
              : `${friendlyDate.hoursInFuture} hours`
        )
        .join(", ");
      return intervalSentence;
    }
    const preferenceDescriptions = _getFrequencyOptions(gopher)
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

  /**
   * Start memorizing task
   * This function is exported so it can be called within handlers.
   * Ex: const { memorizeTask } = require("gopher-memorize")(gopherApp);
   * @param {object} gopher
   */
  function memorizeTask(gopher) {
    const reminderNum = gopher.webhook.getTaskData("mem.reminder_num", 0);
    const defaultFrequencyPref =
      gopher.webhook.getExtensionData("mem.defaultFrequencyPref") ||
      memConfig.defaultFrequencyPref;
    const frequencyPref = gopher.webhook.getTaskData(
      "mem.frequency_pref",
      defaultFrequencyPref
    );
    gopher.webhook.setTaskData("mem.reminder_num", reminderNum);
    gopher.webhook.setTaskData("mem.frequency_pref", frequencyPref);
    gopher.webhook.setTaskData("mem.repeat_last_reminder_ct", "no_reminders");
    const nextReminder = getNextInterval(reminderNum, frequencyPref);
    gopher.webhook.setTriggerTimestamp(nextReminder);
    return nextReminder;
  }

  function memorizeTasksMiddleware({ commandMatch } = {}) {
    return function createMemMiddleware(req, res, next) {
      const gopher = res.locals.gopher;
      if (
        gopher.event === "task.created" &&
        gopher.command.includes(commandMatch)
      ) {
        if (gopher.alreadyRan(createMemMiddleware)) return next();
        memorizeTask(gopher);
      }
      next();
    };
  }

  /**
   * Render "Did You Remember" Yes / No buttons and mailto actions
   * @param {object} gopher
   */
  function renderDidYouRemember(gopher) {
    const reminderNum = gopher.webhook.getTaskData("mem.reminder_num", 0);
    const frequencyPref = _getCurrentFrequencyPref(gopher);
    const userTimezone = gopher.get("user.timezone", "GMT");

    // User remembered
    const yesNextTime = getNextInterval(reminderNum, frequencyPref);
    const exampleIntervalStarting =
      reminderNum == 0 ? reminderNum : reminderNum - 1;
    const { friendlyDate: yesFriendlyDate, howFarInFuture } = getFriendlyDates({
      unixTime: yesNextTime,
      userTimezone
    });
    const yesBtn = {
      type: "button",
      action: `mem.check.yes`,
      text: "Yes",
      subject: "Yes, I remembered",
      body: `
Your next reminer will be ${howFarInFuture} from today.
<br /><br />
Here is your current memorization schedule: ${getFutureIntervalSentence(
        8,
        frequencyPref,
        exampleIntervalStarting
      )} <br/><br />
Each time you remember, you will move to the next further interval. Forgetting moves you one interval back.`
    };

    // User forgot
    const noNextTime = getNextInterval(reminderNum - 1, frequencyPref);
    const {
      friendlyDate: noFriendlyDate,
      howFarInFuture: noHowFarInFuture
    } = getFriendlyDates({
      unixTime: noNextTime,
      userTimezone
    });
    const noBtn = {
      type: "button",
      action: `mem.check.no`,
      text: "No",
      subject: "No, let's try a sooner reminder",
      body: `
Your next reminer will be on ${noFriendlyDate}, ${noHowFarInFuture} from today.
<br /><br />
On the current frequency settings, each time you remember, reminders will follow  this memorization schedule: ${getFutureIntervalSentence(
        8,
        frequencyPref,
        reminderNum - 1
      )}`
    };

    return [
      {
        type: "section",
        text: "Did you remember?"
      },
      yesBtn,
      noBtn
    ];
  }

  /**
   * Handle  "Did You Remember" mailto actions.
   * Done via middleware to allow top-level extension handle email
   * interaction with the user. It can do this by by calling
   * this handler: gopherApp.onAction(/^mem\.check/, (gopher) => {});
   */
  gopherApp.app.use(handleDidYouRemember);
  function handleDidYouRemember(req, res, next) {
    const gopher = res.locals.gopher;
    if (gopher.action && gopher.action.includes("mem.check")) {
      if (gopher.alreadyRan(handleDidYouRemember)) return next();
      const didYouRemember = gopher.action.split(".")[2];
      const reminderNum = gopher.webhook.getTaskData("mem.reminder_num", 0);
      const frequencyPref = _getCurrentFrequencyPref(gopher);

      // Defense
      if (!["yes", "no"].includes(didYouRemember)) {
        throw new Error("Unexpected didYouRemember: " + didYouRemember);
      }

      // Increment / decrement reminderNum, set next due date accordingly
      const updatedReminderNum =
        didYouRemember === "yes" ? reminderNum + 1 : reminderNum - 1;
      gopher.webhook.setTaskData("mem.reminder_num", updatedReminderNum);
      const nextReminder = getNextInterval(updatedReminderNum, frequencyPref);
      gopher.webhook.setTriggerTimestamp(nextReminder);

      // Update memorization history
      let taskHistory = gopher.webhook.getTaskData("mem.history", []);
      if (!Array.isArray(taskHistory)) taskHistory = [];
      taskHistory.push({ date: Date.now(), mem: didYouRemember });
      if (taskHistory.length > 500) taskHistory.shift();
      gopher.webhook.setTaskData("mem.history", taskHistory);

      // Reset reminders
      gopher.webhook.setTaskData("mem.repeat_last_reminder_ct", "no_reminders");
      const statusMessage = `Reminder number incremented to ${updatedReminderNum}, next due ${nextReminder}, ${Date(
        nextReminder
      ).toLocaleUpperCase()}`;

      gopher.set("webhook.message", statusMessage);
      // append proper data to memorization, even though the email can STILL be handled by handlers!!! Woot!!
    }
    next();
  }

  /**
   * Render UI to show change memorization frequency
   * @param {object} gopher
   */
  function renderMemorizationControls(gopher) {
    const reminderCount = gopher.webhook.getTaskData("mem.reminder_num", 1);
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

  /**
   * Handle change memorization frequency
   */
  gopherApp.app.use(handleMemFreqChangeMiddleware);

  function handleMemFreqChangeMiddleware(req, res, next) {
    const gopher = res.locals.gopher;
    if (gopher.action && gopher.action.includes("mem.freq")) {
      if (gopher.alreadyRan(handleMemFreqChangeMiddleware)) return next();
      const newFrequencyPref = gopher.action.split(".")[2].replace("-", ".");
      changeMemFrequency(gopher, newFrequencyPref);
      memorizeTask(gopher); // re-activates the task absed on current reminder-num
    }
    next();
  }

  /**
   * Handle when a memorization has been triggered, increment how many times we've
   * repeat_last_reminder_ct
   */

  gopherApp.app.use(handleMemTrigMiddlware);

  function handleMemTrigMiddlware(req, res, next) {
    const gopher = res.locals.gopher;
    if (
      gopher.event === "task.triggered" &&
      gopher.command &&
      gopher.command.includes("memorize")
    ) {
      if (gopher.alreadyRan(handleMemTrigMiddlware)) return next();
      let howManyRepeatReminders = gopher.webhook.getTaskData(
        "mem.repeat_last_reminder_ct",
        "no_reminders"
      );

      if (howManyRepeatReminders === "no_reminders") {
        howManyRepeatReminders = 0; // the "0th" means one reminder has been sent, but no repeat reminders
      } else if (typeof howManyRepeatReminders === "number") {
        howManyRepeatReminders++;
      } else {
        throw new Error(
          "howManyRepeatReminders reminders had an unknown type: " +
            typeof howManyRepeatReminders
        );
      }

      gopher.webhook.setTaskData(
        "mem.repeat_last_reminder_ct",
        howManyRepeatReminders
      );

      // Follow up in 1 day if they have not yet marked "yes" or "no"
      gopher.webhook.setTriggerTime("1day");

      // Complete task if it's been triggered too many times.
      // This is reset in the handler for responding yes / no.
      if (howManyRepeatReminders > 2) {
        gopher.set("task.completed", 1);
      } else {
        // Gopher completes all tasks by default
        gopher.set("task.completed", 0);
      }
    }
    next();
  }

  /**
   * Exported function to change memorization frequency, made available to
   * top-level skill.
   * @param {Number} freq Integer or floating point number
   */
  function changeMemFrequency(gopher, freq) {
    gopher.webhook.setTaskData("mem.frequency_pref", freq);
    gopher.webhook.setTaskData("mem.repeat_last_reminder_ct", "no_reminders");
    return memorizeTask(gopher); // Recalculate due date based on newly set pref
  }

  /**
   * Exported function to fet info about the current memorization
   */
  function getMemInfo(gopher) {
    const reminderCount = gopher.webhook.getTaskData("mem.reminder_num", 1);
    const frequencyPref = gopher.webhook.getTaskData(
      "mem.frequency_pref",
      memConfig.defaultFrequencyPref
    );
    return { reminderCount, frequencyPref };
  }

  /**
   * Add memorization skills to gopher.skills object for use in gopher.skills
   * This is mainly for demonstration.
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

  // Helpers / Private Methods

  // Get the tasks' current frequency preference
  function _getCurrentFrequencyPref(gopher) {
    const defaultFrequencyPref =
      gopher.webhook.getExtensionData("mem.defaultFrequencyPref") ||
      memConfig.defaultFrequencyPref;

    return gopher.webhook.getTaskData(
      "mem.frequency_pref",
      defaultFrequencyPref
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

  return {
    memorizeTask,
    renderMemorizationControls,
    renderDidYouRemember,
    renderRepeatMessage,
    changeFrequencyButtonsWithChart,
    changeMemFrequency,
    getMemInfo,
    memorizeTasksMiddleware,
    handleMemTrigMiddlware,
    handleMemFreqChangeMiddleware
  };
};
