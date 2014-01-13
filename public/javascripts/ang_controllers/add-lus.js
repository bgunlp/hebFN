var HashLU=function(pos,name)
{
    return String(pos)+"#"+String(name);
};

function AddLUsCtrl($scope, $routeParams,utils) {
    $scope.selectedFrameName=$routeParams.frame;
    $scope.selectedFrame=[];
    $scope.frameLus=[];
    $scope.selectedFrameHebLUs={};
    $scope.currLu = {};
    $scope.queryFields = ['word', 'lemma'];
    $scope.POSs={
        noun:"n",
        verb:"v", 
        adjective:"a",
        adverb:"adv",
        preposition:"prep",
        a: "" //empty option
    };
    utils.CallServerGet("eng/translations",
        {framename:$scope.selectedFrameName},
        function(out){
            $scope.frameLus=out;
            $scope.$apply();});

    $scope.refreshAll=function()
    {
        //$scope.hebLUsUpdating=true;
        utils.CallServerGet("heb/framedata",
        {framename:$scope.selectedFrameName},
        function(out){
            $scope.selectedFrame=out;
            var hlu=out.hebData.lexUnit
            if(hlu===undefined|| hlu===[])
            {
                $scope.selectedFrameHebLUs={};
            }
            else
            {
                var newDict={};
                for(var i=0;i<hlu.length;i++)
                {
                    var lu=hlu[i];
                    var pos=lu['@POS'].toLowerCase();
                    var name=lu['@name'].split(".")[0];
                    newDict[HashLU(name,pos)]={pos:pos,name:name};
                }
                $scope.selectedFrameHebLUs=newDict;
            }
            $scope.$apply();
            }); 
    };
    $scope.refreshAll();
          
    $scope.luTranslations=[];
    $scope.selectedEngLUIdx=-1;
    $scope.selectedHebLUIdx=-1; 
    
    $scope.addHebLU=function(name,pos,sure,comment,isTranslated)
    {
        var data= {   framename:$scope.selectedFrameName,
            luname:name,
            lupos:pos,
            action:(sure && "add" ||"query")

            };
        if(comment!==undefined && comment!=="")
        {
            data.comment=comment;
        }
        if(isTranslated && $scope.selectedEngLUIdx!==-1)
        {
            data.origluid=$scope.frameLus[ $scope.selectedEngLUIdx].luID;
            data.origluname=$scope.frameLus[ $scope.selectedEngLUIdx].name+"."+$scope.frameLus[ $scope.selectedEngLUIdx].pos.toLowerCase();
        }
        if( pos ===undefined|| pos ==="" ||
            name===undefined|| name==="")
        {
            return;
        }
        
        $scope.selectedFrameHebLUs[HashLU(name,pos)]={pos:pos,name:name};
        $(".add-lus-tooltip").hide();
        utils.CallServerPost("heb/frameLuAssociation", data,
        function(out){
            if(out.status!==undefined && out.status=="OK")
            {
                $scope.refreshAll();
            }
            });
    
                
    };
    $scope.removeHebLU=function(name,pos)
    {
       var data= {   framename:$scope.selectedFrameName,
            luname:name,
            lupos:pos,
            action:"delete"
            }; 
            
        delete $scope.selectedFrameHebLUs[HashLU(name,pos)];
        utils.CallServerPost("heb/frameLuAssociation", data,
        function(out){
        if(out.status!==undefined && out.status=="OK")
        {
            $scope.refreshAll();
        }
        });
    };
    $scope.updateLuTranslations=function(newIdx)
    {
        if($scope.frameLus==[])
        {
            return;
        }
        var newTranslations=[];
        $scope.selectedEngLUIdx=newIdx;
        $scope.currLu = $scope.frameLus[newIdx]
        for(var i=0;i<$scope.frameLus[newIdx].translation.length;i++)
        {
            var tr=$scope.frameLus[newIdx].translation[i];
            var trPos=tr.pos;
            for(var j=0;j<tr.vals.length;j++)
            {
                newTranslations.push({name:tr.vals[j],pos:$scope.POSs[trPos]});
            }
        }
        $scope.luTranslations=newTranslations;
    };
    

    $scope.getSelectedHebLU=function()
    {
        if($scope.selectedHebLUIdx==-1)
        {
            return {};
        }
        return $scope.luTranslations[$scope.selectedHebLUIdx];
    };

    $scope.foundSentences=-1;
    $scope.lastSentCall={};
    $scope.lastSentCallInProgress=false;
    $scope.loadSentencesForSelecteHebLU=function()
    {

        var pos=$scope.newLUPos;
        var name=$scope.newLUName;
        var what=$scope.searchWhat;

        //if(pos===undefined||name===undefined||pos===""||name==="")
        if(name===undefined||name==="")
        {
            $scope.searchedSentences=[];
            return;
        }
        $scope.foundSentences=-1;
        if($scope.lastSentCallInProgress)
        {
            $scope.lastSentCall.abort();
        }
        $scope.lastSentCallInProgress=true;
        $scope.lastSentCall=utils.CallServerGet("external/exampleSentences",{pos:pos,text:name, field: what},function(out)
            {
                $scope.foundSentences=out;

                for (var sent in out){
                    $scope.getSentenceCorr(out[sent]);
                    //get sent status from hebfn server and update



                }
                $scope.lastSentCallInProgress=false;
                $scope.$apply();
                $('*').tooltip({container: 'body'});

            });

    };


    $scope.getSentenceCorr = function(currSent){
        var lu = $scope.getSelectedHebLU();
        if (lu.name){
        var data  ={
            luname: lu.name + '.' + lu.pos.toLowerCase(),
            framename: $scope.currLu.frameName,
            sentid: currSent.id,
        }

        utils.CallServerGet("heb/getSentCorr", data,
            function(out){
                if (out){
                    currSent.status=out.status;
                    $scope.$apply();
                    if(out.status!==undefined && out.status=="OK")
                    {
                        $scope.refreshAll();
                    }

                }
            });
        }
    }


    $scope.newLUWasTranslated=false;
    $scope.selectHebLU=function(idx)
    {
        console.log("this is here: ", idx)
        $scope.selectedHebLUIdx=idx;
        if(idx!=-1)
        {
            $scope.newLUPos=$scope.getSelectedHebLU().pos;
            $scope.newLUName=$scope.getSelectedHebLU().name;
            $scope.newLUWasTranslated=true;
        }
        else
        {
            $scope.newLUPos="";
            $scope.newLUName="";
            $scope.newLUWasTranslated=false;
        }
    };
    
    $scope.addingSeggustion=false;
    
    var addTooltip=function(elemId,iconClass,onDone)
    {
        $(".heb-lus").on("click","."+iconClass,function(){
            $(".add-lus-tooltip").hide();//hide other tooltips
            var pos=$(this).parent().parent().position();
            $("#"+elemId).css({
                position:"absolute", 
                display:"block",
                top:pos.top, 
                left: pos.left});
            if(onDone!== undefined)
            {
                onDone();
            }
            $scope.$apply();    
            });
          
        $(".add-lus-tooltip#"+elemId+" .icon-remove").on("click",function(){
            $("#"+elemId).hide()});
        
    };
    addTooltip("sentences","icon-search",function(){$scope.loadSentencesForSelecteHebLU()});
    addTooltip("add-heb-lus","icon-question-sign",function(){ $scope.addingSeggustion=false});
    addTooltip("add-heb-lus","icon-plus-sign",function(){ $scope.addingSeggustion=true});
         
    $scope.newLUPos="";
    $scope.newLUName="";
    $scope.searchWhat="lemma";
    $scope.searchPos="";


    $scope.frameHist = [];
    $scope.getFrameHist = function(){
        utils.CallServerGet("heb/history",
            {framename: $scope.selectedFrameName},
            function(out){
                $scope.frameHist=out;
                $scope.$apply();});
    };

    $scope.getFrameHist();

    $scope.getDate = function(d){
        return (d.substring(0, d.indexOf('T')));
    }

    //$scope.histStrFunc = function () {return utils.createHistStr};
    //sleep(50)
    //$scope.histStr =  histStrFunc();

    $('*').tooltip({container: 'body'});

    $scope.setLuSentCorrelation  =function(sentid, status,text){
        //console.log(sentid,status)
       var lu = $scope.getSelectedHebLU();
        var data  ={
            luname: lu.name +'.'+ lu.pos.toLowerCase(),
            framename: $scope.currLu.frameName,
            sentid: sentid,
            status: status,
            text: text

        }

        utils.CallServerPost("heb/setSentCorr", data,
            function(out){
                if(out.status!==undefined && out.status=="OK")
                {
                    $scope.refreshAll();
                }
            });


    }
    $scope.ajaxresults = {};

    //TODO: finish to update this shit!!



}
