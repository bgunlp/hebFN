(function(){
    angular.module('hebFN.manageFrame', [
	'hebFN.models',
	'hebFN.englishFrame',
	'hebFN.commentsWidget'
    ]).
	directive('manageFrame', manageFrame);

    manageFrame.$injector = ['frameDataService'];

    function manageFrame (){
	return {
	    restrict: 'E',
	    templateUrl: 'partials/manage-frame.html',
	    scope: {'frameName': '='},
	    controller: ctrl,
	    controllerAs: 'manageFrame'
	}
    }
    
    function ctrl ($scope, frameDataService) {
	var self = this;

	this.activeEngLU = '';
	this.activeEngLUIdx = -1;

	this.selectActiveEngLU = function(idx){
	    self.activeEngLUIdx = idx;
	    lu = self.frame.translations[idx];

	    fixedTranslations = [];
	    lu.translation.forEach(function(x) {
		fixedTranslations = fixedTranslations.concat(x.vals.map(function(y){
		    return {name: y, pos: x.pos[0]};
		}));
	    });

	    lu.translations = fixedTranslations;
	    self.activeEngLU = lu;
	}

	this.toggleMenu = function(idx) {
	    $('#menu'+idx).toggleClass('hide');
	}

	this.addComment = function(comment) {
	    self.frame.addComment(comment);
	};

	function deleteLU () {
	    console.log('deleting', self.selectedLU['@name']);
	    $('#delete-lu').modal('hide');
	};

	$('#delete-lu').on('show.bs.modal', function (e){
	    $('#delete-button').off('click').on('click', function () {
		deleteLU();
	    });
	});

	self.frame = frameDataService.getFrame($scope.frameName);
    }
})();
