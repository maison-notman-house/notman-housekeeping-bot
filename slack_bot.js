/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/


This is a sample Slack bot built with Botkit.

This bot demonstrates many of the core features of Botkit:

* Connect to Slack using the real time API
* Receive messages based on "spoken" patterns
* Reply to messages
* Use the conversation system to ask questions
* Use the built in storage system to store and retrieve information
  for a user.

# RUN THE BOT:

  Get a Bot token from Slack:

    -> http://my.slack.com/services/new/bot

  Run your bot from the command line:

    token=<MY TOKEN> node slack_bot.js

# USE THE BOT:

  Find your bot inside Slack to send it a direct message.

  Say: "Hello"

  The bot will reply "Hello!"

  Say: "who are you?"

  The bot will tell you its name, where it is running, and for how long.

  Say: "Call me <nickname>"

  Tell the bot your nickname. Now you are friends.

  Say: "who am I?"

  The bot will tell you your nickname, if it knows one for you.

  Say: "shutdown"

  The bot will ask if you are sure, and then shut itself down.

  Make sure to invite your bot into other channels using /invite @<my bot>!

# EXTEND THE BOT:

  Botkit has many features for building cool and useful bots!

  Read all about it here:

    -> http://howdy.ai/botkit

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/


if (!process.env.SLACK_TOKEN) {
    console.log('Error: Specify SLACK_TOKEN in environment');
    process.exit(1);
}

var Botkit = require('./lib/Botkit.js');
var os = require('os');
var request = require('request');
var express = require('express');

var controller = Botkit.slackbot({
    debug: true,
});

var bot = controller.spawn({
    token: process.env.SLACK_TOKEN
}).startRTM();

var app = express();

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function (request, response) {
    response.render('pages/index');
});

// http://localhost:5000/api/v1/issue/<key>/toilet
app.get('/api/v1/issue/' + process.env.ISSUE_KEY + '/:location', function (req, res) {
    // the user was found and is available in req.user
    res.send('Thank you for reporting an issue at ' + req.params.location + '!');

    request.post("https://hooks.slack.com/services/" + process.env.MANAGERS_KEY, {
        json: { text: 'An iisue has been reported in ' + req.params.location }
    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body)
        }
    });
});


app.listen(app.get('port'), function () {
    console.log('Node app is running on port', app.get('port'));
});

controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', function (bot, message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    }, function (err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });


    controller.storage.users.get(message.user, function (err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, 'Hello.');
        }
    });
});

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function (bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function (err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user, function (err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function (bot, message) {

    controller.storage.users.get(message.user, function (err, user) {
        if (user && user.name) {
            bot.reply(message, 'Your name is ' + user.name);
        } else {
            bot.startConversation(message, function (err, convo) {
                if (!err) {
                    convo.say('I do not know your name yet!');
                    convo.ask('What should I call you?', function (response, convo) {
                        convo.ask('You want me to call you `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function (response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function (response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function (response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.next();

                    }, { 'key': 'nickname' }); // store the results in a field called nickname

                    convo.on('end', function (convo) {
                        if (convo.status == 'completed') {
                            bot.reply(message, 'OK! I will update my dossier...');

                            controller.storage.users.get(message.user, function (err, user) {
                                if (!user) {
                                    user = {
                                        id: message.user,
                                    };
                                }
                                user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function (err, id) {
                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                });
                            });



                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        }
    });
});


controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function (bot, message) {

    bot.startConversation(message, function (err, convo) {

        convo.ask('Are you sure you want me to shutdown?', [
            {
                pattern: bot.utterances.yes,
                callback: function (response, convo) {
                    convo.say('Bye!');
                    convo.next();
                    setTimeout(function () {
                        process.exit();
                    }, 3000);
                }
            },
            {
                pattern: bot.utterances.no,
                default: true,
                callback: function (response, convo) {
                    convo.say('*Phew!*');
                    convo.next();
                }
            }
        ]);
    });
});

controller.hears(['kitchen', 'cafe'],
    'direct_message,direct_mention,mention', function (bot, message) {

        var net = require('net');
        var client = new net.Socket();
        client.connect(1700, process.env.KITCHEN_SENSOR, function () {
            console.log('Kitchen sensor connected');
            client.write(process.env.KITCHEN_SENSOR_KEY); //key = '#Eg'; //'01234567'.decode('hex')
        });

        client.on('data', function (data) {
            console.log('Received: ' + data);
            bot.reply(message,
                'Kitchen sensor readings:' + data + '. Please consider to clean it.');

            bot.startConversation(message, function (err, convo) {

                convo.ask('Do you want to clean the kitchen?', [
                    {
                        pattern: bot.utterances.yes,
                        callback: function (response, convo) {


                            var msg_bot = controller.spawn({
                                incoming_webhook: {
                                    url: "https://hooks.slack.com/services/" + process.env.KEEPERS_KEY
                                }
                            })

                            msg_bot.sendWebhook({
                                text: '@keepers please clean the kitchen!',
                                channel: '#housekeeping',
                            }, function (err, res) {
                                if (err) {
                                    console.log('Got error for ' + "https://hooks.slack.com/services/" + process.env.KEEPERS_KEY);
                                    console.log(err);
                                    convo.say('The request to @keepers has not been delivered due an error');
                                }
                                else {
                                    convo.say('The request has been sent to @keepers');
                                }
                                convo.next();
                            });
                        }
                    },
                    {
                        pattern: bot.utterances.no,
                        default: true,
                        callback: function (response, convo) {
                            convo.say('*Ok!*');
                            convo.next();
                        }
                    }
                ]);
            });

            client.destroy(); // kill client after server's response
        });

        client.on('close', function () {
            console.log('Connection closed');
        });
    });

controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function (bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
            '>. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
};

// LUIS integration
var luis = require('./lib/luis-middleware.js');
var luisOptions = { serviceUri: process.env.LUIS_URL };

controller.middleware.receive.use(luis.middleware.receive(luisOptions));

controller.hears(['toilet', 'washroom', 'dirty', 'clean', 'missing', 'broken', 'bad', 'soap'],
    ['direct_message', 'direct_mention', 'mention'], luis.middleware.hereIntent,
    //controller.hears(['toilet', 'washroom', 'dirty', 'clean', 'missing', 'broken', 'bad', 'soap'], 'direct_message,direct_mention,mention', 
    function (bot, message) {
        console.log('Message intent: %j', message.topIntent.intent);
        console.log('Message intent score: %j', message.topIntent.score);
        if (message.topIntent.score<0.15){
            return;
        }
        controller.storage.users.get(message.user, function (err, user) {
            name = 'guest';
            if (user && user.name) {
                console.log('------------- name is ' + user.name);
                console.log('------------- user is ' + user);
                name = user.name;
            } else {
                console.log('------------- user is ' + user);
            }
            
            bot.startConversation(message, function (err, convo) {
                facility_reply = 'Thank you for reporting. Would you like the facility management';
                bot_reply = '';
                channel_key = process.env.MANAGERS_KEY;
                channel_name = '#house-decisions';
                if (message.topIntent.intent == 'ReplaceSomething'){
                    bot_reply = facility_reply + ' to replace it?';
                } else if (message.topIntent.intent == 'FixSomething') {
                    bot_reply = facility_reply + ' to fix it?';
                } else if (message.topIntent.intent == 'NeedSomething'){
                    bot_reply ='Thank you for reporting. Would you like the event organizers to know about your request?';
                    channel_key = process.env.EVENT_MANAGERS_KEY;
                    channel_name = '#event-managers';
                } else if (message.topIntent.intent == 'BookingAnEventSpace') {
                    bot_reply ='Thank you for reporting. Would you like the event organizers to assist with reservation?';
                    channel_key = process.env.EVENT_MANAGERS_KEY;
                    channel_name = '#event-managers';
                } else{
                    bot_reply = facility_reply + ' to know about it?';
                }

                convo.ask(bot_reply, [{
                    pattern: bot.utterances.yes,
                    callback: function (response, convo) {
                        var msg_bot = controller.spawn({
                            incoming_webhook: {
                                url: "https://hooks.slack.com/services/" + channel_key
                            }
                        })

                        msg_bot.sendWebhook({
                            text: 'New report: ' + message.text,
                            channel: channel_name,
                        }, function (err, res) {
                            if (err) {
                                console.log('Got error for ' + "https://hooks.slack.com/services/" + channel_key);
                                console.log(err);
                                convo.say('The report to managers has not been delivered due an error');
                            }
                            else {
                                convo.say('The report has been sent');
                            }
                            convo.next();
                        });
                    }
                },
                {
                    pattern: bot.utterances.no,
                    default: true,
                    callback: function (response, convo) {
                        convo.say('*Ok!*');
                        convo.next();
                    }
                }]);
            });
        });
    });
/*
controller.hears(['event', 'meeting', 'prepare', 'organize','book', 'space', 'fee', 'available', 'date', 'room', 'capacity', 'attendees', 'number'],
    ['direct_message', 'direct_mention', 'mention'], luis.middleware.hereIntent,
    function (bot, message) {
        console.log('Message evebt intent: %j', message.topIntent.intent);
        controller.storage.users.get(message.user, function (err, user) {
            name = 'guest';
            if (user && user.name) {
                console.log('------------- name is ' + user.name);
                console.log('------------- user is ' + user);
                name = user.name;
            } else {
                console.log('------------- user is ' + user);
            }
            
            bot.startConversation(message, function (err, convo) {
                bot_reply = 'Thank you for reporting. Would you like the event organizers ';
                if (message.topIntent.intent == 'NeedSomething'){
                    bot_reply = bot_reply + ' to know about your request?';
                } else if (message.topIntent.intent == 'BookingAnEventSpace') {
                    bot_reply = bot_reply + ' to assist with reservation?';
                } else {
                    bot_reply = bot_reply + ' to assist?';
                }

                convo.ask(bot_reply, [{
                    pattern: bot.utterances.yes,
                    callback: function (response, convo) {
                        var msg_bot = controller.spawn({
                            incoming_webhook: {
                                url: "https://hooks.slack.com/services/" + process.env.EVENT_MANAGERS_KEY
                            }
                        })

                        msg_bot.sendWebhook({
                            text: 'New report: ' + message.text,
                            channel: '#house-decisions',
                        }, function (err, res) {
                            if (err) {
                                console.log('Got error for ' + "https://hooks.slack.com/services/" + process.env.EVENT_MANAGERS_KEY);
                                console.log(err);
                                convo.say('The report to managers has not been delivered due an error');
                            }
                            else {
                                convo.say('The report has been sent to the facility management team');
                            }
                            convo.next();
                        });
                    }
                },
                {
                    pattern: bot.utterances.no,
                    default: true,
                    callback: function (response, convo) {
                        convo.say('*Ok!*');
                        convo.next();
                    }
                }]);
            });
        });
    });


*/

var schedule = require('node-schedule');
// runs every 15 minutes
var j = schedule.scheduleJob(process.env.CRON_DETECT, function () {
    console.log('Looking at sensors...00000');
});
