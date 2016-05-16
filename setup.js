var Promise = require('bluebird');
var catapult = require('node-bandwidth');
var Application = Promise.promisifyAll(catapult.Application);
var PhoneNumber = Promise.promisifyAll(catapult.PhoneNumber);
var AvailableNumber = Promise.promisifyAll(catapult.AvailableNumber);
var fs = require('fs');
var indexHTML = fs.readFileSync('./index.html', 'utf8');

// Searches through application names and returns ID if matched
var searchForApplication = function (applications, config) {
  for (var i = 0; i < applications.length; i += 1) {
    if (applications[i].name === config.appName) {
      return applications[i].id;
    }
  }
  return false;
};

// Gets the first number associated with an application
var fetchTNByAppId = function (applicationId, config) {
  return PhoneNumber.listAsync({
    applicationId: applicationId
  })
  .then(function (numbers) {
    config.app.tn = numbers[0].number;
    console.log('Found Number: ' + config.app.tn);
    return config.app.tn;
  });
};

// Creates a new application then orders a number and assigns it to application
var newApplication = function (config) {
  var applicationId;
  return Application.createAsync({
    name: config.appName,
    incomingMessageUrl: config.app.callbackUrl + '/msgcallback/',
    incomingCallUrl: config.app.callbackUrl + '/callcallback/',
    callbackHttpMethod: 'post',
    autoAnswer: false
  })
  .then(function (application) {
    // search an available number
    console.log('Created Application: ' + application.id);
    applicationId = application.id;
    return AvailableNumber.searchLocalAsync({
      areaCode: '919',
      quantity: 1
    });
  })
  .then(function (numbers) {
    // and reserve it
    console.log('Found Number: ' + numbers[0].number);
    config.app.tn = numbers[0].number;
    return PhoneNumber.createAsync({
      number: config.app.tn,
      applicationId: applicationId
    });
  });
};

// Checks the current Applications to see if we have one.
// var configureApplication = function (appName, appCallbackUrl) {
var configureApplication = function (config) {
  return Application.listAsync({
    size: 1000
  })
  .then(function (applications) {
    // var applicationId = searchForApplication(applications, appName);
    var applicationId = searchForApplication(applications, config);
    var ret;
    if (applicationId) {
      console.log('Application Found');
      ret = fetchTNByAppId(applicationId, config);
    } else {
      console.log('No Application Found');
      ret = newApplication(config);
    }
    return ret;
  });
};

var makeWebPage = function (phoneNumber, res) {
  phoneNumber = phoneNumber.replace('+1', '');
  phoneNumber =
    phoneNumber.substr(0, 3) + '-' +
    phoneNumber.substr(3, 3) + '-' +
    phoneNumber.substr(6, 4);
  var html = indexHTML.replace('PHONE_NUMBER', phoneNumber);
  res.set('Content-Type', 'text/html');
  res.send(html);
};

module.exports.init = function (config) {
  if (config.app.tn === undefined) {
    configureApplication(config)
    .then(function () {
      makeWebPage(config.app.tn, config.res);
    })
    .catch(function (e) {
      console.log(e);
      config.res.status(500).send(e);
    });
  } else {
    makeWebPage(config.app.tn, config.res);
  }
};
