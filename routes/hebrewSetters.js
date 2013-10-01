

printModule("routes/hebrewSetters");

module.exports = function(app) {
    var auth = require('./../controllers/auth');
    var hebControl = require('../controllers/hebrew.js');
    var externalTools =require('../controllers/externalTools.js');

    app.get('/heb/addlutoframe_old', hebControl.renderAddLUToFrame);  //get the form for submission
    //app.post('/heb/addlutoframe',auth.ensureAuthenticated, hebControl.addLUToFrame);  //process the query data, submit to DB and return the results
    /**the post should contatin:
     * frameid, luname and lexUnit.
     * the lexUnit should be a valid lu-schema type JSON
     *
     */
    app.post('/heb/addlutoframe_old',auth.ensureAuthenticated, hebControl.postAddLuToFrame);

    //.app.post('/heb/addsentence', function (req,res) {console.log("hahaha"); res.send('good!');});
    app.get('/heb/addsentence',/*auth.ensureAuthenticated,*/ hebControl.addSentenceToLUForm);  //get the form for submission
    app.get('/ajax/heb/addsentence',/*auth.ensureAuthenticated,*/ function (req,res){
        req.isAjax =true;
        externalTools.getSE(req, res, hebControl.addSentenceToLUForm);
    });  //get the form for submission

    app.post('/heb/addsentence',/*auth.ensureAuthenticated,*/ hebControl.addSentenceToDB);  //process the query data, submit to DB and return the results
    app.post('/ajax/heb/addsentence',/*auth.ensureAuthenticated,*/ hebControl.addSentenceToDB);  //process the query data, submit to DB and return the results

    app.get( '/heb/addSentencesToLuPost', function(req,res) {res.render('addSentencesToLuPost.jade')});
    app.post( '/heb/addSentencesToLU', hebControl.addSentencesToLu);
    app.get('/heb/', function(req,res){ res.redirect(hp)});

    app.get('/heb/createannotation', function(req,res){res.render('createAnnotation.jade')});
    app.post('/heb/createannotation', function(req,res) {
        hebControl.addAnnotation(req,res, function(err, result){
            if (err) res.send("ERROR! "+ err);
            else res.send(result);
        })
    });

    app.get('/heb/setdecision', function(req,res) {res.render('setDecision.jade')});
    app.post('/heb/setdecision', function(req,res) {
        hebControl.setDecision(req,res,function(err,result){
            if (err) return res.send(new Error("problem setting decision"));
            res.charset='utf-8';
            res.send(result);
        })});


    app.get('/heb/decision', hebControl.postCreateFrameLuAssociation)
    app.get('/heb/addlutoframe', hebControl.postCreateFrameLuAssociation)
    app.post('/heb/addlutoframe', hebControl.postCreateFrameLuAssociation)
};  //main!

