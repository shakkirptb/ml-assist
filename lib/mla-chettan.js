/**
 * @author shakkirptb@gmail.com
 * */
var natural = require('natural');
var tokenizer = new natural.WordTokenizer();
var metaphone = natural.Metaphone;
const speak = require("speakeasy-nlp");

//Classifier------------------------------------
//var BrainJSClassifier = require('natural-brain');
//var myClassifier = BrainJSClassifier;
var myClassifier = natural.BayesClassifier;
//var myClassifier = natural.LogisticRegressionClassifier;

Array.prototype.unique = function() {
	var a = [];
	for (i = 0; i < this.length; i++) {
		var current = this[i];
		if (a.indexOf(current) < 0) a.push(current);
	}
	return a;
}

function getContextFrom(allContext, contextName) {
    if (allContext[contextName] == null || allContext[contextName].clfr == null) {
        var clfr = new myClassifier();
        allContext[contextName] = {
            name: contextName,
            clfr: clfr
        };
        console.log("new context '" + contextName + "' created..");
    }
    return allContext[contextName];
}

function addTrainingData(trainingDataArray) {
	var allContext = this.allContext
    console.log("addTrainingData(" + allContext + ",trainingDataArray)>>>");
    if (allContext == null) {
        allContext = {};
    }
    if (trainingDataArray instanceof Array) {
        console.log("Training records = ", trainingDataArray.length);
        for (data of trainingDataArray) {
            var text = data.text;
            for (item of data.contexts) {
                var contextName = item.context;
                allContext[contextName] = getContextFrom(allContext, contextName);
                allContext[contextName].clfr.addDocument(text, item.label);
            }
        }
        for (contextName in allContext) {
            allContext[contextName].clfr.train();
        }
    } else {
        return false;
    }
    this.allContext=allContext;
    return allContext;
}

function getTrainingObj(text, context, label) {
    return {
        text: text,
        contexts: [{
            context: context,
            label: label
        }]
    };
}

function tokenize(itemsToSplit) {
    var allTokens = [];
    if (!(itemsToSplit instanceof Array)) {
        itemsToSplit = [itemsToSplit];
    }
    for (item of itemsToSplit) {
        if (item) {
            // //all tokens
            var tokens = tokenizer.tokenize(item);
            // trainingData.push(getTrainingObj(tokens,context,label));
            for (token of tokens) {
                // //individual tokens
                allTokens.push(token);
                //3gram
//                allTokens = allTokens.concat(token.match(/.{1,3}/g));
//                var photetics = metaphone.process(token);
//                allTokens.push(photetics);
//                allTokens = allTokens.concat(photetics.match(/.{1,3}/g));
            }
        }
    }
    return allTokens.unique().join(" ");
}

var MangoAliyan=require("mango-aliyan");
var mangoA = new MangoAliyan();

function saveTrainingData(collection,doc, callBack) {
    mangoA.insert(null, collection, doc, function(res, collection, result) {
        if (result == false) {
            if (callBack) {
                callBack(res, collection, doc);
            }
            return false;
        }
        console.log("doc(s) added..");

        if (callBack) {
            callBack(res, collection, doc);
        }
    });
}
function train(collection,contextName, text, label) {
	var allContext = this.allContext;
    contextName = contextName.toLowerCase()
    console.log("train(" + contextName + "," + text + "," + label + ")>>>");
    var clfr = getContextFrom(allContext, contextName).clfr;
    var allTokens = tokenize(text);
    if (label) {
        var trainingDt = {
            text: allTokens,
            contexts: [{
                context: contextName,
                label: label
            }]
        };
        saveTrainingData(collection,trainingDt, function(res, collection, tdata) {
            var clfr = getContextFrom(allContext, tdata.contexts[0].context).clfr;
            console.log(tdata.text + " added to " + tdata.contexts[0].label);
            clfr.addDocument(tdata.text, tdata.contexts[0].label); //addDocument to Classifier
            clfr.train(); //train

        }); //save to db

        return true;
    }
    return false;
}
function classifyAndTrain(contextName, text) {
	var allContext = this.allContext;
    contextName = contextName.toLowerCase()
    console.log("classifyAndTrain(" + contextName + "," + text + ")>>>");
    var clfr = getContextFrom(allContext, contextName).clfr;
    var allTokens = tokenize(text);
    var classes = clfr.getClassifications(allTokens);
    var derived = [];
    //Logic to find best results----
    var maxBest = 3;
    var accuracy = 40; //%
    for (var i = 0; i < classes.length - 1; i++) {
        if (i > maxBest - 1) {
            break;
        }
        var delta = (classes[i].value - classes[i + 1].value) / classes[i].value * 100;
        if (delta >= accuracy) {
            delta = (classes[i + 1].value - classes[i + 2].value) / classes[i + 1].value * 100;
            if (delta >= accuracy) {
                continue;
            }
            classes.slice(0, i + 1).filter(function(item) {
                derived.push(item.label)
                return false;
            });
            break;
        }
    }
    //----------------------------

    //derived.push(classes);
    console.log("classifyAndTrain: " + text + " = " + derived);

    /*
  if(derived[0] != null &&  derived[0] != ""  &&  derived[0].indexOf("Not Trained") < 0){
      var trainingDt= {text:allTokens,  contexts:[{context:contextName,label:derived[0]}]};
      saveTrainingData(trainingDt,function(res,collection,tdata){
		var clfr=getContextFrom(allContext,tdata.contexts[0].context).clfr;
	   clfr.addDocument(tdata.text,tdata.contexts[0].label);
		clfr.train();
	});
  }
  */
    return derived.length == 0 ? false : derived;
}
//function pos(text){
//   return speak.classify(text);
//}
var MLASir = function(trainingDataArray){
	this.allContext = null;
	if(trainingDataArray){
		this.allContext= addTrainingData({},trainingDataArray)
		
	}
};
var nounInf=new natural.NounInflector();
//enablers
//MLASir.prototype.pos=pos;
MLASir.prototype.singularize=function(text){
	return nounInf.singularize(text);
}
MLASir.prototype.split=speak.classify;
MLASir.prototype.getContextFrom=getContextFrom;
MLASir.prototype.addTrainingData=addTrainingData;
MLASir.prototype.getTrainingObj=getTrainingObj;
MLASir.prototype.tokenize=tokenize;
MLASir.prototype.saveTrainingData=saveTrainingData;
MLASir.prototype.train=train;
MLASir.prototype.classifyAndTrain=classifyAndTrain;
//export
module.exports = MLASir;
