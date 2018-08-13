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
function getFrequenceyIllustration(frequencyPref, userTimezone = null) {
  let daysInFuture = getFutureIntervals(100, frequencyPref).map(
    unixTime => getFriendlyDates({ unixTime, userTimezone }).daysInFuture
  );

  let markup = "";
  let intervalsShown = 0;
  let reminderThisDay = false;
  const tickFrequency = 2; //show tick every x days
  const daysToShow = 90;

  // Outlook limited to 63 columns only
  // https://answers.microsoft.com/en-us/msoffice/forum/msoffice_outlook-mso_winother-mso_2007/ms-outlook-20072010-content-width-limitation/06b002ae-a53c-4d33-a6a6-77b78438ef41

  const tickMark = ({ color = "#aaaaaa", height }) => {
    return `<td style="font-size: ${height}; line-height: 5px; font-family: monospace; color: ${color};">&bull;</td>`;
  };

  for (let day = 0; day < daysToShow; day++) {
    reminderThisDay = daysInFuture.indexOf(day) !== -1;
    if (reminderThisDay) {
      markup += tickMark({ color: "#0099cc", height: "20px" });
      intervalsShown++;
    }
    if (day % tickFrequency === 0) {
      markup += tickMark({ height: "3px", color: "#333" });
    }
  }
  return `<div style="line-height: 45px; white-space: nowrap;">
              <span style="font-size: 10px; font-family: helvetica, sans-serif; color: #aaaaaa">
                
              </span>
              <table cellpadding="0" cellspacing="1" border="0">
                <tr>
                  <td>
                   <span style="font-size: 10px; font-family: helvetica, sans-serif; color: #aaaaaa">(now)</span>&nbsp; &nbsp;
                  </td>
                    ${markup}
                  <td>
                  <span style="font-size: 10px; font-family: helvetica, sans-serif; color: #aaaaaa">
                    &nbsp; &nbsp; +${daysToShow} days
                  </span>
                  </td>  
                </tr>
              </table>
          </div>`;
}

/**
 * Output an example sentence of upcoming reminders
 * @param {int} num Number of example reminder
 * @param {float} frequencyPref Frequency pref (see getNextInterval)
 */
function getFutureIntervalSentence(num, frequencyPref) {
  let futureIntervalSentence = "Memorization cues will be sent ";

  futureIntervalSentence += getFutureIntervals(num, frequencyPref)
    .map(unixTime => getFriendlyDates({ unixTime }).daysInFuture)
    .join(" days, ");

  futureIntervalSentence += " days from today.";
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
  return {
    type: "button",
    action: `frequency.${frequencyPref.toString().replace(".", "-")}`,
    text: buttonText || "&nbsp; &nbsp;",
    style: active ? "primary" : "",
    subject: "Hit 'send' to reset memorization schedule",
    body: getFutureIntervalSentence(numExampleIntervals, frequencyPref)
  };
}

/**
 * Render a set of buttons to change reminder frequency
 * @param {float} currentFrequency User's currently selected freq (to show as active)
 */
function changeFrequencyButtons(currentFrequency) {
  currentFrequency = currentFrequency || memConfig.defaultFrequencyPref;
  const frequencyOptions = memConfig.frequencyPrefOptions;

  const maxOption = _.max(frequencyOptions);
  const minOption = _.min(frequencyOptions);

  const frequencyButtons = frequencyOptions.map(frequencyOption => {
    const active = currentFrequency == frequencyOption;
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
  userTimezone = "GMT"
) {
  unixTime = nextReminder || getNextInterval(reminderCount, frequencyPref);
  const { daysInFuture, friendlyDate } = getFriendlyDates({
    unixTime,
    userTimezone
  });
  return [
    {
      type: "section",
      text: "Memorization Schedule"
    },
    {
      type: "html",
      text: `Your next reminder will be on ${friendlyDate}, ${daysInFuture} days from today.`
    },
    {
      type: "html",
      text: getFrequenceyIllustration(frequencyPref)
    },
    {
      type: "section",
      text: "Change Frequency"
    },
    ...changeFrequencyButtons(frequencyPref)
  ];
}

/**
 * Renders a button next to an illustration of the upcoming reminders
 */
function changeFrequencyButtonsWithChart() {
  return [
    {
      type: "section",
      text: "CHANGE FREQUENCY"
    },
    {
      type: "button",
      action: "frequency.p5",
      text: "Select",
      subject: "Hit 'send' to receive this reminder more frequently"
    },
    {
      type: "html",
      text: getFrequenceyIllustration(0.2)
    },
    {
      type: "button",
      action: "frequency.p2",
      text: "Select",
      subject: "Hit 'send' to receive this reminder more frequently"
    },
    {
      type: "html",
      text: getFrequenceyIllustration(0.5)
    },
    {
      type: "button",
      action: "frequency.1",
      text: "Select",
      subject: "Hit 'send' to receive this reminder more frequently"
    },
    {
      type: "html",
      text: getFrequenceyIllustration(1)
    },
    {
      type: "button",
      action: "frequency.3",
      text: "Select",
      subject: "Hit 'send' to receive this reminder more frequently"
    },
    {
      type: "html",
      text: getFrequenceyIllustration(3)
    },
    {
      type: "button",
      action: "frequency.6",
      text: "Select",
      subject: "Hit 'send' to receive this reminder more frequently"
    },
    {
      type: "html",
      text: getFrequenceyIllustration(6)
    },
    {
      type: "button",
      action: "frequency.12",
      text: "Select",
      subject: "Hit 'send' to receive this reminder more frequently"
    },
    {
      type: "html",
      text: getFrequenceyIllustration(10)
    },
    {
      type: "button",
      action: "cancel",
      text: "Cancel",
      subject: "Hit 'send' to cancel this reminder'"
    },
    {
      type: "section"
    }
  ];
}

module.exports = {
  memorizationControls
};
