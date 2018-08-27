# Gopher Memorize

Set reminders for any gopher.email task using [spaced repetition](https://www.wikiwand.com/en/Spaced_repetition), a memorization technique that increases the time between reminders as more reminders are sent.

Depends on [gopher-app](https://www.npmjs.com/package/gopher-app).

## Usage

`npm install --save gopher-app gopher-memorize` then...

```javascript
var GopherApp = require("gopher-app");
var gopherApp = new GopherApp(); // See gopher-app repo for configuration

var memorizeSkill = require("gopher-memorize")(gopherApp);

gopherApp.onCommand("remember", function(gopher) {
  memorizeSkill.memorizeTask(gopher); //  ⬅ Tells Gopher to memorize your task
  gopher.webhook.quickResponse("Memorizing!");
  gopher.webhook.respond();
});

// Called each time the reminder is triggered, at increasingly further intervals
gopherApp.on("task.triggered", function(gopher) {
  memorizeSkill.memorizeTask(gopher); // ⬅ Gopher continues to memorize
  gopher.webhook.quickResponse("An email with decreasing frequency");
  gopher.webhook.respond();
});

gopherApp.listen();
```

### Spaced Repetition Algorithm

The reminder spacing is determined by this simple formula:

`daysUntilNextReminder = (numReminders ^ decayExponent) * frequencyPref`

For example, a user has received 3 reminders already, the [decay exponent](https://www.wikiwand.com/en/Exponential_decay) is 2.5 and this particular task they have a frequency preference of .5. Their next reminder would be in 7.79 days.

This is naive implementation and leaves room for improvement. See `date-helpers.js`. PRs are welcome!

### Config

Optionally pass a configuration object to override memorization defaults.

```javascript
// These are the default values
const memConfig = {
  defaultFrequencyPref: 1,
  frequencyPrefOptions: [0.1, 0.2, 0.5, 1, 1.5, 2, 5],
  decayExponent: 2.5
};
const memorizeSkill = require("gopher-memorize")(gopherApp, memConfig);

// Note: When passing custom a configuration, it will probably be easier to pass your configured skill via middleware.
gopherApp.app.use((req, res, next) => {
  const gopher = res.locals.gopher;
  gopher.skills.memorize = memorizeSkill;
  next();
});
```

When setting via middleware, future handlers can access it as follows:

```javascript
gopherApp.onCommand("test", gopher => {
  gopher.skills.memorize.memorizeTask();
  gopher.webhook.quickRespond("Memorizing this!");
  gopher.webhook.respond();
});
```

### Reference

The following methods are available within a handler always called within a handler.

### memorize.memorizeTask(gopher)

Start memorizing a task

### memorize.renderMemorizationControls(gopher);

Render UI to show and change memorization frequency

### memorize.changeMemFrequency(gopher, freq);

Change memorization frequency to a new (floating point) number;

### memorize.getMemInfo(gopher);

Retrieve informaiton about the current memorization. Specifically,
`reminderCount` and `frequencyPref`

## License

MIT
