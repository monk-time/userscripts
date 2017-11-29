// ==UserScript==
// @name           IMDb List Helper
// @namespace      imdb
// @description    Makes creating IMDb lists more efficient and convenient
// @version        1.6.1.1
// @include        http://*imdb.com/list/edit*
// ==/UserScript==

//
// CHANGELOG
//
// 1.6.1.1
// fixed: some entries are skipped when adding imdb ids/urls
//

//
// milliseconds between each request
//
var REQUEST_DELAY = 200;

//
// do not modify anything below this line
//
var jQuery = unsafeWindow.jQuery;
var $ = jQuery;

var textEdit = '<div id="imdbListTextEdit" style="'
                + 'padding: 10px; border: 1px solid #e8e8e8">'
                + '<textarea id="filmList" rows="7" cols="60">Paste a list of titles / IMDb URLs / IMDb IDs here and click Start (remove this line)</textarea><br />'
                + '<input type="button" id="doList" value="Start" /> '
                + '<input type="button" id="skipFilm" value="Skip" /> '
                + '<span style="font-weight: bold">Remaining: <span id="filmsRemaining">0</span></span><br /><br />'
                + '<span style="font-weight: bold;">Current: <input type="text" id="filmCurrent" size="65" style="font-family: monospace" /></span><br />'
                + '<span style="font-weight: bold;">Regexp: <input type="text" value="^(.*)$" id="filmRegexp" size="65" style="font-family: monospace; margin-top: 4px; margin-left: 1px" /></span><br />'
                + '</div>';

$("div#main > div.list_edit > div.add").after(textEdit);

// globals
var films = [];
var regexObj = null;

function resetState() {
    films = [];
    regexObj = null;

    $("#filmList").removeAttr("disabled");
    $("#filmRegexp").removeAttr("disabled"); // leave regex
    $("#doList").removeAttr("disabled");

    $("#filmCurrent").val("");

    $("input[name=add]", "div.add").val("");
    $("div.results", "div.add").html("");
}



function searchFilm(filmTitle) {
    // remove unnecessary whitespace
    filmTitle = $.trim(filmTitle);

    // set current text to what we're searching
    $("#filmCurrent", "#imdbListTextEdit").val(filmTitle);

    // remove the first title from the text box and set the remaining number
    $filmList = $("#filmList", "#imdbListTextEdit");
    var newList = $filmList.val().split("\n");
    $("#filmsRemaining", "#imdbListTextEdit").text(newList.length-1);
    $filmList.val( newList.slice(1).join("\n") );

    // run regex
    if ( regexObj != null ) {
        filmTitle = regexObj.exec(filmTitle)[1];
    }

    // set imdb search input field to film title
    $("input[name=add]", "div.add").val(filmTitle);

    // trigger search button click
    $("button.search").triggerHandler("click");
}

// when start button is clicked
$("#imdbListTextEdit").delegate("#doList", "click", function(e) {
    $filmList = $("#filmList", "#imdbListTextEdit");

    // regex
    $regexBox = $("#filmRegexp", "#imdbListTextEdit");

    if ( $regexBox.val() ) {
        regexObj = RegExp( $regexBox.val() );
    }

    // disable the text area and the button and the regexp box
    $filmList.attr("disabled", "disabled");
    $regexBox.attr("disabled", "disabled");
    $("#doList").attr("disabled", "disabled");

    films = $filmList.val().split("\n");

    // search first item
    searchFilm(films.shift());
});

// when skip button is clicked
$("#imdbListTextEdit").delegate("#skipFilm", "click", function(e) {
    // skip to next film
    if (films.length > 0) {
        searchFilm(films.shift());
    } else if (films.length == 0) { // if no more films...
        resetState();
    }
});

// when a search result item is clicked
$("div.results", "div.add").delegate("li", "click", function(e) {
    // if there's more items, search next...
    if (films.length > 0) {
        searchFilm(films.shift());
    } else {
        // if last film, reset stuff
        resetState();
    }
});

// monitors for changes to the search result box
// if it recognizes an imdb url/id, it's clicked automatically
// since there's only one result
$("div.results").bind("DOMNodeInserted", function(e) {
    if ($("#filmCurrent").val().match(/(tt[0-9]{7})/)[1] && $("div.results").find("li").length) {
        setTimeout(function() {
            $("li", "div.results").trigger("click");
        }, REQUEST_DELAY);
    }
});