Error.stackTraceLimit = 10;
const mocha = require("mocha");
const expect = require("chai").expect;
const memUtils = require("../lib/date-helpers");
const uiHelpers = require("../lib/ui-helpers");

describe("date helpers", function() {
  it("gets the first reminder date", done => {
    let futureReminder = memUtils.getNextInterval(1, 1);
    expect(futureReminder).to.be.above(Date.now() / 1000);
    done();
  });

  it("shows friendly dates", done => {
    let date = memUtils.getFriendlyDates({ unixTime: Date.now() / 1000 });
    expect(date.daysInFuture).to.equal(0);
    expect(date.friendlyDate).to.be.a("string");
    done();
  });

  it("shows more friendly dates", done => {
    let date = memUtils.getFriendlyDates({
      unixTime: Date.now() / 1000 + 60 * 60 * 24 * 3,
      userTimezone: "America/Los_Angeles"
    });
    expect(date.daysInFuture).to.equal(3);
    expect(date.hoursInFuture).to.equal(72);
    expect(date.friendlyDate).to.be.a("string");
    done();
  });

  // This is an internal tool to help find the default memorization settings
  it.skip("logs interval options", done => {
    let intervals;
    function printIntervals(pref) {
      intervals = memUtils.getFutureIntervals(10, pref);
      // See memorization intervals
      console.log(
        intervals.map(
          interval =>
            memUtils.getFriendlyDates({ unixTime: interval }).daysInFuture
        )
      );
    }
    // We're staring from reminderNum 3 (4th element)
    [2, 4, 6, 8, 20, 40, 100].map(printIntervals);

    // expect(intervals[0]).to.be.above(Date.now() / 1000);
    // expect(intervals[0]).to.be.above(Date.now() / 1000);
    done();
  });

  it("shows a series of future reminders", done => {
    const intervals = memUtils.getFutureIntervals(10, 10);
    expect(intervals[0]).to.be.above(Date.now() / 1000);
    expect(intervals[0]).to.be.above(Date.now() / 1000);
    done();
  });
});

describe("UI Helpers", function() {
  it("shows a sentence with future date intervals", function(done) {
    // console.log(uiHelpers.getFutureIntervalSentence(10, 100, 0));
    expect(uiHelpers.getFutureIntervalSentence(10, 100, 0)).to.match(
      /^1 day, 6 days, 16 days/
    );
    expect(uiHelpers.getFutureIntervalSentence(10, 100, 1)).to.match(/^6 days/);
    expect(uiHelpers.getFutureIntervalSentence(10, 100, 2)).to.match(
      /^16 days/
    );
    done();
  });
});
