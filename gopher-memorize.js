const _ = require("lodash");
const {
  memConfig,
  setConfig,
  getFrequencyOptions,
  getCurrentFrequencyPref
} = require("./lib/config");
const {
  getNextInterval,
  getFutureIntervals,
  getFriendlyDates
} = require("./lib/date-helpers");
const {
  changeFrequencyButtonsWithChart,
  getFutureIntervalSentence,
  renderRepeatMessage,
  renderFrequencyIllustration,
  changeFrequencyButtons
} = require("./lib/ui-helpers");

module.exports = function(gopherApp, instanceConfig) {
  // Set up config
  Object.assign(gopherApp.config, memConfig, instanceConfig);

  // Share config with helpers
  setConfig(gopherApp.config);

  // Load sub-skills
  gopherApp.loadSkill(__dirname + "/skills");

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

  /**
   * Middleware that that runs the above memorizeTask function based on
   * certain criteria of the newly created task.
   * @param {config} param0
   */
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
    const frequencyPref = getCurrentFrequencyPref(gopher);
    const userTimezone = gopher.get("user.timezone", "GMT");
    const exampleIntervalStarting =
      reminderNum == 0 ? reminderNum : reminderNum - 1;

    // Current reminder info
    const nexTimeCurrent = getNextInterval(reminderNum, frequencyPref);
    const {
      friendlyDate: friendlyDateYes,
      howFarInFuture: howFarInFutureCurrent
    } = getFriendlyDates({
      unixTime: nexTimeCurrent,
      userTimezone
    });
    // User remembered
    const yesNextTime = getNextInterval(reminderNum + 1, frequencyPref);
    const { friendlyDate: yesFriendlyDate, howFarInFuture } = getFriendlyDates({
      unixTime: yesNextTime,
      userTimezone
    });
    const currentIntervalSentence = getFutureIntervalSentence(
      8,
      frequencyPref,
      exampleIntervalStarting
    );
    const yesBtn = {
      type: "button",
      action: `mem.check.yes`,
      text: "Yes",
      subject: "Yes, I remembered",
      body: `
Great! You remembered for ${howFarInFutureCurrent}. Now let's try ${howFarInFuture}.<br /><br />
Here is your current memorization schedule: ${currentIntervalSentence}`
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
      subject: "Not quite",
      body: `
No problem, we waited ${howFarInFutureCurrent} to send this reminder. Let's try ${noHowFarInFuture} for the next one.<br /><br />
Here is your current memorization schedule: ${currentIntervalSentence} <br/><br />`
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
      const frequencyPref = getCurrentFrequencyPref(gopher);

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

      // Tmp: Disable
      const statusMessage = `Reminder number incremented to ${updatedReminderNum}, next due ${nextReminder}`;
      gopher.set("webhook.message", statusMessage);
    }
    next();
  }

  /**
   * Render UI to show change memorization frequency
   * @param {object} gopher
   */
  function renderMemorizationControls(gopher) {
    const reminderNum = gopher.webhook.getTaskData("mem.reminder_num", 0);
    const frequencyPref = getCurrentFrequencyPref(gopher);
    const userTimezone = gopher.get("user.timezone", "GMT");
    const unixTime = getNextInterval(reminderNum, frequencyPref);
    const { timeFromNow: timeFromNowYes } = getFriendlyDates({
      unixTime,
      userTimezone
    });
    const frequencyOptions = getFrequencyOptions(gopher);
    return [
      {
        type: "section",
        text: "Memorization Schedule"
      },
      {
        type: "html",
        text: `Each time you successfully remember, reminders will follow the below schedule.`
      },
      {
        type: "html",
        text: renderFrequencyIllustration(
          frequencyPref,
          gopher.get("user.timezone"),
          reminderNum
        )
      },
      {
        type: "section",
        text: "Update Memorization Schedule"
      },
      ...changeFrequencyButtons(frequencyPref, frequencyOptions, reminderNum)
    ];
  }

  /**
   * Handle change memorization frequency
   */
  // gopherApp.app.use(handleMemorizationControls);
  function handleMemorizationControls(req, res, next) {
    const gopher = res.locals.gopher;
    if (gopher.action && gopher.action.includes("mem.freq")) {
      if (gopher.alreadyRan(handleMemorizationControls)) return next();
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

  // top-level skill must activate this
  // gopherApp.app.use(handleMemTrigMiddlware);

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
    handleMemorizationControls,
    getFriendlyDates
  };
};
