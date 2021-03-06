// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
angular.module('breakpoint', ['ionic', 'breakpoint.controllers', 'breakpoint.directives', 'picardy.fontawesome'])

.run(function($ionicPlatform) {
	$ionicPlatform.ready(function() {
		// Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
		// for form inputs)
		if(window.cordova && window.cordova.plugins.Keyboard) {
			cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
		}
		if(window.StatusBar) {
			StatusBar.styleDefault();
		}
	});
})

.config(function($stateProvider, $urlRouterProvider) {
	$stateProvider

	.state('app', {
		url: '',
		abstract: true,
		controller: 'AppCtrl',
		templateUrl: 'index.html',
	})

	.state('app.landing', {
		url: '/',
		templateUrl: 'templates/landing.html',
		controller: 'LandingCtrl'
	})

	.state('app.browse', {
		url: '/browse',
		templateUrl: 'templates/browse.html',
		controller: 'BrowseCtrl'
	})

	.state('app.category', {
		url: '/browse/:categoryName/:subcategory',
		templateUrl: 'templates/category.html',
		controller: 'CategoryCtrl'
	})

	.state('app.subcategory', {
		url: '/browse/:categoryName',
		templateUrl: 'templates/subcategory.html',
		controller: 'SubcategoryCtrl'
	})

	.state('app.search', {
		url: '/search?q',
		templateUrl: 'templates/search.html',
		controller: 'SearchCtrl'
	})

    .state('app.video', {
        url: "/video/:youtubeVideoId",
        templateUrl: 'templates/video.html',
        controller: 'VideoCtrl'
    })

    .state('app.create', {
        url: "/create/:youtubeVideoId",
        templateUrl: 'templates/create_breakpoint_video.html',
        controller: 'CreateBreakpointVideoCtrl'
    })

    .state('app.addBreakpoints', {
        url: "/add-breakpoints/:youtubeVideoId",
        templateUrl: 'templates/add_breakpoints.html',
        controller: 'AddBreakpointsCtrl'
    })

	// if none of the above states are matched, use landing page as the fallback
	$urlRouterProvider.otherwise('/');
})
