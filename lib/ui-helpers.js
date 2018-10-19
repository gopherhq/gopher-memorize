const { getFrequencyOptions } = require("./config");
const _ = require("lodash");
const {
  getFutureIntervals,
  getFriendlyDates,
  getNextInterval
} = require("./date-helpers");

/**
 * Get rendered visualization of upcoming reminders
 * @param  {float} frequencyPref Frequency pref (see getNextInterval)
 * @return {string} HTML-email friendly markup to illustration reminder frequency
 */
function renderFrequencyIllustration(
  frequencyPref,
  userTimezone = null,
  reminderNum
) {
  const intervalsDays = getFutureIntervals(100, frequencyPref, reminderNum).map(
    unixTime => getFriendlyDates({ unixTime, userTimezone }).daysInFuture
  );

  let reminderDay = 0;
  const daysInFuture = intervalsDays.map(dayNum => {
    reminderDay += dayNum;
    return reminderDay;
  });

  let markup = "";
  let reminderThisDay = false;
  const tickFrequency = 2; //show tick every x days

  // Outlook limited to 63 columns only
  // https://answers.microsoft.com/en-us/msoffice/forum/msoffice_outlook-mso_winother-mso_2007/ms-outlook-20072010-content-width-limitation/06b002ae-a53c-4d33-a6a6-77b78438ef41

  const tickMark = ({ color = "#aaaaaa", height }) => {
    return `<td style="font-size: ${height}; line-height: 5px; font-family: monospace; color: ${color};">&bull;</td>`;
  };

  let day = 0;
  const maxDaysToShow = 90;
  let reminders = 0;
  let maxRemindersToShow = 10;
  while (day < maxDaysToShow && reminders < maxRemindersToShow) {
    reminderThisDay = daysInFuture.indexOf(day) !== -1;
    if (reminderThisDay) {
      markup += tickMark({ color: "#0099cc", height: "20px" });
      reminders++;
    }
    if (day % tickFrequency === 0) {
      markup += tickMark({ height: "3px", color: "#333" });
    }
    day++;
  }
  const mouseoverTitle = getFutureIntervalSentence(
    10,
    frequencyPref,
    reminderNum
  );

  return `<div style="line-height: 45px; white-space: nowrap;" title="${mouseoverTitle}"}>
              <table cellpadding="0" cellspacing="1" border="0">
                <tr>
                  <td>
                   <span style="font-size: 10px; font-family: helvetica, sans-serif; color: #aaaaaa">(now)</span>&nbsp; &nbsp;
                  </td>
                    ${markup}
                  <td>
                  <span style="font-size: 10px; font-family: helvetica, sans-serif; color: #aaaaaa">
                    &nbsp; &nbsp; +${day} days
                  </span>
                  </td>  
                </tr>
              </table>
          </div>`;
}

/**
 * Output an example sentence of upcoming reminders
 * @param {int} numExampleIntervals Number of example reminders to show
 * @param {float} frequencyPref Frequency pref (see getNextInterval)
 * @param {int} startingFrom Start from this reminderNumber
 */
function getFutureIntervalSentence(
  numExampleIntervals,
  frequencyPref,
  startingFrom
) {
  let futureIntervalSentence = "";
  const futureIntervals = getFutureIntervals(
    numExampleIntervals,
    frequencyPref,
    startingFrom
  );
  futureIntervals.map(unixTime => {
    futureIntervalSentence +=
      getFriendlyDates({ unixTime }).howFarInFuture + ", ";
  });
  futureIntervalSentence += "etc.";
  return futureIntervalSentence;
}

/**
 * Render an instance of the button that changes reminder frequency
 * @param {float} frequencyPref A number between .01 and 10 reflecting reminder freq
 * @param {string} buttonText (Optional) button text
 * @param {boolean} active (Optional) Active button is highlighted
 */
function changeFrequencyButton(
  frequencyPref,
  buttonText,
  active,
  startingFrom
) {
  const nextReminderNum = startingFrom;
  const numExampleIntervals = 10;

  const unixTime = getNextInterval(startingFrom, frequencyPref);
  const { howFarInFuture } = getFriendlyDates({ unixTime });
  return {
    type: "button",
    action: `mem.freq.${frequencyPref
      .toString()
      .trim()
      .replace(".", "-")}`, // replace decimal with - to not conflict with '.' in params
    text: buttonText || "&nbsp; &nbsp;",
    style: active ? "primary" : "",
    subject: "Hit 'send' to update memorization schedule",
    body: `Your next reminder date will be about ${howFarInFuture} from now.

As you answer yes or no to each reminder, the next interval will move  \
forwards or backwards on this new schedule: ${getFutureIntervalSentence(
      numExampleIntervals,
      frequencyPref,
      nextReminderNum
    )}`
  };
}

/**
 * Render a set of buttons to change reminder frequency
 * @param {float} currentFrequency User's currently selected freq (to show as active)
 */
function changeFrequencyButtons(
  currentFrequency,
  frequencyOptions,
  startingFrom = 0
) {
  if (!currentFrequency || !frequencyOptions)
    throw new Error("changeFreqeuncyButtons missing required parameters");

  const maxOption = _.maxBy(frequencyOptions, num => Number(num));
  const minOption = _.minBy(frequencyOptions, num => Number(num));

  const frequencyButtons = frequencyOptions.map(frequencyOption => {
    const active = Number(currentFrequency) === Number(frequencyOption);
    if (frequencyOption == maxOption) {
      // More seldom reminders
      return changeFrequencyButton(frequencyOption, "-", active, startingFrom);
    } else if (frequencyOption == minOption) {
      // More frequent reminders
      return changeFrequencyButton(frequencyOption, "+", active, startingFrom);
    } else {
      return changeFrequencyButton(frequencyOption, null, active, startingFrom);
    }
  });
  return frequencyButtons.reverse();
}

/**
 * Renders a button next to an illustration of the upcoming reminders
 */
function changeFrequencyButtonsWithChart(gopher) {
  function chartLine(frequencyPref) {
    return [
      {
        type: "html",
        text: `${renderFrequencyIllustration(frequencyPref)}
          <p>${getFutureIntervalSentence(10, frequencyPref)}</p>`
      },
      {
        type: "button",
        action: `frequency.${frequencyPref}`,
        text: "Select",
        style: "block",
        subject: "Hit 'send' to change to this reminder frequency"
      },
      {
        type: "html",
        text: "<br /><hr /><br />"
      }
    ];
  }

  const charts = getFrequencyOptions(gopher).reduce(
    (charts, option) => charts.concat(chartLine(option)),
    []
  );

  return [
    {
      type: "section",
      text: "FREQUENCY OPTIONS (VERBOSE)"
    },
    {
      type: "html",
      text: getFrequencyOptions(gopher).reduce(
        (html, option) => (html += option)
      )
    },
    ...charts,
    {
      type: "section"
    }
  ];
}

/**
 * Get the proper update message for the number of repeat reminders
 * @param {string} howManyRepeatReminders How many reminders has the user already received?
 * @returns {object} gopher email body object - "html" type.
 */
function renderRepeatMessage(gopher) {
  const howManyRepeatReminders = gopher.webhook.getTaskData(
    "mem.repeat_last_reminder_ct",
    "no_reminders"
  );
  const messageTable = {
    no_reminders: "",
    "0": "",
    "1":
      "Were you able to remember? We will send 2 more reminders before turning off this memorization.<br /><br />--<br /><br />",
    "2":
      "Were you able to remember? We will send 1 more reminder before turning off this memorization.<br /><br />--<br /><br />",
    "3":
      "This memorization has been paused. To re-enable it, click 'yes' or 'no' below.<br /><br />--<br /><br />"
  };
  if (messageTable[howManyRepeatReminders] === undefined) {
    throw new Error(`Unexpected input: ${howManyRepeatReminders}`);
  }
  return {
    type: "html",
    text: messageTable[howManyRepeatReminders]
  };
}

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

module.exports = {
  changeFrequencyButtonsWithChart,
  getFutureIntervalSentence,
  getIntervalDescription,
  renderRepeatMessage,
  renderFrequencyIllustration,
  changeFrequencyButtons
};
