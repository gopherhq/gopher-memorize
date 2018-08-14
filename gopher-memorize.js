const _ = require("lodash");
const sharedConfig = require("./lib/config");
const { getNextInterval } = require("./lib/date-helpers");
const { memorizationControls } = require("./lib/ui-helpers");

// Each of these options can be overridden when invoking the skill
// Ex: gopher.use(memorizeSkill({defaultFrequencyPref: 3}));
const configDefaults = {
  defaultFrequencyPref: 1,
  frequencyPrefOptions: [0.1, 0.2, 0.5, 1, 1.5, 2, 5],
  decayExponent: 2.5 // (reminderCount ^ decayExponent) * frequencyPref;
};

module.exports = function(gopherApp, config) {
  /**
   * Init skill
   * Set up config, skill base, etc
   */
  let memConfig = {}; // share
  gopherApp.teach(function(gopher) {
    gopher.skills.memorize = {};
    memConfig = Object.assign({}, gopher.config, configDefaults, config);
    sharedConfig.setConfig(memConfig);
  });

  /**
   * Memorize Task
   * Schedule the next reminder for this task using spaced repetition.
   * Automatically manages its own data on the task.
   * TODO: Put private data in skill's own namespace?
   */
  gopherApp.teach(function(gopher) {
    gopher.skills.memorize.memorizeTask = function() {
      const reminderCount = gopher.webhook.getTaskData("reminder_count", 1);
      const frequencyPref = gopher.webhook.getTaskData(
        "frequency_pref",
        memConfig.defaultFrequencyPref
      );
      gopher.webhook.setTaskData({
        frequency_pref: frequencyPref,
        reminder_count: reminderCount + 1
      });
      const nextReminder = getNextInterval(reminderCount, frequencyPref);
      gopher.webhook.setTriggerTimestamp(nextReminder);
      return nextReminder;
    };
  });

  // getMemInfo
  // Get info about this memorization
  gopherApp.teach(function(gopher) {
    gopher.skills.memorize.getMemInfo = function() {
      const reminderCount = gopher.webhook.getTaskData("reminder_count", 1);
      const frequencyPref = gopher.webhook.getTaskData(
        "frequency_pref",
        memConfig.defaultFrequencyPref
      );
      return { reminderCount, frequencyPref };
    };
  });

  // cancel memorization
  gopherApp.teach(function(gopher) {
    gopher.skills.memorize.cancel = function() {
      return gopher.webhook.completeTask();
    };
  });

  // changeMemFrequency
  // Depends on gopher.skills.memorizeTask being loaded
  gopherApp.teach(function(gopher) {
    gopher.skills.memorize.changeMemFrequency = function(freq) {
      gopher.webhook.setTaskData({ frequency_pref: freq });
      return gopher.skills.memorize.memorizeTask(); // Recalculate due date based on newly set pref
    };
  });

  /**
   * Get UI for memorization controls
   * @returns {Array} Gopher Email UI Objects
   */
  gopherApp.teach(function(gopher) {
    gopher.skills.memorize.renderMemorizationControls = function() {
      const reminderCount = gopher.webhook.getTaskData("reminder_count", 1);
      const frequencyPref = gopher.webhook.getTaskData(
        "frequency_pref",
        memConfig.defaultFrequencyPref
      );
      const userTimezone = gopher.get("user.timezone", "GMT");
      return memorizationControls(
        frequencyPref,
        reminderCount,
        null,
        userTimezone
      );
    };
  });

  /**
   * Get UI for managing the task.
   * @return {Array} Gopher Email UI Objects
   */
  gopherApp.teach(function(gopher) {
    gopher.skills.memorize.renderTaskControls = function() {
      const task = gopher.get("task");
      if (!task) {
        console.error("taskControls did not recieve a complete task object");
        return [];
      } else {
        return [
          {
            type: "section",
            text: "Task Actions"
          },
          {
            type: "button",
            action: "cancel",
            text: "Cancel",
            subject: "Hit 'send' to cancel this reminder'"
          },
          {
            type: "button",
            url: `${memConfig.gopherAdmin}tasks/${task.id}`,
            text: "Edit"
          },
          {
            type: "button",
            url: `${memConfig.gopherAdmin}tasks?extension=${
              memConfig.extSubdomain
            }&filter_extension=${memConfig.extSubdomain}`,
            text: "List All"
          }
        ];
      }
    };
  });

  /**
   * Get UI for managing extension
   * @return {Array} Gopher Email UI Objects
   */
  gopherApp.teach(function(gopher) {
    gopher.skills.memorize.renderExtensionControls = function() {
      const extension = gopher.get("extension");
      if (!extension) {
        console.error("extensionControls did not recieve an extension object");
        return [];
      } else {
        return [
          {
            type: "section",
            text: "Extension Information"
          },
          {
            type: "html",
            text: `
            <span style="color: #aaaaaa">
              <a
                style="color: #aaaaaa"
                href="${
                  memConfig.gopherAdmin
                }tasks?extension=memorize&filter_extension=memorize"
                >
                My Memorizations</a> |
              <a
                style="color: #aaaaaa"
                href="${
                  memConfig.gopherAdmin
                }tasks?extension=memorize&filter_extension=memorize"
                >
                About Memorize.email</a> |
              <a
                style="color: #aaaaaa"
                href="mailto:help+memorize@humans.fut.io">
                Feedback</a>
            </span><br />`
          }
        ];
      }
    };
  });
};
