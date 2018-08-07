Error.stackTraceLimit = 10;
const mocha = require("mocha");
const expect = require("chai").expect;
const memUtils = require("../lib/date-helpers");

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
