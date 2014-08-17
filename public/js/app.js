(function(){
    angular.module('hebFN', [
	'ngRoute',
	'fnExplore',
	'hebFN.manageFrame'
    ]).
	config(['$routeProvider', config]);

    function config($routeProvider) {
	$routeProvider.
	    when('/:frame?', {
		templateUrl: 'partials/explore.html',
		controller: 'exploreMain',
		controllerAs: 'explore'
	    }).
	    when('/:frame/manage', {
		templateUrl: 'partials/manage-frame.html',
		controller: 'manageFrame',
		controllerAs: 'manageFrame'
	    });
    }
})();
