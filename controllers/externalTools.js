/**
 * Created with IntelliJ IDEA.
 * User: imrihe
 * Date: 9/1/13
 * Time: 6:39 PM
 * To change this template use File | Settings | File Templates.
 */

printModule("controllers/externalTools");

var handleHttpResults = require('../tools/utils.js').handleHttpResults;
var util = require('../tools/utils.js');
var esServer = 'http://www.cs.bgu.ac.il/~itayman/hebfn/';
var searchRest = 'search/rest';
var searchByIdUrl =   'search/id';
var addSentenceRest = 'add/rest';
var request = require('request');
var qs = require('querystring');



/**serach engine request
 *
 * @param req
 * @param res
 */
var url =require('url');
var http = require('http');
searchEngineServer = 'elhadad2';//'localhost';


function esQuery(query, cb){
    //query = {'w1.word': 'ש','results': 8, diversify: 'true'}// , 'must_not.match.w2.lemma': 'הלך'}
    console.log("query:", esServer+searchRest+'?' + qs.stringify(query))
    request(esServer+searchRest+'?' + qs.stringify(query), function (error, response, body){
        if (error) return cb(error);
        cb(null, body)
    });
}

/**search sentencs in elasticSearch corpora DB via itay_mangashe's server
 *
 * @param reqQuery
 * @param cb
 */
//w1.pos.must.match=הלך
//s.genre.must_not.match=blog7
//s.length.must.range=2,3
//s.length.must.range.lt/lte/gt/gte=3
// w1.word.must.match=הלך&w2.word.mus t.match=קפץ&w1~w2=3  //currently working only with words
function searchSentencesES(reqQuery, cb){
    var query = {
        results: reqQuery['results']  ?  reqQuery['results'] : 20,
        diversify: reqQuery['diversify'] ? reqQuery['diversify'] : "low",
        page: reqQuery['page']? reqQuery['page'] : 1 //1 and above
    };

    var i = 1;

    if (reqQuery.terms) {
	for (; i-1 < reqQuery.terms.length; i++) {
	    var word = 'w'+i;
	    var term = _.isString(reqQuery.terms[i-1]) ? JSON.parse(reqQuery.terms[i-1]) : reqQuery.terms[i-1];

	    if (term.include) {
		query[word+'.'+term.type+'.must.match'] = term.word;
	    } else {
		query[word+'.'+term.type+'.must_not.match'] = term.word;
	    }	

	    if (term.include && term.pos) {
		var poss = util.esPos[term.pos];
		
		if (_.isArray(poss)) {
		    query[word+'.pos.should.match'] = poss;
		} else {
		    query[word+'.pos.must.match'] =  poss;
		}
	    }
	}
    }

    if (reqQuery.optionals && reqQuery['optionals'].length > 0) {
	query['w'+i+'.word.should.match'] = [];
	reqQuery['optionals'].forEach(function(x){
	    query['w'+i+'.word.should.match'].push(x);
	});
    }
    console.log("search query: ",JSON.stringify(query));
    esQuery(query, function(err, result){
        if (err ) cb(err);
        else if (!result) cb("no results!");
        else {
            result = JSON.parse(result);
            var sentences = _.map(result.hits, function(sent) {
                var resultStruct = {text: sent.text, id: sent._id};
                resultStruct.fullSentence = sent;
                return resultStruct;
            });
            cb(null, sentences);
        }
    })
}

function normalizeESSearchResults(hits){
    var sentences = _.map(hits, function(sent) {
        var resultStruct = {text: sent.text, id: sent._id};
        resultStruct.fullSentence = sent;
        return resultStruct;
    });
    return sentences;
}

function normalizeESIdSeachResults(hits){
    var sentences = _.map(hits, function(sent) {
        var resultStruct = {text: sent.text, id: sent._id};
        resultStruct.fullSentence = sent;
        return resultStruct;
    });
    return sentences;
}


function searchSentencesByIdES(reqQuery, cb){
    request(esServer+searchByIdUrl+'?' + qs.stringify(reqQuery), function (error, response, body){
        if (error) cb(error);
        else{
            body = JSON.parse(body);
            var sent = body.hits[0];
            if (sent.found){
                var resultStruct = {text: sent.sentence.text, id: sent.sentence._id};
                resultStruct.fullSentence = sent.sentence;
                cb(null,resultStruct);
            }else {
              cb(404);
            }

        }

    });

}

exports.getExampleSentences = function(req,res){
    searchSentencesES(req.query,handleHttpResults(req,res));
};

exports.searchById = function(req,res){ searchSentencesByIdES(
    {id: req.param('id')},
    handleHttpResults(req,res))
};


exports.addSentence = function(req, res) {
    var cb = handleHttpResults(req,res);
    var addParams = {};

    addParams.genre = req.param('genre') || 'general';
    addParams.text = req.param('text');
    addParams.preview = req.param('preview') || 'false';

    if (addParams.text) {
	request.post(esServer+addSentenceRest, {form: addParams}, function (error, response, body){
            if (error) return cb(error);
            cb(null, JSON.parse(body));
	});
    } else {
	cb({error:"Missing parameter: text", code: 400});
    }
}
