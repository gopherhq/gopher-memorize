const request = require("supertest");
const mocha = require("mocha");
const expect = require("chai").expect;
const GopherApp = require("gopher-app");
let gopherApp;
let memorize;

function sendWebhook({ app, webhook, gopherAppInstance }) {
  app =
    app ||
    (gopherAppInstance && gopherAppInstance.exportApp()) ||
    gopherApp.exportApp();
  webhook = webhook || require("./_fixtures/memCreated.json");
  return request(app)
    .post("/webhooks")
    .set("Accept", "application/json")
    .send(webhook);
}

describe("integration tests", function() {
  beforeEach(function() {
    // reinitialize each time to purge middleware
    gopherApp = new GopherApp({ clientId: "foo", clientSecret: "bar" });
    memorize = require("../gopher-memorize")(gopherApp);
  });

  describe("exported helper functions", function() {
    it("lets handlers use memorizeTask(gopher)", async function() {
      try {
        const webhook = require("./_fixtures/memCreated.json");
        gopherApp.onCommand("memorize", gopher => {
          memorize.memorizeTask(gopher);
        });
        const app = gopherApp.exportApp();
        const res = await sendWebhook({ app, webhook });
        expect(res.body.task.trigger_time).to.be.gt(Date.now() / 1000);
        expect(res.body.task.stored_data.mem.reminder_num).to.eq(2);
        expect(res.body.task.stored_data.mem.frequency_pref).to.eq(8);
        expect(res.body.task.stored_data.mem.repeat_last_reminder_ct).to.eq(
          "no_reminders"
        );
      } catch (e) {
        console.log(e);
        debugger;
      }
    });

    // Test by commenting out the "use" statment within the main lib
    it("uses middleware to memorize tasks", async function() {
      const webhook = require("./_fixtures/memCreated.json");
      gopherApp.app.use(
        memorize.memorizeTasksMiddleware({ commandMatch: "memorize" })
      );
      // gopherApp.onCommand("memorize", gopher => {
      //   // memorize.memorizeTask(gopher);
      // });
      const app = gopherApp.exportApp();
      const res = await sendWebhook({ app, webhook });
      expect(res.body.task.trigger_time).to.be.gt(Date.now() / 1000);
      expect(res.body.task.stored_data.mem.reminder_num).to.eq(2);
      expect(res.body.task.stored_data.mem.frequency_pref).to.eq(8);
      expect(res.body.task.stored_data.mem.repeat_last_reminder_ct).to.eq(
        "no_reminders"
      );
    });

    it("uses middleware to handle triggered tasks", async function() {
      const webhook = require("./_fixtures/memorizationTriggered.json");
      webhook.task.stored_data.mem.repeat_last_reminder_ct = "no_reminders";
      gopherApp.app.use(memorize.handleMemTrigMiddlware);
      let res = await sendWebhook({ webhook });
      expect(res.body.task.stored_data.mem.repeat_last_reminder_ct).to.eq(0);
      webhook.task.stored_data.mem.repeat_last_reminder_ct = 1;
      res = await sendWebhook({ webhook });
      expect(res.body.task.stored_data.mem.repeat_last_reminder_ct).to.eq(2);
      webhook.task.stored_data.mem.repeat_last_reminder_ct = 2;
      res = await sendWebhook({ webhook });
      expect(res.body.task.stored_data.mem.repeat_last_reminder_ct).to.eq(3);
    });

    it("exports a function to update mem frequency directly", async function() {
      gopherApp.onCommand("memorize", gopher => {
        memorize.changeMemFrequency(gopher, 22);
        expect(
          gopher.webhook.responseJson.task.stored_data.mem.frequency_pref
        ).to.eq(22);
        memorize.changeMemFrequency(gopher, 500);
        expect(
          gopher.webhook.responseJson.task.stored_data.mem.frequency_pref
        ).to.eq(500);
      });
      const res = await sendWebhook({ gopherAppInstance: gopherApp });
    });

    // @todo validate more of the output after its more finalized
    it("exports functions to render various UI controls", async function() {
      gopherApp.onCommand("memorize", gopher => {
        const memControls = memorize.renderMemorizationControls(gopher);
        expect(memControls[0].text).to.equal("Memorization Schedule");
        const didYouRemember = memorize.renderDidYouRemember(gopher);
        expect(didYouRemember).to.not.be.null;
        const memInfo = memorize.getMemInfo(gopher);
        expect(memInfo).to.not.be.null;
        const changeFreqBtns = memorize.changeFrequencyButtonsWithChart(gopher);
        expect(changeFreqBtns).to.not.be.null;
      });
      const app = gopherApp.exportApp();
      const webhook = require("./_fixtures/memCreated.json");
      await sendWebhook({ app, webhook });
    });

    it("gives different intros for repeating reminders", async function() {
      gopherApp.onCommand("memorize", gopher => {
        gopher.webhook.setTaskData("mem.repeat_last_reminder_ct", 1);
        let renderRepeatMessage = memorize.renderRepeatMessage(gopher);
        expect(renderRepeatMessage.text).to.contain("2 more reminders");

        gopher.webhook.setTaskData("mem.repeat_last_reminder_ct", 2);
        renderRepeatMessage = memorize.renderRepeatMessage(gopher);
        expect(renderRepeatMessage.text).to.contain("1 more reminder");

        gopher.webhook.setTaskData("mem.repeat_last_reminder_ct", 3);
        renderRepeatMessage = memorize.renderRepeatMessage(gopher);
        expect(renderRepeatMessage.text).to.contain("paused");
      });
      await sendWebhook({ gopherApp });
    });
  });

  describe("middleware", function() {
    it("handles the 'did you remember - yes no' email action", async function() {
      try {
        gopherApp.app.use(memorize.handleDidYouRemember);
        const webhook = require("./_fixtures/memorizationCheck.json");
        const beforeTriggerTime = webhook.task.trigger_time || 0;
        const beforeReminderNum =
          webhook.task.stored_data.mem.reminder_num || 0;
        const beforeHistoryLength =
          webhook.task.stored_data.mem.history.length || 0;
        const res = await sendWebhook({ webhook });
        expect(res.body.task.stored_data.mem.reminder_num).to.eq(
          beforeReminderNum + 1
        );
        expect(res.body.task.stored_data.mem.repeat_last_reminder_ct).to.eq(
          "no_reminders"
        );
        expect(res.body.task.trigger_time).to.be.gt(beforeTriggerTime);
        expect(res.body.task.stored_data.mem.history.length).to.be.gt(
          beforeHistoryLength
        );
      } catch (e) {
        console.log(e);
        debugger;
      }
    });

    it("handles frequency updates", async function() {
      gopherApp.app.use(memorize.handleMemorizationControls);
      const webhook = require("./_fixtures/freqUpdated.json");
      webhook.task.stored_data.mem.repeat_last_reminder_ct = 2;
      const res = await sendWebhook({ webhook });
      expect(res.body.task.stored_data.mem.frequency_pref).to.eq("50");
      // updating freq resets the repeat_last_reminder_ct
      expect(res.body.task.stored_data.mem.repeat_last_reminder_ct).to.eq(
        "no_reminders"
      );
      // updating freq again reschedules the reminder
      expect(res.body.task.trigger_time).to.be.gt(Date.now() / 1000);
    });

    it("increments repeat_last_reminder_ct with each trigger", async function() {
      try {
        gopherApp.app.use(memorize.handleMemTrigMiddlware);
        const webhook = require("./_fixtures/memorizationTriggered.json");
        webhook.task.stored_data.mem.repeat_last_reminder_ct = "no_reminders";
        let res = await sendWebhook({ webhook });
        expect(res.body.task.stored_data.mem.repeat_last_reminder_ct).to.eq(0);
        webhook.task.stored_data.mem.repeat_last_reminder_ct = 1;
        res = await sendWebhook({ webhook });
        expect(res.body.task.stored_data.mem.repeat_last_reminder_ct).to.eq(2);
        webhook.task.stored_data.mem.repeat_last_reminder_ct = 2;
        res = await sendWebhook({ webhook });
        expect(res.body.task.stored_data.mem.repeat_last_reminder_ct).to.eq(3);
      } catch (e) {
        console.log(e);
        debugger;
      }
    });

    it("turns off reminder if user fails to respond", async function() {
      gopherApp.app.use(memorize.handleMemTrigMiddlware);
      const webhook = require("./_fixtures/memorizationTriggered.json");
      webhook.task.stored_data.mem.repeat_last_reminder_ct = 4;
      const res = await sendWebhook({ webhook });
      expect(res.body.task.completed).to.eq(1);
    });
  });
});
