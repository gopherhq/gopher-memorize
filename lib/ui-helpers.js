const { memConfig } = require("./config");
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
function getFrequencyIllustration(frequencyPref, userTimezone = null) {
  let daysInFuture = getFutureIntervals(100, frequencyPref).map(
    unixTime => getFriendlyDates({ unixTime, userTimezone }).daysInFuture
  );

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
  const mouseoverTitle = getFutureIntervalSentence(10, frequencyPref);

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
 */
function getFutureIntervalSentence(numExampleIntervals, frequencyPref) {
  let futureIntervalSentence = "Memorization cues will be sent ";

  const futureIntervals = getFutureIntervals(
    numExampleIntervals,
    frequencyPref
  );
  futureIntervals.map(unixTime => {
    const { daysInFuture, hoursInFuture } = getFriendlyDates({ unixTime });
    futureIntervalSentence += daysInFuture
      ? `${daysInFuture} days, `
      : `${hoursInFuture} hours, `;
  });
  futureIntervalSentence = futureIntervalSentence.replace(/,\s*$/, ""); //remove trailing comma
  futureIntervalSentence += " from from now.";
  return futureIntervalSentence;
}

/**
 * Render an instance of the button that changes reminder frequency
 * @param {float} frequencyPref A number between .01 and 10 reflecting reminder freq
 * @param {string} buttonText (Optional) button text
 * @param {boolean} active (Optional) Active button is highlighted
 */
function changeFrequencyButton(frequencyPref, buttonText, active) {
  const numExampleIntervals = 10;
  const CHANGE_FREQ = "freq";
  return {
    type: "button",
    action: `mem.${CHANGE_FREQ}.${frequencyPref
      .toString()
      .trim()
      .replace(".", "-")}`, // replace decimal with - to not conflict with '.' in params
    text: buttonText || "&nbsp; &nbsp;",
    style: active ? "primary" : "",
    subject: "Hit 'send' to update memorization schedule",
    body: getFutureIntervalSentence(numExampleIntervals, frequencyPref)
  };
}

/**
 * Render a set of buttons to change reminder frequency
 * @param {float} currentFrequency User's currently selected freq (to show as active)
 */
function changeFrequencyButtons(currentFrequency, frequencyOptions) {
  if (!currentFrequency || !frequencyOptions)
    throw new Error("changeFreqeuncyButtons missing required parameters");

  const maxOption = _.maxBy(frequencyOptions, num => Number(num));
  const minOption = _.minBy(frequencyOptions, num => Number(num));

  const frequencyButtons = frequencyOptions.map(frequencyOption => {
    const active = Number(currentFrequency) === Number(frequencyOption);
    if (frequencyOption == maxOption) {
      return changeFrequencyButton(frequencyOption, "Seldom", active);
    } else if (frequencyOption == minOption) {
      return changeFrequencyButton(frequencyOption, "Often", active);
    } else {
      return changeFrequencyButton(frequencyOption, null, active);
    }
  });
  return frequencyButtons;
}

/**
 * Render memorization controls block in email
 */
function memorizationControls(
  frequencyPref,
  reminderCount,
  nextReminder = null,
  userTimezone = "GMT",
  frequencyOptions
) {
  unixTime = nextReminder || getNextInterval(reminderCount, frequencyPref);
  const { daysInFuture, hoursInFuture, friendlyDate } = getFriendlyDates({
    unixTime,
    userTimezone
  });
  const timeFromNow = daysInFuture
    ? `${daysInFuture} days from today`
    : `${hoursInFuture} hours from now`;
  return [
    {
      type: "section",
      text: "Memorization Schedule"
    },
    {
      type: "html",
      text: `Your next reminder will be on ${friendlyDate}, ${timeFromNow}.`
    },
    {
      type: "html",
      text: getFrequencyIllustration(frequencyPref)
    },
    {
      type: "section",
      text: "Change Frequency"
    },
    ...changeFrequencyButtons(frequencyPref, frequencyOptions)
  ];
}

/**
 * Quiz Labels
 */
function didYouRemember(
  frequencyPref,
  reminderCount,
  nextReminder = null,
  userTimezone = "GMT",
  frequencyOptions
) {
  unixTime = nextReminder || getNextInterval(reminderCount, frequencyPref);
  const { daysInFuture, friendlyDate } = getFriendlyDates({
    unixTime,
    userTimezone
  });
  return [
    {
      type: "section",
      text: "Did You Remember?"
    },
    changeFrequencyButton(1, "Yes", false),
    changeFrequencyButton(1, "No", false)
  ];
}

/**
 * Renders a button next to an illustration of the upcoming reminders
 */
function changeFrequencyButtonsWithChart(gopher) {
  function chartLine(frequencyPref) {
    return [
      {
        type: "html",
        text: `${getFrequencyIllustration(frequencyPref)}
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

  const charts = gopher.config.frequencyOptions.reduce(
    (charts, option) => charts.concat(chartLine(option)),
    []
  );

  return [
    {
      type: "section",
      text: "FREQUENCY OPTIONS (VERBOSE)"
    },
    ...charts,
    {
      type: "section"
    }
  ];
}

module.exports = {
  memorizationControls,
  changeFrequencyButtonsWithChart,
  didYouRemember
};
