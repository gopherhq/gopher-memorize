const { getNextInterval } = require("./lib/date-helpers");
const { memorizationControls } = require("./lib/ui-helpers");
const _ = require("lodash");

const configDefaults = {
  defaultFrequencyPref: 1
};

module.exports = function(config) {
  return function(request, response, next) {
    const gopher = response.locals.gopher || {};
    const memConfig = Object.assign({}, gopher.config, configDefaults, config);

    gopher.skills.memorize = {};
    const memSkills = {
      /**
       * Schedule the next reminder for this task using spaced repetition.
       * Automatically manages its own data on the task.
       * TODO: Put private data in skill's own namespace?
       */
      memorizeTask: function() {
        const reminderCount = gopher.webhook.getTaskData("reminder_count", 1);
        const frequencyPref = gopher.webhook.getTaskData(
          "frequency_pref",
          memConfig.defaultFrequencyPref
        );
        gopher.webhook.setTaskData({
          frequency_pref: frequencyPref,
          reminder_count: reminderCount
        });
        const nextReminder = getNextInterval(reminderCount, frequencyPref);
        gopher.webhook.setTriggerTimestamp(nextReminder);
        return nextReminder;
      },

      /**
       * Set frequencyPreference for given task.
       * Ex: gopher.skills.changeMemFrequency(1.5)
       */
      changeMemFrequency: function(freq) {
        gopher.webhook.setTaskData({ frequency_pref: freq });
        return this.memorizeTask(); // Recalculate due date based on newly set pref
      },

      /**
       * Return useful info about the memorization. This can grow to support various
       * other datapoints from mem-utils.js
       */
      getMemInfo: function() {
        const reminderCount = gopher.webhook.getTaskData("reminder_count", 1);
        const frequencyPref = gopher.webhook.getTaskData(
          "frequency_pref",
          memConfig.defaultFrequencyPref
        );
        return { reminderCount, frequencyPref };
      },

      cancel: function() {
        return gopher.webhook.completeTask();
      },

      /**
       * Get UI for memorization controls
       * @returns {Array} Gopher Email UI Objects
       */
      renderMemorizationControls() {
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
      },

      /**
       * Get UI for managing the task.
       * @return {Array} Gopher Email UI Objects
       */
      renderTaskControls() {
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
      },

      /**
       * Get UI for managing extension
       * @return {Array} Gopher Email UI Objects
       */
      renderExtensionControls() {
        const extension = gopher.get("extension");
        if (!extension) {
          console.error(
            "extensionControls did not recieve an extension object"
          );
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
      }
    };
    gopher.skills.memorize = memSkills;
    next();
  };
};
