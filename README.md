# notman-housekeeping-bot
A housekeeping chatbot for Notman House.
The SLACK_TOKEN environment variable must be set. It's value for this bot defined at https://hackthehouseteam.slack.com/services/B3ULA4DH8

To set it on Heroku run heroku config:set SLACK_TOKEN=<SLACK BOT TOKEN>

Other parameters needs to be set:
heroku config:set KITCHEN_SENSOR=<KITCHEN_SENSOR_IP_ADDRESS>
heroku config:set KITCHEN_SENSOR_KEY=<KITCHEN_SENSOR_KEY>
heroku config:set KEEPERS_KEY=<KEEPERS_WEB_HOOK_TOKEN>
heroku config:set MANAGERS_KEY=<MANAGERS_WEB_HOOK_TOKEN>
heroku config:set ISSUE_KEY=<URL-key-QR/Bit.ly>
@bot joined #auto-pub channel at #SlacktheHouse stream.


