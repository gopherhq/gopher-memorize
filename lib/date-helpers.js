const moment = require("moment");
const tz = require("moment-timezone");
const assert = require("assert");
const { memConfig } = require("./config");

/**
 * Get the next moment a memorization reminder should be sent
 * given the number of reminders and the user's preference
 * for reminder frequency
 *
 * @param  {int} reminderCount Number of reminders received
 * @param  {float} frequencyPref Reminder frequency, a float between .01 and 10
 * @return {int} Unix Timestamp of next remidner
 */
function getNextInterval(reminderCount, frequencyPref) {
  assert(frequencyPref > 0, "Frequency preference must be a positive number");
  const decayExponent = memConfig.decayExponent;
  reminderCount = reminderCount < 0 ? 0 : reminderCount;
  const delayMultiplier =
    Math.pow(reminderCount + 1, decayExponent) * (frequencyPref / 100); // Naive implementation
  const nextReminderInterval = 60 * 60 * 24 * delayMultiplier;
  const now = Math.floor(Date.now() / 1000);
  const nextReminderTime = Math.floor(now + nextReminderInterval);
  return nextReminderTime;
}

/**
 * Get user friendly dates
 * @param  {int} unixTime
 * @param  {string} timezone Standard tz abbreviation (ex: America/Los_Angeles)
 * @param  {string} format Moment.js time formatting
 * @return {object} An object of user-friendly versions of the date
 */
function getFriendlyDates({
  unixTime,
  userTimezone,
  format = "MMMM Do YYYY, h:mma z"
}) {
  const secondsFromNow = Math.round(unixTime - Date.now() / 1000);
  const daysInFuture = Math.round(secondsFromNow / 60 / 60 / 24);
  const hoursInFuture = Math.round(secondsFromNow / 60 / 60);
  const howFarInFuture = daysInFuture
    ? `${daysInFuture} ${daysInFuture === 1 ? "day" : "days"}`
    : `${hoursInFuture} ${hoursInFuture === 1 ? "hour" : "hours"}`;
  userTimezone = userTimezone || "GMT";
  const friendlyDate = moment(unixTime * 1000)
    .tz(userTimezone)
    .format(format);
  return {
    friendlyDate,
    daysInFuture,
    hoursInFuture,
    howFarInFuture
  };
}

/**
 * Get the next x number of reminder timestamps given a frequence preference
 * @param  {int} num Number of reminder
 * @param  {float} frequencyPref Frequency pref (see getNextInterval)
 * @param  {int} startingFrom Start from this reminderNumber
 * @return {array} Array of Unix timestamps
 */
function getFutureIntervals(num, frequencyPref, startingFrom = 0) {
  let intervals = [];
  for (let reminderCount = startingFrom; reminderCount < num; reminderCount++) {
    intervals.push(getNextInterval(reminderCount, frequencyPref));
  }
  return intervals;
}

module.exports = {
  getNextInterval,
  getFriendlyDates,
  getFutureIntervals
};
