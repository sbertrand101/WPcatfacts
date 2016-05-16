var LIMIT_CHARACTERS = false; // Boolean to send rich messages or only 160 characters
var setup = require('./setup.js');
var express = require('express');
var catapult = require('node-bandwidth');
var bodyParser = require('body-parser');
var wikipedia = require('wtf_wikipedia');
var request = require('request');
var Tokenizer = require('sentence-tokenizer');

var app = express();
var http = require('http').Server(app);

catapult.Client.globalOptions.userId = process.env.CATAPULT_USER_ID;
catapult.Client.globalOptions.apiToken = process.env.CATAPULT_API_TOKEN;
catapult.Client.globalOptions.apiSecret = process.env.CATAPULT_API_SECRET;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.set('port', (process.env.PORT || 8000));

var sendMessage = function (text, queryObject) {
  var tokenizer = new Tokenizer('Chuck');
  tokenizer.setEntry(text);
  if (tokenizer.getSentences().length >= 2 && LIMIT_CHARACTERS === false) {
    text = tokenizer.getSentences()[0] + ' ' + tokenizer.getSentences()[1];
  } else {
    text = text.substring(0, 159);
  }
  catapult.Message.create({
    from: queryObject.to,
    to: queryObject.from,
    text: text
  }, function (err, msg) {
    if (err) {
      return console.error('Error:  ' + err.message);
    }
    console.log('message id is' + msg.id);
  });
};

var sendMMSMessage = function (catapultUrl, title, query, queryObject) {
  catapult.Message.create({
    from: queryObject.to,
    to: queryObject.from,
    text: title,
    media: catapultUrl
  }, function (err, msg) {
    if (err) {
      return console.error('Error:  ' + err.message);
    }
    console.log('message id is: ' + msg.id);
  });
};

var argsParse = function (req) {
  var queryObject = {
    query: req.body.text.trim(),
    from: req.body.from,
    to: req.body.to
  };
  if (queryObject.query.toLowerCase().indexOf(' picture', queryObject.query.length - ' picture'.length) !== -1) {
    queryObject.queryType = 'picture';
    queryObject.query = queryObject.query.slice(0, queryObject.query.length - ' picture'.length).replace(/ /g, '_');
  } else if (queryObject.query.toLowerCase().indexOf(' topics', queryObject.query.length - ' topics'.length) !== -1) {
    queryObject.queryType = 'topics';
    queryObject.query = queryObject.query.slice(0, queryObject.query.length - ' topics'.length).replace(/ /g, '_');
  } else if (queryObject.query.toLowerCase().indexOf(' fact', queryObject.query.length - ' fact'.length) !== -1) {
    queryObject.queryType = 'fact';
    queryObject.query = queryObject.query.slice(0, queryObject.query.length - ' fact'.length).replace(/ /g, '_');
  } else if (queryObject.query.toLowerCase().indexOf('(') > -1) {
    queryObject.queryType = 'topic';
    queryObject.topic = queryObject.query.slice(queryObject.query.indexOf('(') + 1, queryObject.query.lastIndexOf(')'));
    queryObject.query = queryObject.query.slice(0, queryObject.query.indexOf('(')).trim().replace(/ /g, '_');
  } else {
    queryObject.queryType = 'data';
  }
  console.log(queryObject);
  return queryObject;
};

var formatText = function (text, query) {
  var formattedText = text.slice(0, 2000);
  if (formattedText.toLowerCase().slice(0, 2047).indexOf('taxobox') > 0) {
    console.log('cutting');
    var slice = Math.max(formattedText.lastIndexOf('}'),
                    formattedText.lastIndexOf('|'),
                    formattedText.lastIndexOf('>'),
                    formattedText.toLowerCase().lastIndexOf('taxobox'),
                    formattedText.toLowerCase().indexOf(query.toLowerCase())
                    );
    console.log(slice);
    formattedText = formattedText.slice(slice);
  }
  formattedText = formattedText.slice(0, 2047);
  return formattedText;
};

var getWPData = function (queryObject) {
  var formattedText = formatText(wikipedia.plaintext(queryObject.markup), queryObject.query);
  if (queryObject.from === 'console') {
    console.log('Formatted to: ' + formattedText);
  } else {
    sendMessage(formattedText, queryObject);
  }
};

var getWPImage = function (url, title, query, queryObject) {
  var titleNoSpaces = title.replace(/ /g, '');
  request({url: url}, function (err) {
    if (err) {
      console.error(err);
    }
  }).pipe(request({
    uri: '/v1/users/' + catapult.Client.globalOptions.userId + '/media/' + titleNoSpaces,
    baseUrl: 'https://api.catapult.inetwork.com',
    method: 'PUT',
    auth: {
      user: catapult.Client.globalOptions.apiToken,
      password: catapult.Client.globalOptions.apiSecret
    }
  }, function (err, res) {
    if (err) {
      console.error(err);
    } else {
      var catapultUrl = res.req.res.request.href;
      console.log(catapultUrl);
      sendMMSMessage(catapultUrl, title, query, queryObject);
    }
  }));
};

var getWPImageURL = function (queryObject) {
  var imageRegex = /[:|=][^:|=]+.((jpg)|(png))/;
  var match = imageRegex.exec(queryObject.markup);
  console.log('matching with' + match);
  console.log('output startwith' + queryObject.markup.slice(0, 200));
  if (match) {
    var title = 'File:' + match[0].slice(1);
    console.log(title);
    var options = {
      url: 'http://commons.wikimedia.org/w/api.php',
      qs: {
        action: 'query',
        titles: title,
        prop: 'imageinfo',
        iiprop: 'url',
        iiurlwidth: '640px',
        format: 'json'
      }
    };
    request(options, function (err, res, body) {
      if (!err && res.statusCode === 200) {
        var data = JSON.parse(body);
        var page = Object.keys(data.query.pages)[0];
        console.log(data.query.pages);
        var imgurl = data.query.pages[page].imageinfo[0].thumburl;
        getWPImage(imgurl, title, queryObject.query, queryObject);
      } else {
        console.error('nop');
      }
    });
  } else {
    sendMessage('No Images Available. Sry :(', queryObject);
  }
};

var getWPTopics = function (queryObject) {
  sendMessage(Object.keys(queryObject.parsed.text).map(function (key) {
    var locSecondSpace = key.indexOf(' ', (key.indexOf(' ') + 1) + 1);
    return key.slice(0, (locSecondSpace > 0) ? locSecondSpace : key.length);
  }).join(', ').slice(0, 2047), queryObject.from, queryObject);
};

var getWPTopic = function (queryObject) {
  var keys = Object.keys(queryObject.parsed.text);
  var normkeys = Object.keys(queryObject.parsed.text).map(function (key) {
    var locSecondSpace = key.indexOf(' ', (key.indexOf(' ') + 1) + 1);
    return key.slice(0, (locSecondSpace > 0) ? locSecondSpace : key.length).toLowerCase();
  });
  var topicKeyIndex = 0;
  for (var k in normkeys) {
    if (normkeys[k].indexOf(queryObject.topic.toLowerCase()) > -1) {
      topicKeyIndex = k;
    }
  }
  sendMessage(queryObject.parsed.text[keys[topicKeyIndex]][0].text.slice(0, 2047), queryObject);
};

var getWPFact = function (queryObject) {
  var keyIndex = Math.floor(Math.random() * Object.keys(queryObject.parsed.text).length);
  var key = Object.keys(queryObject.parsed.text)[keyIndex];
  var factIndex = Math.floor(Math.random() * queryObject.parsed.text[key].length);
  sendMessage(queryObject.parsed.text[key][factIndex].text.slice(0, 2047), queryObject);
};

var startQuery = function (queryObject) {
  var functions = {
    picture: getWPImageURL,
    topics: getWPTopics,
    topic: getWPTopic,
    fact: getWPFact,
    data: getWPData
  };
  console.log(queryObject.from + ' is asking about ' + queryObject.query);

  wikipedia.from_api(queryObject.query, 'en', function (markup) {
    var parsed = wikipedia.parse(markup);
    if (parsed && (parsed.type === 'redirect')) {
      queryObject.query = parsed.redirect;
      startQuery(queryObject);
    } else if (parsed.type === 'disambiguation') {
      queryObject.query = parsed.pages[0];
      startQuery(queryObject);
    } else if (parsed.type === 'page' && Object.keys(parsed.text).length === 0) {
      var errorMessage = 'I don\'t know about ' + queryObject.query + '. sry :(';
      if (queryObject.from === 'console') {
        console.log(errorMessage);
      } else {
        sendMessage(errorMessage, queryObject);
      }
    } else {
      queryObject.parsed = parsed;
      queryObject.markup = markup;
      functions[queryObject.queryType](queryObject);
    }
  });
};

app.post('/msgcallback', function (req, res) {
  var qo = argsParse(req);
  res.sendStatus(201);
  startQuery(qo);
});

var getBaseUrlFromReq = function (req) {
  return 'http://' + req.hostname;
};

app.get('/', function (req, res) {
  app.callbackUrl = getBaseUrlFromReq(req);
  setup.init({
    req: req,
    res: res,
    app: app,
    appName: 'WikiText-' + app.callbackUrl
  });
});

http.listen(app.get('port'), function () {
  console.log('listening on *:' + app.get('port'));
});
