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

  it("shows a series of future reminders", done => {
    let intervals = memUtils.getFutureIntervals(10, 0.1);
    // See memorization intervals
    // console.log(
    //   intervals.map(interval => memUtils.getFriendlyDates(interval).daysInFuture)
    // );
    expect(intervals[0]).to.be.above(Date.now() / 1000);
    expect(intervals[0]).to.be.above(Date.now() / 1000);
    done();
  });
});

describe("UI Helpers", function() {
  it("shows a sentence with future date intervals", function(done) {
    // console.log(uiHelpers.getFutureIntervalSentence(10, 100, 0));
    expect(uiHelpers.getFutureIntervalSentence(10, 100, 0)).to.match(
      /^23 hours, 5 days, 15 days/
    );
    expect(uiHelpers.getFutureIntervalSentence(10, 100, 1)).to.match(/^5 days/);
    expect(uiHelpers.getFutureIntervalSentence(10, 100, 2)).to.match(
      /^15 days/
    );
    done();
  });
});
