var express = require("express");
var catapult = require("node-bandwidth");
var bodyParser = require("body-parser");
var wikipedia = require("wtf_wikipedia");
var prompt = require("prompt");
var request = require("request");
var fs = require("fs");

var app = express();

var settings = require("./settings.json");

catapult.Client.globalOptions.userId = settings.userId;
catapult.Client.globalOptions.apiToken = settings.apiToken;
catapult.Client.globalOptions.apiSecret = settings.apiSecret;

var hostnumber = settings.hostnumber;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.post("/events/sms", function(req, res, next) {
  var qo = argsParse(req.body.text, req.body.from);
  startQuery(qo);
  res.send({});
});

app.get("/", function(req, res) {
  res.send("there is a website here");
});

app.listen(process.env.PORT || 8000);

var promptings = function() {
  prompt.get('string', function(err, output) {
    argsParse(output.string, 'console');
  });
}

prompt.start();

console.log("gogo awesome");
promptings();

var argsParse = function(text, from) {
  var queryObject = {};
  queryObject.query = text;
  queryObject.from = from;
  if (queryObject.query.indexOf(' picture', queryObject.query.length - ' picture'.length) !== -1) {
    queryObject.queryType = 'picture';
    queryObject.query = queryObject.query.slice(0, queryObject.query.length - ' picture'.length);
  } else if (queryObject.query.indexOf(' topics', queryObject.query.length - ' topics'.length) !== -1) {
    queryObject.queryType = 'topics';
    queryObject.query = queryObject.query.slice(0, queryObject.query.length - ' topics'.length);
  } else if (queryObject.query.indexOf(' fact', queryObject.query.length - ' fact'.length) !== -1) {
    queryObject.queryType = 'fact';
    queryObject.query = queryObject.query.slice(0, queryObject.query.length - ' fact'.length);
  } else if (queryObject.query.indexOf('(') > -1) {
    queryObject.queryType = 'topic';
    queryObject.topic = queryObject.query.slice(queryObject.query.indexOf('(')+1, queryObject.query.lastIndexOf(')'));
    queryObject.query = queryObject.query.slice(0, queryObject.query.indexOf('(')).trim();
  } else {
    queryObject.queryType = 'data';
  }
  console.log(queryObject);
  return queryObject;
}

var startQuery = function(queryObject) {
  var functions = {
    picture: getWPImageURL,
    topics: getWPTopics,
    topic: getWPTopic,
    fact: getWPFact,
    data: getWPData
  }
  console.log(queryObject.from + ' is asking about ' + queryObject.query);

  wikipedia.from_api(queryObject.query, "en", function(markup) {
    var parsed = wikipedia.parse(markup);
    if (parsed && (parsed.type === 'redirect')) {
      queryObject.query = parsed.redirect;
      startQuery(queryObject);
    } else if (parsed.type === 'page' && Object.keys(parsed.text).length === 0) {
      var errorMessage = "I don't know about " + queryObject.query + ". sry :(";
      if (queryObject.from === 'console') {
        console.log(errorMessage);
        promptings();
      } else {
        sendMessage(errorMessage, queryObject.from)
      }
    } else {
      queryObject.parsed = parsed;
      queryObject.markup = markup;
      console.log("query query query: " + queryObject);
      functions[queryObject.queryType](queryObject);
    }
  });
}

var getWPData = function(queryObject) {
  var formattedText = formatText(wikipedia.plaintext(queryObject.markup), queryObject.query);
  if(queryObject.from === 'console') {
    console.log('Formatted to: ' + formattedText);
    promptings(); 
  } else {
    sendMessage(formattedText, queryObject.from);
  }
}

var sendMessage = function(text, from) {
    catapult.Message.create({from:hostnumber, to: from, text: text}, function(err, msg) {
    if(err) {
      return console.log("gg " + err.message);
    }
    console.log("message id is" + msg.id)
  });
}

var formatText = function(text, query) {
  var formattedText = text.slice(0,2000);
  if (formattedText.toLowerCase().slice(0,159).indexOf('taxobox')) {
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
  formattedText = formattedText.slice(0,159);
  return formattedText;
}

var getWPImageURL = function(queryObject) {
  imageRegex = /[:|=][^:|=]+.((jpg)|(png))/
  var match = imageRegex.exec(queryObject.markup);
  console.log('matching with' + match);
  console.log('output startwith' + output.slice(0,200));
  if(match) {
    var title = 'File:' + match[0].slice(1);
    console.log(title);
    var options = {
      url: "http://commons.wikimedia.org/w/api.php",
      qs: {
        action: 'query',
        titles: title,
        prop: 'imageinfo',
        iiprop: 'url',
        iiurlwidth: '640px',
        format: 'json' 
      }
    }
    request(options, function(err, res, body) {
      if(!err && res.statusCode === 200) {
        var data = JSON.parse(body);
        var page = Object.keys(data.query.pages)[0];
        console.log(data.query.pages);
        var imgurl = data.query.pages[page].imageinfo[0].thumburl;
        getWPImage(imgurl, title, queryObject.query, queryObjectfrom);
      } else {
        console.error('nop');
      }
    });
  } else {
    //console.log(page);
    sendMessage("No Images Available. Sry :(", from);
  }     
}

var getWPImage = function(url, title, query, from) {
  var titleNoSpaces = title.replace(/ /g, '');
  request({url: url}, function(err, res, body) {
    }).pipe(request({
      uri: '/v1/users/' + catapult.Client.globalOptions.userId + '/media/' + titleNoSpaces,
      baseUrl: 'https://api.catapult.inetwork.com',
      method: 'PUT',
      auth: {
        user: catapult.Client.globalOptions.apiToken,
        password: catapult.Client.globalOptions.apiSecret
      }
    }, function(err, res, body) {
      var catapultUrl = res.req.res.request.href;
      console.log(catapultUrl);
      sendMMSMessage(catapultUrl, title, query, from);
    }));
}

var sendMMSMessage = function(catapultUrl, title, query, from) {
  console.log('title is: ' + title);
    catapult.Message.create({from:hostnumber, to: from, text: title, media: catapultUrl}, function(err, msg) {
    if(err) {
      return console.log("gg " + err.message);
    }
    console.log("message id is" + msg.id)
  });
};

var getWPTopics = function(queryObject) {
  sendMessage(Object.keys(queryObject.parsed.text).map(function(key){
    var locSecondSpace = key.indexOf(' ', (key.indexOf(' ')+1)+1);
    return key.slice(0, (locSecondSpace > 0) ? locSecondSpace : key.length)
  }).join(', ').slice(0,159), queryObject.from);
}


var getWPTopic = function(queryObject) {
  var keys = Object.keys(queryObject.parsed.text);
  var normkeys = Object.keys(queryObject.parsed.text).map(function(key) {
    var locSecondSpace = key.indexOf(' ', (key.indexOf(' ')+1)+1);
    return key.slice(0, (locSecondSpace > 0) ? locSecondSpace : key.length).toLowerCase();
  });
  var topicKeyIndex = 0;
  for (k in normkeys) {
    if(normkeys[k].indexOf(queryObject.topic.toLowerCase()) > -1) {
      topicKeyIndex = k;
    }
  }
  sendMessage(queryObject.parsed.text[keys[topicKeyIndex]][0].text.slice(0, 159), queryObject.from);
}

var getWPFact = function(queryObject) {
  var keyIndex = Math.floor(Math.random()*Object.keys(queryObject.parsed.text).length);
  var key = Object.keys(queryObject.parsed.text)[keyIndex];
  var factIndex = Math.floor(Math.random()*queryObject.parsed.text[key].length);
  sendMessage(queryObject.parsed.text[key][factIndex].text.slice(0,159), queryObject.from);
}
