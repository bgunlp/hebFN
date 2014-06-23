
function AddSentsCtrl($scope, $routeParams,utils) {
    $scope.selectedLUName=$routeParams.luname;
    $scope.selectedLUShortName =$scope.selectedLUName.split(".")[0];
    $scope.selectedLUShortPos =$scope.selectedLUName.split(".")[1];

    $scope.selectedFrameName=$routeParams.framename;
    $scope.currentSentences=[];
    $scope.foundSentences=[];
    $scope.updateCurrentSents=function()
    {
        utils.CallServerGet("heb/ludata",
            {
                framename:$scope.selectedFrameName,
                luname:$scope.selectedLUName
            },
            function(out){
                $scope.currentSentences=out.sentences;
                $scope.$apply();}
        );
    };
    $scope.updateCurrentSents();

    var obj = {
	data: {
	    luname: $scope.selectedLUName,
	    framename: $scope.selectedFrameName
	},
	sentence: {
	    action: "addtolu",
	    content: {}
	}
    };

    $scope.associateSentence = function(sent){
	obj.sentence.content = sent.fullSentence;
	console.log(obj);
	utils.CallServerPost("heb/addSentenceToLU", obj, function(out){
	    $scope.updateCurrentSents();
	    console.log(out);
	});
    };

    $scope.showLoader = true;
    utils.CallServerGet("external/exampleSentences",{lupos:$scope.selectedLUShortPos,luname:$scope.selectedLUShortName,diversify:false},function(out)
    {
        $scope.foundSentences=out;
        $scope.showLoader = false;
        $scope.$apply();

    });

    utils.CallServerGet("heb/getexmsentencebylu",
        {
            framename: "Accuracy", //$scope.selectedFrameName, TODO: remove stub
            luname: "תבע.v" //$scope.selectedLUName TODO: remove stub
        },        function(out)
        {
            $scope.correlatedSentences=out;
            $scope.$apply();
        });

}
