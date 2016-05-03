var Promise = require('bluebird');
var catapult = require('node-bandwidth');
var Application = Promise.promisifyAll(catapult.Application);
var PhoneNumber = Promise.promisifyAll(catapult.PhoneNumber);
var AvailableNumber = Promise.promisifyAll(catapult.AvailableNumber);

// Searches through application names and returns ID if matched
var searchForApplication = function (applications, name) {
	for (var i = 0; i < applications.length; i+=1) {
			if ( applications[i].name === name) {
				return applications[i].id;
			}
		}
	return false;
};

// Gets the first number associated with an application
var fetchTNByAppId = function (applicationId) {
	return PhoneNumber.listAsync({
		applicationId: applicationId
	})
	.then(function (numbers) {
		app.tn = numbers[0].number;
		console.log('Found Number: ' + app.tn);
		return app.tn;
	});
};

// Creates a new application then orders a number and assigns it to application
var newApplication =function (appName, url) {
	var applicationId;
	return Application.createAsync({
			name: appName,
			incomingMessageUrl: url + '/msgcallback/',
			incomingCallUrl: url + '/callcallback/',
			callbackHttpMethod: 'get',
			autoAnswer: true
		})
		.then(function(application) {
			//search an available number
			console.log('Created Application: ' + application.id);
			applicationId = application.id;
			return AvailableNumber.searchLocalAsync({
				areaCode: '919',
				quantity: 1
			});
		})
		.then(function(numbers) {
			// and reserve it
			console.log('Found Number: ' + numbers[0].number);
			app.tn = numbers[0].number;
			return PhoneNumber.createAsync({
				number: app.tn,
				applicationId: applicationId
			});
		});
};

//Checks the current Applications to see if we have one.
var configureApplication = function (appName, appCallbackUrl) {
	return Application.listAsync({
		size: 1000
	})
	.then(function (applications) {
		var applicationId = searchForApplication(applications, appName);
		if(applicationId !== false) {
			console.log('Application Found');
			return fetchTNByAppId(applicationId);
		}
		else {
			console.log('No Application Found');
			return newApplication(appName, appCallbackUrl);
		}
	});
};



var makeWebPage = function (phoneNumber, res) {
	phoneNumber = phoneNumber.replace('+1', '');
	phoneNumber =
		phoneNumber.substr(0,3) + '-' +
		phoneNumber.substr(3,3) + '-' +
		phoneNumber.substr(6,4);
	var html = indexHTML.replace('PHONE_NUMBER', phoneNumber);
	res.set('Content-Type', 'text/html');
	res.send(html);
};

module.exports.init = function (config) {
	if (config.app.tn === undefined) {
		configureApplication(config.appName, config.app.callbackUrl)
		.then(function () {
			makeWebPage(config.app.tn, config.res);
		})
		.catch(function(e) {
			console.log(e);
			config.res.status(500).send(e);
		});
	}
	else {
		makeWebPage(config.app.tn, config.res);
	}
}