/**
 * hebrew contorlller:
 * this page contains all the server and DB logic related to hebrew FN data.
 * the methods defined in this page are being used by the routes module and are depended on the models/schemes
 *
 */

printModule('controllers/hebrew');

var Models = require("../models/schemes/hebrew.js");
var userControl = require('../controllers/users.js');
var objID = require('mongoose').Types.ObjectId;
var q2coll = require('../tools/utils.js').queryToCollectionQ,
    handleHttpResults = require('../tools/utils.js').handleHttpResults,
    utils =require('../tools/utils.js');
var async = require('async'); //using async.parallel in order to gather frameData
var engControl = require("./english.js");




/******************************************READ actions****************************************/



/**
 *
 * @param req can contain id or name or q when id is number, name is string starting with capital letter, and q is json query  - using double quetes for internal strings
 * @param res
 * @param cb
 */
var loadFrame =exports.loadFrame = function loadFrame (query,proj,options,cb) {
    console.log("DEBUG: handling load-hebrew-frame request");
    var  engframeModel = Models.frameModel,
        q = q2coll(query, '@ID @name lexUnit.@ID lexUnit.@name - -'),
        qOptions = options ? options : {limit: 50, sort: {'@name' :1}};
    //console.log(q, proj, qOptions)
    Models.hebFrameModel.find(q,proj,qOptions,cb);
};


/**response with a json object with the data of a frame/s
 *@see API docs
 * TODO: move to routes
 * @param req
 * @param res
 */
exports.getFrame = function getFrame(req, res){
    console.log("DEBUG: handling get-hebrew-frame request");
    loadFrame(req.query,{},null,handleHttpResults(req,res))
}

/**this method returns single LU according to the requested query:
 * the query must contain - framename or frameid AND luname or luid - otherwise error will be returned
 * the query will search for the exact name (frame or lu ) - so pay attention to case sensitive
 * the response ,in case that an LU was found, will contain id of the frame, name of the frame and all the data of the SPECIFIC lu (no annotations)
 * @param req
 * @param res
 */
//TODO: need to index the luID and the lu.@name
var loadLu = exports.loadLu = function loadLu (query, proj, options, cb) {
    var qProj = proj || {"@ID":1, '@name':1, 'lexUnit':1}
    console.log("DEBUG: handling load hebrew lu request");
    if (!((query.luid || query.luname) && (query.framename || query.frameid)) ) return cb(new Error("some parameters are missing"),null);
    var resMode ='';
    query.strict=1;

    var q = q2coll(query,  '@ID @name lexUnit.@ID lexUnit.@name'),
        qOptions =options || {} ; // options ? options : {'limit' : 50, sort: {'lexUnit.@name': 1}};
    q['lexUnit'] = {'$exists':true}; //query optimization

    if (query.luid ){ //return single results - use element-match
        proj['lexUnit'] =  { '$elemMatch': { '@ID': objID(query.luid)}}   //this options is to return only the first element in the array that matches to the query
    }
    if (query.luname ){ //return single results - use element-match
        proj['lexUnit'] =  { '$elemMatch': { '@name': query.luname}}      //this options is to return only the first element in the array that matches to the query
    }

    Models.hebFrameModel.findOne(q,qProj, qOptions, cb)
};

//bridge TODO - move to routes
exports.getLu = function getLu(req, res){
    console.log("DEBUG: handling hebrew get-lu-frame request");
    loadLu(req.query,null,null,handleHttpResults(req,res))
};




/**search in the history database
 *
 * @param query  - contains parameters to filter the history by - framename, luname, sentenceid (one or more), type<framelu, lusent, sentanno>
 * @param proj - will be forworded to the mongoDB query as projection parameter
 * @param options - may contain parameters such as sort, limit etc
 * @param cb
 */
function searchHistory(query, proj, options, cb){
    console.log('DEBUG: searchDecisions')
    //({framename: "asdasd",luname: "refs.luname"}, query) = > {asdasd: query['framename'], 'refs.luname': query['luname']}
    var q  =q2coll(query, '- refs.frameName - refs.luName sentenceID -')
    if (query['type']) q['type']  = query['type'];
    if (query['decisionid']) q['action._id']  = query['decisionid'];
    Models.historyModel.find(q, proj, options,cb);
}

/** @see searchHistory רק
 * TODO: move to routes
 * @param req
 * @param res
 */
exports.getSearchHistory = function(req,res) {
    console.log('DEBUG: getSearchDecisions')
    searchHistory(req.query, {},{limit:100, sort: 'refs.frameName'}, handleHttpResults(req,res));
}



function  priorityTasks(req,res,cb){
    console.log('DEBUG: priorityTasks')
    //if (!(req.query.luid && req.query.frameid)) return cb(new Error("some of the parameters are missing"))
    //load frame data with lu
    //load the lu-sentence for this lu
    //load the sentences related to this lu
    req.query['priority']=1;
    async.parallel({
            //get the hebrew frames (names only) with priority
            frames: function(cb){

                searchFrames(req.query, {},{},cb)
            },
            //get the english lexical units list with priority
            lus: function(cb){
                searchlus(req.query,{},{}, cb);
            }/*,
             sentences: function(cb){
             //listSentences(req,res, cb);
             cb(null, ["this is a sentence", "this is another sentence"])
             }  */
        },
        handleHttpResults(req,res)
    );
}


//bridge - TODO: move to routes
exports.getPriorityTasks=function (req,res){
    console.log('DEBUG: getPriorityTasks')
    priorityTasks(req,res)
}



//TODO: sort the list before response
/**   returns names and ids of all frames, if lus=1 will return also list of related lus for each frame (under 'lexUnit=[]')
 *
 * @param query
 * @param projection
 * @param options
 * @param cb
 */
function  searchFrames(query,projection, options, cb){
    var q = q2coll(query, '@ID @name lexUnit.@ID lexUnit.@name - priority');
    //console.log('QUERY', q)

    Models.hebFrameModel.aggregate(
        {$match: q},//{frameid: Number('281') }},
        {$project: {"_id":0,'@name': "$@name", '@ID': '$@ID'}},
        {$sort: {"@name": 1}},
        cb)
};

//bridge - TODO: move to routes
exports.getSearchFrames = function (req, res){
    console.log("DEBUG: handle getSearchFrames request")
    searchFrames(req.query, {},{},handleHttpResults(req,res))
};


function searchlus(query,proj, options, cb){
    if (query.luid) query.luid = objID(query.luid); //cast String to objectID type
    var q = q2coll(query, '@ID @name lexUnit.@ID lexUnit.@name - lexUnit.priority'); //build the mongo query
    Models.hebFrameModel.aggregate(
        {$unwind : "$lexUnit" },    //this operator splits each array of lus  - to N documents - each one with single lu
        {$match: q},                //this filter the result of the prior phase
        {$project: {"_id":0,"@name":1, '@ID':1, 'lexUnit.@name':1, 'lexUnit.@ID':1,'lexUnit.@POS':1}}, //handele projection
        //{$project: {"_id":0,framename: "$lexUnit.@frame", frameid: '$lexUnit.@frameID', luname: '$lexUnit.@name', luid: '$lexUnit.@ID'}},
        {$sort: {"lexUnit.@name": 1}},
        cb)
}


//bridge - TODO: move to routes
exports.getSearchLus = function(req,res){
    console.log("DEBUG: handling hebrew getSearchLus request");
    //throw new Error("asd");
    searchlus(req.query, {}, null, handleHttpResults(req,res))
}


exports.pageFrames = function (query,res, cb){
    console.log("DEBUG: handling hebrew pageFrames request");
    var limit = _.min([20, (query.size ||30)]);
    console.log('using limit',limit)
    Models.hebFrameModel.find({},{},{sort: {'@name':1},skip: query.n*limit,limit:limit},cb)
}

//bridge TODO - move to routes
exports.getPageFrames = function (req,res) {pageFrames(req.query,res, handleHttpResults(req,res)) }



/**
 * returns a list of all the sentences in the 'sentences' collection (including which lus are related to them)
 * @param req
 * @param res
 */
function listSentences(req,res,cb){
    console.log("DEBUG: handling listAllSentences method" );
    //var q = q2coll("frameid")
    var query=  {};
    //if (req.query.luid) query.lus=req.query.luid;
    if (req.query.luname) query.lus=req.query.luname;     //TODO - use q2coll
    if (req.query.sentenceid) query.ID=req.query.sentenceid;

    Models.hebSentenceModel.find(query, {'sentenceOrigin': 0},{'limit': 200}, cb)
};


exports.getListSentences = function getListSentences(req,res,cb){
    listSentences(req,res, handleHttpResults(req,res))};
/**
 * returns a list of all the lu-sentence relations (each sentence-lu is a record which contains list of annotations)
 * if luid or sentenceid is given - use as filter
 * @param req
 * @param res
 */
function luSentence(req,res, cb){
    console.log("DEBUG: handling luSentence method" );
    //var query ={};
    var query = q2coll(req.query, 'frameID frameName - luName sentenceID');
    //if (req.query.sentenceid) query.sentenceID = req.query.sentenceid;
    //console.log(query)
    //console.log("DEBUG-luSentence: using query:",query);
    Models.luSentenceModel.find(query, {"_id":0, "__v":0},{'limit': 20}, cb)
}

//wrapper function for luSentence - creates a CB function
exports.getLuSentence = function(req,res){
    req.query.strict=1;
    luSentence(req,res, handleHttpResults(req,res))};


/**returns all data needed for the annotation of a LU - the frameData, the LU data, and a list of sentence data and it's lu-sentence data (with annotations if exists)
 *
 * @param req
 * @param res
 * @param cb
 */
exports.luAnnotationsData = function  luAnnotationsData(req,res,cb){
    if (!(req.param('luname') && req.param('framename'))) return cb(new Error("some of the parameters are missing"))
    //load frame data with lu
    //load the lu-sentence for this lu
    //load the sentences related to this lu
    async.parallel({
            //get the hebrew frame data - with the hebrew lus and all the FEs
            frameLU: function(cb){
                loadFrame(req.query,{},{}, cb)
            },
            //get the english lexical units list
            luSentence: function(cb){
                luSentence(req,res, cb);
            },
            sentences: function(cb){
                listSentences(req,res, cb);
                /*Models.hebFrameModel.findOne({"@ID":150}, function(err,resultObj){
                 cb(err, resultObj);
                 });*/
            }
        },
        handleHttpResults(req,res)
    );
};

















/**return object of sorted FES from given list of FEs:
 * {core: [{name: thename, ID: the-@ID, def: 'the definition'}], nonCore: [{name: thename, ID: the-@ID, def: 'the definition'}] ]
  * @param fes
 * @returns {{core: Array, nonCore: Array}}
 */
function orderFes(fes){
    var core=[];
    var nonCore=[];
    for (obj in fes){ //"@coreType": "Core",
        //console.log(obj)
        if (fes[obj]['@coreType'] =='Core') core.push({name: fes[obj]['@name'], ID: fes[obj]['@ID'], def: fes[obj]['definition']}  );
        else  nonCore.push({name: fes[obj]['@name'], ID: fes[obj]['@ID'], def: fes[obj]['definition']}  );
    }
    //console.log("CORE",core);
    //console.log("nonCore",nonCore);
    return {core: core, nonCore: nonCore}

}



/**use this method in order to get all the needed data for a frame:
 * coreFE, non-core-FEs, english lus, hebrew lus
 * TODO: add retrival of the annotated sentences -hebrew and english as well
 * returned object schema:
 * {hebData: "contains hebrew-frame object (hebFrameSchema)", engData: {frame: "contains english-frame object (engllish FrameSchema)", fes:  {core: [{name: thename, ID: the-@ID, def: 'the definition'}], nonCore: [{name: thename, ID: the-@ID, def: 'the definition'}] ]}
 * @param req
 * @param res
 * @param cb
 */
exports.loadFrameData = function loadFrameData(req,res,cb){
    delete req.query['luid']
    delete req.query['luname']
    //console.log("QUERY AFTER DELETE:", req.query)
    if (!req.query.frameid && !req.query.framename) {res.send(400)}
    async.parallel({
            //get the hebrew frame data - with the hebrew lus and all the FEs
            hebData: function(cb){
                req.query.strict=1;
                loadFrame(req.query, {}, null, function(err, results){
                    //console.log(results)
                    if (results && results.length>0) cb(err, results[0]);
                    else cb(206, results);})
            },
            //get the english lexical units list
            engData: function(cb){
                req.query.strict=1;
                engControl.loadFrame(req.query,{},null, function(err,results){
                    if  (results && results.length >0){
                        var newResults ={
                            fes:  orderFes(results[0].frame.FE.toObject()),
                            frame: results[0].frame
                        };
                        cb(err,newResults)
                    }
                    else cb(206, results)
                });
                /*Models.hebFrameModel.findOne({"@ID":150}, function(err,resultObj){
                 cb(err, resultObj);
                 });*/
            },
            translations: function(cb){
                engControl.loadTranslations(req.query,{},null, function(err,results){
                    //console.log("TRANSALTIOSN RES:",results )
                    if  (results && results.length>0)  cb(err,results)
                    else cb(err, results)
                })
            }
        },
        function(err, results) {
            res.charset = 'utf-8'
            if (err) res.send(err);
            else res.send(results);
            //console.log(results)// results is now equals to: {one: 1, two: 2}
        });
};



























/******************************** WRITE actions ***************************************/

function validParseLU(lu){ return JSON.parse(lu)} //TODO: remove from here to schemes or utils and create validation scheme
function validParseLuReq(req){ //TODO: see validParseLU
    //if (!((query.luid || query.luname) && (query.framename || query.frameid)) )
    if (!req.param('frameid') || ! req.param('lexUnit')) return false;
    else return validParseLU(req.param('lexUnit'));
}



/**step 2 in the process - form generation
 * the req body contains the sentence details:
    * target frame ID
    * target LU ID
    * sentence JSON! after yoav and meni!
    * target word token ID
 *
 * @param req
 * @param res
 */
exports.addSentenceToLUForm = function (req,res, obj){
    console.log("DEBUG: add sentence to lu GET request - loading form");
    var obj;
    //if (req.isAjax) return = externalTools.getSE(req, res, hebControl.addSentenceToLUForm);
    //var collectionNames = require('../controllers/general.js').collectionNames;
    //console.log("tree",Models.hebFrameLUSchema);
    var sentId = req['query']['sentenceid'];
    var sentence = req['query']['sentence'];

    var fieldNames =_.keys(Models.hebFrameLUSchema.tree);// ['@ID', "@name"]
    var types = _.values(Models.hebFrameLUSchema.tree);//["text", "text"]
    var fields = [];
    for (var i =0 ; i<fieldNames.length; i++){
        fields.push({'name': fieldNames[i], 'type':types[i] });
    }
    //console.log("fields\n",fields );
    console.log('sentence id: ', sentId);
    //console.log("the ajax is:",req['resJson']);
    res.render('addSentenceToLU.jade', {'sentJson': req['resJson'],'sentence' : sentence, 'sentenceid': sentId});
    console.log("the ajax is:",req['resJson']);
};


function valid31Format(candidate){return true;} //TODO!!! - complete this function or put as pre-save


var addLUToSentence = exports.addLUToSentence = function addLUToSentence (req,res, cb){
    console.log("DEBUG: adding the LU to the Sentence");
    var lu = req.body.luid;
    if (!lu) res.send ("please specify luid in order to add LU to the sentence")
    else{
        var sentModel = Models.hebSentenceModel;
        //sentModel.findOneAndUpdate({},);
        console.log('DEBUG: ', 'request is: ', req.body, req['sentenceid']);
        sentModel.findOneAndUpdate({"ID": req['body']['sentenceid']}, {$addToSet: {"lus":lu}}, function(err, returnedObj) {
            if (err || !returnedObj){
                console.log('DEBUG: problem adding lu to sentence', err, returnedObj);
                if (!returnedObj) res.send("there was an error adding the lus to the sentence = object wasn't found");
                else res.send("there was an error adding the lus to the sentence");
            }else{
                res.charset= 'utf-8';
                //console.log('DEBUG: the lu ', lu, 'was added to the sentence', req['body']['sentenceid'], '\n', returnedObj);
                cb(req, res,function(){res.send({'msg': 'good! the \' add sentence to LU\' process was finished','obj': (returnedObj)})});  //here cb is 'addsentencetolu
            }
        });
    }

};


/**
 * add sentence to lexical Unit - needed frameID and LUid and sentenceID -this will be added to the luSentence collection
 * this will be an 'save' by luid and frameid
 * the pairing will be added only if the sentence (by id) is not already associated with the luid + frameid
 * @type {Function}
 */
var addSentenceToLU = exports.addSentenceToLU = function addSentenceToLU(req,res, cb){
    var model = Models.luSentenceModel;
    var body = req.body;

    if (!body['luid'] || !body['frameid'] || !body['sentenceid']){
        console.log('DEBUG: not enough parameters for the request of  addSentenceToLU- ', req);
        res.send('error: not enough parameters -luid, frameid and sentenceid');
    }
    else{
        var content = {
            'luId' : body['luid'],
                //'luName': TODO
            'frameID': body['frameid'],
            'sentenceID': body['sentenceid']
        };
        //content['sentenceID'] = objID("5229b677b6b700bb4300002d");  -//TODO remove-  for DEBUGGING only
        var objToSave = new Models.luSentenceModel(content);
        //model.insert(content,function(err, result){res.send({'err':err, 'result':result})}) ;
        objToSave.save(function (err) {
            if (err) {
                console.log('DEBUG: error saving the sentence-lu association in the sentnecelu collection', err);
                res.send('error saving the snetnece lu association\n' + err);
            }
            else cb();
        })
    }
};



/*
 1	מה	_	QW	QW	_	2	SBJ	_	_
 2	נשמע	_	VB	VB	M|S|3|PAST|NIFAL	3	SBJ	_	_
 3	חבר	_	VB	VB	M|S|2|IMPERATIVE|PIEL	0	ROOT	_	_
 */


/* adding a sentence to a LU is built from few steps:
1. add the sentence to the sentence collection if not exists.
2. add the lu to the sentence lus list.
3. add the sentence to the lu's sentences list.

 */
/**step 2 in the process -
 *      part1 - add sentence to the sentences collection
 *      assuming that the sentence doesn't exist in the sentences collection
 *          the req body contains the sentence details:
 *          sentence JSON! after yoav and meni!
 * target word token ID
 *
 * @param req
 * @param res
 */
exports.addSentenceToDB = function addSentenceToDB(req,res){
    console.log("DEBUG: add sentence to lu - POST request");
    var resBody = req.body;
    var sentence = resBody['sentence'];
    console.log("DEBUG: add sentence to lu - the recieved sentence is:", sentence);

    var sentenceid = resBody['sentenceid'];
    /*if (!(frameId && luid && sentenceTxt && targetID)){
        console.log('DEBUG: not enough parameters for the request - one of the parameters is missing');
        res.send("one of the parameters is missing");
    } */
    if ((! sentence && !sentenceid) || (sentence && ! valid31Format(sentence))) res.send("the sentence is not vaild conll31 format");  //TODO: valid31Format
    else {

        if (sentence){
            var  sentenceModel =Models.hebSentenceModel;
            var sentJson = {
                "text": utils.linearizeConllSentence(JSON.parse(sentence)['words']),//TODO
                "sentenceProperties" : sentence['sentenceProperties'],
                "content" : [{"words": JSON.parse(sentence)['words']}], //array with possible segmentations of the sentence, only one will be marked as 'original' and one as 'valid'
                //"lus":[IDType],//save the related LU ids
                "ID":objID(),
                "source": 'manual'//{type: String, enum: ["corpus", "manual", "translation"]},//TODO
            };
            //sentJson['Content'] = [{a: "a"}];
            //console.log('DEBUG: add sentencetoDB - the result JSON is:',JSON.stringify(sentJson));
            //res.send(sentJson);
            //console.log('content:', typeof(sentJson['content'][0]));
            var sent = new sentenceModel(sentJson);
            //console.log('DEBUG: the model is:',sent);
            sent.save(function(err){
                if (err){
                    console.log('DEBUG: problem saving sentence', err);
                    res.send("problem saving sentence - abort");
                }
                else {
                    console.log('sentence was saved!, id:',sentJson["ID"]);
                    req['body']['sentenceid'] = sentJson['ID'];
                    addLUToSentence(req, res, addSentenceToLU);
                }});//save
        }else{ //case: no sentence, there is a sentence id
            console.log('DEBUG: skipping <save sentence> adding lu to sentence')
            addLUToSentence(req, res, addSentenceToLU);

        }

    }//else
};//method export


/**TODO
 * check if the sentence is in the data base -search by the text linearization, return the id if in DB else return undefined
 *
 * @param sentence {indb: 'on', content:}
 * @returns {*}
 */
function isInDB(sentenceText,cb){
    console.log("DEBUG: isInDB ");
    Models.hebSentenceModel.findOne({"text": sentenceText}, {"ID":1},function(err, resObj){
        if (!err){
            console.log("DEBUG-isInDB: text search result in sentences coll:", resObj);
            if (resObj) cb(resObj.ID, 'good');
            else Models.hebBadSentenceModel.findOne({"text": sentenceText}, {"ID":1},function(err, resObj2){
                if (!err){
                    //console.log("DEBUG: text search result in badSentences coll", resObj2);
                    if (resObj2) cb(resObj2.ID, 'bad');
                    else cb(resObj2);
                }});
            }
        else throw new Error("connetion error with DB : isInDB");
        }
    );
}
    //if (sentence['indb']) return "523188378916588b7c000038" //todo
    //else return undefined;
    //cb(result);

/**recieves a sentenceString (including the sentence properties) and data object and sentId.
 * if the sentence id is not defined\false -creates a new id, extract from the data only the source of the sentence
 * @param sentString
 * @param data
 * @param sentId
 * @returns {{text: *, sentenceProperties: *, content: Array, ID: *, source: *}}
 */
function createSentenceJson(sentString, data){
    console.log("DEBUG: createSentenceJson", typeof(sentString),"   ",sentString );
    var sentObj = JSON.parse(sentString);
    return {
        "text": utils.linearizeConllSentence(sentObj['words']),//TODO
        "sentenceProperties" : sentObj['sentenceProperties'],
        "content" : [{"words": sentObj['words']}], //array with possible segmentations of the sentence, only one will be marked as 'original' and one as 'valid'
        //"lus":[IDType],//save the related LU ids
        //"ID": sentId ? objID(sentId) : objID(),
        "source": data ? data['source'] : 'manual'//{type: String, enum: ["corpus", "manual", "translation"]},//TODO
    };

}


/**process bad sentence:
 * add bad segmented sentence to the bad sentences collection in order to track the segementations in the future and to make sure that all the sentences are tracked
 * @param sentJson
 * @returns {*}
 */
function processBadSentence(sentJson, data, control, id){
    "add the sentence to the bad sentences collection"
    console.log("DEBUG: processing processBadSentence",id);
    var succ = ("the sentence was added to the bad sentences collection with id: " + id);
    //var sentObj = new badSentenceModel(sentJson);
    sentJson['ID'] = id ?id : objID();
    new Models.hebBadSentenceModel(sentJson).save(function(err){
        if (err) {
            console.log("error saving sentence", err);
            control.write("error saving sentence" + sentJson);
            control.dec();
        }
        console.log(succ);
        control.write("the bad-segmented-sentence was saved successfully -!" + sentJson['ID']);
        control.dec();
    });
}


/**add new sentence to the DB - will be called only for valid segmented sentences
 *
 * @param sentJson - valid sentence JSON, no ID
 * @returns {*}
 */
function addNewSentenceToLU(sentJson,data,control,id){
    console.log("DEBUG: processing addNewSentenceToLU");
    //1.add sentence to the sentences DB
    var id = objID();
    sentJson['ID'] = id;
    //2.add luid to the sentence 'lus' field
    var luid = objID(data['luid']);
    sentJson['lus'] =luid;
    new Models.hebSentenceModel(sentJson).save(function(err){
        if (err) {
            console.error("DEBUG-addNewSentenceToLU: error saving sentence to DB addNewSentenceToLU-phase-1");
            control.write("error saving sentence to DB addNewSentenceToLU-phase-1");
            control.dec();
        }
        else {
            console.log('"DEBUG-addNewSentenceToLU:: the sentence was saved to BD with Id', id);
            //3. add the sentenceid, frameid, luid to the sentence-lu collection
            var luSent  = {sentenceID: id, luId: luid, frameID: data['frameid']};
            new Models.luSentenceModel(luSent).save(function(err){
                if (err) {
                    control.write("error saving sentence-lu to DB addNewSentenceToLU-phase-2"+ err);
                    control.dec();
                    console.error("DEBUG-addNewSentenceToLU: error saving sentence-lu to DB addNewSentenceToLU-phase-2",err);
                }
                else {
                    control.write("the sentence-lu was saved"+ luSent.sentenceID + " " + luSent.luId);
                    control.dec();
                    console.log("DEBUG-addNewSentenceToLU: the sentence-lu was saved", JSON.stringify(luSent));
                }
            });
        }
    });
    return sentJson;
}

/** add the LU to the sentence - the sentence already exists in the DB - need to check the if it is already associated to the lu-frame
 *
 * @param sentJson
 * @param data
 * @returns {*}
 */
function addExistSentenceToLU(sentJson, data,control,id,coll){
    console.log("DEBUG: processing addExistSentenceToLU",id, data['luid']);
    //1. check if we have already sentence-lu association
    //1.1 if exists - return -"association exists"
    //1.2 else:
    //1.2.1 add the lu to the sentence['lus'] list
    //1.2.2 add triple - sent-lu-frame to luSentence collection
    //var id = sentJson['ID'];
    var luid = objID(data['luid']);
    console.log("DEBUG-addExistSentenceToLU:searching for id:", luid, "sentId:", id);
    //Models.hebSentenceModel.findOne({'ID':id,'lus': luid}, function(err, resObj){
    Models.hebSentenceModel.find({'ID':id, 'lus': luid}, function(err, resObj){
        var associated;
        if (err) {
            console.error("DEBUG-addExistSentenceToLU: error searching for lu in sentence");
            control.write("error searching for lu in sentence");
            control.dec();
        }
        else {
            if (resObj && resObj.length >0){
                console.log("DEBUG-addExistSentenceToLU: the sentence and lu are already associated");
                associated= true;
                control.write("the sentence and lu are already associated");
                control.dec();

            }else {
                associated=false
                //processUnAssociated(sentJson, data);
                //1.2.1 add the lu to the sentence['lus'] list
                Models.hebSentenceModel.findOneAndUpdate({'ID':id}, {$push: {"lus":luid}}, function(err, returnedObj) {
                    if (err) console.log("DEBUG-addExistSentenceToLU: error adding lu to sentence lus list");
                    else if (!returnedObj) {
                        console.log("DEBUG-addExistSentenceToLU: couldn't fint the sentence");
                        control.write("couldn't fint the sentence");
                        control.dec();
                    }
                    else {
                        console.log("DEBUG: success - the lu was added to the sentence", id);
                        var luSent  = {sentenceID: id, luId: luid, frameID: data['frameid']};
                        new Models.luSentenceModel(luSent).save(function(err){
                            if (err){
                                console.log(err);
                                throw new Error("addExistSentenceToLU: error saving sentence-lu to DB addNewSentenceToLU-phase-2"+err);
                            }
                            else {
                                console.log("DEBUG-addExistSentenceToLU: addExistSentenceToLU: the sentence-lu was saved", luSent);
                                control.write("addExistSentenceToLU: the sentence-lu was saved");
                                control.dec();
                            }
                        });
                    }
                })
            }

            //console.log("DEBUG-addExistSentenceToLU :proccessing associated: ", associated, resObj.length);
        }


    });
    /*return
    sentJson['lus'] =luid;
    new Models.hebSentenceModel(sentJson).save(function(err){
        if (err) throw new Error("error saving sentence to DB addNewSentenceToLU-phase-1");
        else {
            console.log('DEBUG: the sentence was saved to BD with Id', id);
            //3. add the sentenceid, frameid, luid to the sentence-lu collection
            var luSent  = {sentenceID: id, luId:luid, frameID: data['frameid']};
            new Models.luSentenceModel(luSent).save(function(err){
                if (err) throw new Error("error saving sentence-lu to DB addNewSentenceToLU-phase-2");
                else console.log("the sentence-lu was saved", JSON.parse(luSent));
            });
        }
    });
    return sentJson;*/
}
/**
 *
 * @param sent - string representing the sentence in the following format:
 *  {inddb=objID\true\ubdefined, content=string of 31-conll sentence format}
 * @param data
 * @returns {*}
 */
function processSentence(sent, data, control, sentenceNumber){
    var func;
    var action  = sent['action'];
    console.log('processing sentence number:', sentenceNumber, "action:", sent['action']);
    var sentJson  = createSentenceJson(sent['content'], data); //(sent['indb'] ? (sent['indb']) : undefined) ); //parse the sentence by schema
    var msg;
    function skipSentence (){
        console.log("no action was chosen for the sentence", msg);
        control.write("no action was chosen for the sentence " + msg);
        control.dec();
    }

    //
    isInDB(sentJson['text'], function(id, coll){
        console.log("DEBUG: processSentence CB function: recieved id:",id);
        switch (action) {
            case 'badseg':
                if (id && coll=='bad') {
                    msg = id +coll
                    func=skipSentence
                }
                else func=processBadSentence;
                break;
            case 'addtolu':
                if (id && coll=='good')  func=addExistSentenceToLU;
                else if (!id) func=addNewSentenceToLU;
                else {
                    msg = id +coll
                    func=skipSentence;
                }
                break;
            case 'nothing':
                msg =  'nothing';
                func=skipSentence;
                break;

        }
        if (func) return func(sentJson, data,  control,id, coll);
        else return "action: nothing";
    } );
}


/*if (action=='badseg') func=processBadSentence;
else if (action['addtolu']){
if (id)  func=addExistSentenceToLU;
else func=addNewSentenceToLU;
}
//func = function(s) {return s};

return func(sentJson, data,  inDB, control);

console.log("no action was chosen for the sentence");
control.write("no action was chosen for the sentence");
control.dec();
*/


/**
 *
 * @param req - req['method']==post, req['body']= {}
 * @param res
 */
exports.addSentencesToLu = function addSentencesToLu(req,res) {
    console.log("DEBUG: addSentencesToLu");//reqbody:", req.body);
    //res.send(req.body);
    //return
    var sentences= req.body.sentences;
    var data = req.body.data    ;
    //options: bad segmentation - add to 'badSentences', good- add to lu? check if already in DB and in LU? else - nothing
    res.charset='utf-8';
    //console.log("DEBUG-addSentencesToLu: data->", data);
    var control = {results: [], counter : sentences.length,
        write : function(msg){this.results.push(msg);},
        end: function(){res.send(this.results)},
        dec:function(){
            this.counter= this.counter-1;
            if (this.counter==0) this.end();
        } };
    //console.log("control obj:", control);
    for (sentence in sentences){
        processSentence(sentences[sentence], data, control,sentence);
        /*if (sentences[sentence]['addtolu'] || sentences[sentence]['badseg'])
            resultsArr.push(processSentence(sentences[sentence], data, control, sentence));
        else {
            console.log("no action was chosen for the sentence");
            control.write("no action was chosen for the sentence");
            control.dec();
        } */
    }

    //res.send(resultsArr);
};




//add the sorounding labels to array of labels and cretes FE annotation object to be saved in the DB
function createFEAnnotation(anno){
    console.log("DEBUG -createFEAnnotation - input " , anno);
    return {
        name :'FE',
        label : JSON.parse(anno), //this needs to be the contenct form the client- array of labels  each one corresponds to 'heblabelType'
        rank : 1,
        status: 'decision'
    }
}

/**add annotation to lu, the given annotation object will be transmitted via the res.body object. in addition to luid, frameid and sentenceid.
 * the annotation will be saved in the lu-sentence collection and the annotation id will be added to the frame.lu.annotations
 *
 * @param req
 * @param res
 * @param cb
 */
exports.addAnnotation = function addAnnotation(req,res,cb) {
    console.log("DEBUG: handling addAnnotation");
    var body =req.body;
    //check if the req contains all the relevant data
    if (!(body.frameid && body.luid && body.sentenceid && body.annotation && body.segid)) return cb(new Error("one of the parameters is missing - abort"));
    //phase 1: save new annotation to the lu-sentence collection - return error if fails to find
    var query =  {
        sentenceID : body.sentenceid ,
        luId : body.luid,
        frameID: body.frameid
    };
    var anno = createFEAnnotation(body.annotation)
    var annotation ={
        ID: objID(),
        validVersion: false,
        status: 'pending',
        cDate: new Date(),
        cBy: req.user ? req.user.username : 'unknown',
        sentenceId:  body.sentenceid,
        segmentationID: body.segid,
        layer : [anno]
    };
    console.log("DEBUG-addAnnotation query is:", query);
    console.log("DEBUG-addAnnotation anno is:", anno);
    Models.luSentenceModel.findOneAndUpdate(query, {$push: {"annotations": annotation}}, function(err, returnedObj) {
        console.log("DEBUG-addAnnotation reulst is:", err, JSON.stringify(returnedObj));
        cb(err, returnedObj);
    });


};




//addBasicLUToFrame(lu.luname,lu.lupos, frame.framename,  cb)
function addBasicLUToFrame(params, cb){
    console.log('DEBUG: addBasicLUToFrame');
    var mod = Models.hebFrameModel;

    var lu = {
        "status": 'initial',
        "sentenceCount":{
            "total": 0,
            "annotated": 0
        },
        "@name":params.lu.luname, //{required: true, type: String, match: /^.+\..+/},
        "@POS": params.lu.lupos,
        "@cDate": new Date(),
        "@cBy":params.other.username
    };
    if (params.other.trans)  lu.translatedFrom = {
        "frameName":params.other.trans.framename,
        "lexUnitName":params.other.trans.luname
    };
    if (!lu) return cb(new Error("the request is not valid"), null);

    //search for the frame itself - return error if not exists
    mod.findOneAndUpdate({'@name' :params.frame.framename},{'$push': {lexUnit: lu}}, {new:true},
                function(err, resu){
                    //console.log('LLLL',JSON.stringify(params), err, resu)
                    if (err) return cb(err, null);
                    //if (!resu2) return cb(new Error("there was a problem with the update"), null);
                    //return cb(null, {msg: 'the lu was added',content: resu2});
                    return cb(null, {msg: 'the lu was added',content: resu});
                });//func2
}


// addDecision(refs, type, subtype, comment, username, cb)
/**add a new decision (annotator decision - not reviewer) to the db -
 *
 * @param refs - contatins the references - need to be relevant to the given type
 * @param type - one of framelu, lusent, sentanno
 * @param subtype - add, remove, query
 * @param comment
 */
function addDecision(params, type, cb){
    console.log('DEBUG: addDecision')
    var refs = {
        frameName: params.frame.framename,
        luName: params.lu.luname
    }
    var action = {
        cBy: params.other.username,
        cDate: new Date(),
        type:  params.other.action,
        comment: params.other.comment
    }
    var query = {
       type: type,
        refs: refs
    }
    Models.historyModel.findOneAndUpdate(
        query,
        {'$push': {actions: action}},  //update
        {new:true, upsert: true}, cb)   //options (upsert  = create new object if not exists)
}//adddecision


//(refs.luname, refs.frameName, subtype,username

function setLUdecisionStatus(params, cb){
    console.log('DEBUG: setLUdecisionStatus')
    var update = {};
    //case: this is add or remove action
    if (-1 != _.indexOf(['add','delete'], params.other.action))
        update = {'$set':{
            'lexUnit.$.decision.currStat.stat': params.other.action,
            'lexUnit.$.decision.currStat.cBy': params.other.username,
            'lexUnit.$.decision.currStat.cDate': new Date()
        }};
    //case: this is a query action
    //case: this is areviewer decision
    else if (params.other.action != 'query' )
        update = {'$set':{
            'lexUnit.$.decision.appStat.stat': params.other.action,
            'lexUnit.$.decision.appStat.cBy': params.other.username,
            'lexUnit.$.decision.appStat.cDate': new Date()
        }};
    Models.hebFrameModel.findOneAndUpdate(
        {'@name': params.frame.framename, 'lexUnit.@name': params.lu.luname},
        update,
        cb
    )
}


/**adds a decision to the history collection and update the 'decision' field in the lexUnit object
 *
 * @param params
 * @param type
 * @param callBack
 */
function addFrameLuDecision(params, type, callBack){
    console.log('DEBUG: addFrameLuDecision')
    async.parallel({
            luHistory: function(cb) {
                //console.log('REFS:',refs);
                addDecision(params, type, cb)
            },
            lexUnit: function(cb) {
                //console.log("REFS-2:", refs)
                setLUdecisionStatus(params,
                    function(err,results) {
                        var newRes =results;
                        console.log(JSON.stringify(params), newRes)
                        if (newRes){
                            //console.log("luid:",typeof(luid) ,luid);
                            newRes= _.filter(newRes.lexUnit, function(obj) {
                                return (obj['@name'] == params.lu.luname);})
                        }
                        cb(err, newRes)
                    }

                )}
        },
        callBack)

}



/*
pseudo code:
addFrameLuAssociation(luname,framename,action){
    if !luinframe(luname,framename):
        if (action==delete) - throw exception
        else
            addlutoframe(luname, lupos,framename)

    setframeLudecision(fname,luname, action)
*/

function createFrameLuAssociation(params, cb){
    console.log('DEBUG: frameLuAssociationAction')
    //if (!luinframe(luname,framename)):
    //console.log(lu)
    if (!params.lu.luname) return cb(new Error("you must specify lu name (lu.luname) in the request"))
    //Models.hebFrameModel.findOne({'@name': params.frame.framename, 'lexUnit.@name':params.lu.luname}, {'lexUnit.@name':1},
    Models.hebFrameModel.findOne({'@name': params.frame.framename}, {'lexUnit.@name':1},
        function(err,results){
            console.log("DEBUG: frameLuAssociationAction->findOne")
            if (err) return cb(err)
            console.log("findone:", err, results)
            if (!results) { //if frame doesn't exists!
                return cb(new Error("the requested frame doesn't exists"))
            }
            //if action==delete and the lu is not in the frame
            else if (!_.find(results.lexUnit, function(obj){return  obj['@name']== params.lu.luname} ) &&  params.other.action=='delete'){
                return cb(new Error("you cannot delete lu from frame if it is not added first"));
            }
            else {
                if (!params.lu.lupos) return cb(new Error("you have to specify the POS of the lexical unit before adding it to frame"))
                addBasicLUToFrame(params,
                    function(addError, addResult){
                        addFrameLuDecision(params,'framelu',cb)
                    })
                addFrameLuDecision(params,'framelu',cb)
            }
        })
}

//actions: add_approve, add_reject, delete_approve, delete_reject
function setDecisionApproval(params, cb){
    if (!params.other.decisionid) return cb(new Errr("you must supply valid decisionid"));
    //console.log("PARAMS2",params)
    if (params.other.action.indexOf('approve')==-1 && params.other.action.indexOf('reject')==-1 ) return cb(new Error("the action is not valid"));
    Models.historyModel.update(
        {'refs.frameName': params.frame.framename, 'refs.luName': params.lu.luname, 'actions._id': params.other.decisionid},
        {'$set':{
            'actions.$.revCall': params.other.action}},
        {new: true},
        function(err,results){
            if (err) return cb(err)
            if (!results) {
                console.log("some problem with the setDecisionApproval")
                return cb(new Error("some problem with the setDecisionApproval"))
            }
            //console.log("STEP1 results:", results)
            createFrameLuAssociation(params, cb);
        })
}




/**  wrapper function - checks validity of the parameters, parse theme and initiate the createFrameLuAssociation function  OR setDecisionApproval
 * user this function in order to set a new frame-lu decision or to approve or reject one
 *
 * @param req
 * @param res
 */
exports.postCreateFrameLuAssociation = function(req,res){
    //TODO: check that the frame exists before posting a decision? make sure
    //TODO: organize the validation of data - it's critical here (check the lu name, etc)
    console.log('DEBUG: postFrameLUDecision')
    if (req.query.luname && req.query.lupos && req.query.luname.indexOf('.')==-1 ) req.query.luname = (req.query.luname + '.'+req.query.lupos).toLowerCase();
    var params = utils.parseReqParams(req)
    //console.log('PARAMS:',params)
    var valid = (params.other.action && (-1 != _.indexOf(['add', 'delete', 'query'], params.other.action)))
    valid = valid &&  params.frame.framename &&  params.lu.luname
    if (!valid) throw new  Error("the selected action is not valid or some parameters are missing")
    createFrameLuAssociation(params, handleHttpResults(req,res));
}

exports.postSetDecisionApproval = function(req,res){
    console.log('DEBUG: postFrameLUDecision')
    var params = utils.parseReqParams(req)
    //var valid = (params.other.action && (-1 != _.indexOf(['add_approve', 'add_reject','delete_approve', 'delete_reject' ], params.other.action)))
    var valid = (params.other.action && (-1 != _.indexOf(['approve', 'reject' ], params.other.action)))
    valid = valid &&  params.frame.framename &&  params.lu.luname && params.other.decisionid
    if (!valid) throw new  Error("the selected action is not valid or some parameters are missing")
    setDecisionApproval(params, handleHttpResults(req,res));
}




/**this function revieves a edited lu and saves it to the DB - all the given parameters will be changed (no roll back!)
 *must contain at least - luname
 * @param params
 * @param cb
 */
function editLU(params, cb){
    //[{asdas: asdasd, asd:{asdas:asdasd},asda:[{asd:asd}]}]
    //make sure that a framename and luname are supplied
    if (!params.frame.framename || !params.lu.luname) return cb(new Error('framename and luname must be supplied'));
    var lu =params.lu;

    var query = {'@name': params.frame.framename, 'lexUnit.@name': lu.luname},
        fields = {'lexUnit.$.definition': lu.definition, 'lexUnit.$.status': lu.status,'lexUnit.$.lexeme': lu.lexeme, 'lexUnit.$.semType': lu.semType,'lexUnit.$.@incorporatedFE' : lu.incoFe},
        uOptions={}//{new : true};


    var update = {'$set':  _.removeEmpties(fields)}
    Models.hebFrameModel.update(query, update, uOptions, cb);

}

//bridge=TODO: move to routes
exports.posteditLU = function(req,res){
    var params = utils.parseReqParams(req, 'editlu')

    editLU(params,handleHttpResults(req,res))

}

