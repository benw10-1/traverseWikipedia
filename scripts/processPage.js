const jsdom = require("jsdom")
const winkNLP = require("wink-nlp")
const model = require("wink-eng-lite-model")
const its = require('wink-nlp/src/its.js')
const nlp = winkNLP(model)
const { JSDOM } = jsdom

function getPageDom(link) {
    return fetch(link).then(data => {return data.text()}).then(data => {
        return new JSDOM(data).window.document
    })
}

var process = function(link, maxNodes=200) {
    let links = [], nodes = []
    let count = 0
    getPageDom(link).then(doc => {
        
    }) 
}

module.exports = process