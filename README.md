# WPcatfacts
App that leverages the [Bandwidth catapult API](http://ap.bandwidth.com//?utm_medium=social&utm_source=github&utm_campaign=dtolb&utm_content=_) to give you succint information about any topic over SMS.  It relies predominantly on Wikipedia, so basically it's a wikipedia interface for when you don't have 3G.
[![Screen Shot](/readme_images/screenshot.png?raw=true)](https://frozen-springs-97288.herokuapp.com/)

Demos uses of the:
* [Catapult Node SDK](https://github.com/bandwidthcom/node-bandwidth)
* [Creating Application](http://ap.bandwidth.com/docs/rest-api/applications/?utm_medium=social&utm_source=github&utm_campaign=dtolb&utm_content=_)
* [Searching for Phone Number](http://ap.bandwidth.com/docs/rest-api/available-numbers/#resourceGETv1availableNumberslocal/?utm_medium=social&utm_source=github&utm_campaign=dtolb&utm_content=_)
* [Ordering Phone Number](http://ap.bandwidth.com/docs/rest-api/phonenumbers/#resourcePOSTv1usersuserIdphoneNumbers/?utm_medium=social&utm_source=github&utm_campaign=dtolb&utm_content=_)
* [Sending MMS](http://ap.bandwidth.com/docs/rest-api/messages/#resourcePOSTv1usersuserIdmessages/?utm_medium=social&utm_source=github&utm_campaign=dtolb&utm_content=_)
* [Sending SMS](http://ap.bandwidth.com/docs/rest-api/messages/#resourcePOSTv1usersuserIdmessages/?utm_medium=social&utm_source=github&utm_campaign=dtolb&utm_content=_)

## Prerequisites
- Configured Machine with Ngrok/Port Forwarding -OR- Heroku Account
  - [Ngrok](https://ngrok.com/)
  - [Heroku](https://www.heroku.com/)
- [Catapult Account](http://ap.bandwidth.com/?utm_medium=social&utm_source=github&utm_campaign=dtolb&utm_content=_)
- [Node 4.2+](https://nodejs.org/en/download/releases/)

## Deploy To PaaS

#### Env Variables Required To Run
* ```CATAPULT_USER_ID```
* ```CATAPULT_API_TOKEN```
* ```CATAPULT_API_SECRET```

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

#### *Once deployed, visit the site to view phone number!*


## How it works?
WPcatfacts has a single callback ```/msgcallback``` that handles inbound text messages

### Incoming Messages
![Basic Flow](/readme_images/flow.png?raw=true)

## What to try
* cat
* cat picture
* cat fact
* cat topics
* cat (topic)
* Raleigh
* North Carolina picture

You can get facts about things that aren't cats but then again why would you.