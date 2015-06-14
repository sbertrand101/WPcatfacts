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
  startQuery(req.body.text, req.body.from);
  res.send({});
});

app.get("/", function(req, res) {
  res.send("there is a website here");
});

console.log("start");
app.listen(process.env.PORT || 8000);

var startQuery = function(text, from) {
  var queryObject = argsParse(text);
  console.log("query is: " + queryObject.query);
  console.log(queryObject);
  console.log(from + ' is asking about ' + text);
  if (queryObject.picture) {
    getWPImageURL(queryObject.query, from);
  } else if (queryObject.topics) {
    getWPTopics(queryObject.query, from);
  } else if (queryObject.topic) {
    getWPTopic(queryObject.query, queryObject.topic, from)
  } else if (queryObject.fact) {
    getWPFact(queryObject.query, from);
  } else {
    getWPData(queryObject.query, from);
  }
}

var argsParse = function(request) {
  var queryObject = {};
  queryObject.query = request;
  // var args = request.split(' ');
  // for (arg in args) {
  //   if (args[arg][0] === '-') {
  //     queryObject[args[arg].slice(1)] = true;
  //   }
  // }
  // queryObject.query = request.replace(/-[^\s]*/, '');
  if (queryObject.query.indexOf(' picture', queryObject.query.length - ' picture'.length) !== -1) {
    queryObject.picture = true;
    queryObject.query = queryObject.query.slice(0, queryObject.query.length - ' picture'.length);
  } else if (queryObject.query.indexOf(' topics', queryObject.query.length - ' topics'.length) !== -1) {
    queryObject.topics = true;
    queryObject.query = queryObject.query.slice(0, queryObject.query.length - ' topics'.length);
  } else if (queryObject.query.indexOf(' fact', queryObject.query.length - ' fact'.length) !== -1) {
    queryObject.fact = true;
    queryObject.query = queryObject.query.slice(0, queryObject.query.length - ' fact'.length);
  } else if (queryObject.query.indexOf('(') > -1) {
    queryObject.topic = queryObject.query.slice(queryObject.query.indexOf('(')+1, queryObject.query.lastIndexOf(')'));
    queryObject.query = queryObject.query.slice(0, queryObject.query.indexOf('(')).trim();
    console.log(queryObject);
  }
  return queryObject;
}

var getWPData = function(query, from) {
  wikipedia.from_api(query, "en", function(markup){
    var output = wikipedia.parse(markup);
    if (output && (output.type === 'redirect')) {
      getWPData(output.redirect, from);
    } else if (output.type === 'page' && Object.keys(output.text).length === 0) {
      if (from === 'console') {
        console.log("I don't know about " + query + ". sry :(");
        promptings();         
      } else {
        sendMessage("I don't know about " + query + ". sry :(", from);
      }
    } else {
      console.log("output text is: " + output.text);
      var formattedText = formatText(wikipedia.plaintext(markup), query);
      if(from === 'console') {
        console.log('Formatted to: ' + formattedText);
        promptings(); 
      } else {
        sendMessage(formattedText, from);
      }
    }
  });
};

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

var promptings = function() {
  prompt.get('string', function(err, output) {
    startQuery(output.string, 'console');
  });
}

prompt.start();
promptings();

var getWPImageURL = function(query, from) {
  wikipedia.from_api(query, "en", function(output) {
    var parsed = wikipedia.parse(output);
    if (parsed.type === 'redirect') {
      getWPImageURL(parsed.redirect, from);
    } else {
      imageRegex = /[:|=][^:|=]+.((jpg)|(png))/
      var match = imageRegex.exec(output);
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
            getWPImage(imgurl, title, query, from);
          } else {
            console.error('nop');
          }
        });
      } else {
        //console.log(page);
        sendMessage("No Images Available. Sry :(", from);
      }     
    }
  });  
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

var getWPTopics = function(query, from) {
  wikipedia.from_api(query, "en", function(output) {
    var parsed = wikipedia.parse(output);
    if (parsed.type === 'redirect') {
      getWPTopics(parsed.redirect, from);
    } else {
      // console.log(Object.keys(parsed.text).map(function(key) {
      //   var locSecondSpace = key.indexOf(' ', (key.indexOf(' ')+1)+1);
      //   return key.slice(0, (locSecondSpace > 0) ? locSecondSpace : key.length);
      // }).join(', ').slice(0,159));

      sendMessage(Object.keys(parsed.text).map(function(key){
        var locSecondSpace = key.indexOf(' ', (key.indexOf(' ')+1)+1);
        return key.slice(0, (locSecondSpace > 0) ? locSecondSpace : key.length)
      }).join(', ').slice(0,159), from);
    }
  });    
};

var getWPTopic = function(query, topic, from) {
  wikipedia.from_api(query, "en", function(output) {
    var parsed = wikipedia.parse(output);
      if (parsed.type === 'redirect') {
        getWPTopic(parsed.redirect, topic, from);
      } else {
        var keys = Object.keys(parsed.text);
        var normkeys = Object.keys(parsed.text).map(function(key) {
          var locSecondSpace = key.indexOf(' ', (key.indexOf(' ')+1)+1);
          return key.slice(0, (locSecondSpace > 0) ? locSecondSpace : key.length).toLowerCase();
        });
        var topicKeyIndex = 0;
        for (k in normkeys) {
          if(normkeys[k].indexOf(topic.toLowerCase()) > -1) {
            topicKeyIndex = k;
          }
        }
        sendMessage(parsed.text[keys[topicKeyIndex]][0].text.slice(0, 159), from);
      }
  });
}

var getWPFact = function(query, from) {
  wikipedia.from_api(query, "en", function(output) {
    var parsed = wikipedia.parse(output);
    if (parsed.type === 'redirect') {
      getWPFact(parsed.redirect, from);
    } else {
      var keyIndex = Math.floor(Math.random()*Object.keys(parsed.text).length);
      var key = Object.keys(parsed.text)[keyIndex];
      var factIndex = Math.floor(Math.random()*parsed.text[key].length);
      sendMessage(parsed.text[key][factIndex].text.slice(0,159), from);
    }
  });
}