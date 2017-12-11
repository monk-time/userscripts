// ==UserScript==
// @name           IMDb List Helper
// @namespace      imdb
// @description    Makes creating IMDb lists more efficient and convenient
// @version        2.4.0
// @include        http://*imdb.com/list/*/edit
// @require        https://cdnjs.cloudflare.com/ajax/libs/jquery-csv/0.71/jquery.csv-0.71.min.js
// @grant          GM_addStyle
// ==/UserScript==

var jQuery = unsafeWindow.jQuery;
var $ = jQuery;

//
// CHANGELOG
//
// 2.4.0
// bugfix: IMDb changed layout
//
// 2.3.0
// bugfix: importing ratings works again
//
// 2.2.0
// added: support for people
//
// 2.1.1
// added: only show import form if ratings is selected
//
// 2.1
// added: importers for imdb, rateyourmusic, criticker
//
// 2.0
// added: import ratings
// added: if regex doesn't match, skip entry
//
// 1.6.1.2
// added: input text suggestion as a placeholder
//
// 1.6.1.1
// fixed: some entries are skipped when adding imdb ids/urls
//

//
// milliseconds between each request
//
var REQUEST_DELAY = 1000;

function processImdb(file) {
    var csv_lines = file.split("\n");
    for(var i = 1; i < csv_lines.length; ++i) {
        try {
            var data = jQuery.csv.toArray(csv_lines[i]);
            var rating = data[8];
            if(rating === "") {
                continue;
            }

            $("#filmList").append(rating + "," + data[1] + "\n");
        }
        catch(e) {
            console.log("Exception: " + e);
            console.log("Bad line: " + csv_lines[i]);
        }
    }
}

function processRym(file) {
    var csv_lines = file.split("\n");
    for(var i = 1; i < csv_lines.length; ++i) {
        try {
            var data = jQuery.csv.toArray(csv_lines[i]);
            if(data.length < 6) {
                continue;
            }

            $("#filmList").append(data[4] + "," + data[1] + "\n");
        }
        catch(e) {
            console.log("Exception: " + e);
            console.log("Bad line: " + csv_lines[i]);
        }
    }
}

function processCriticker(file) {
    var lines = file.split("\n");
    for(var i = 1; i < lines.length; ++i) {
        var line = lines[i];
        var m = line.match(/([1-9]{1}|10)([0-9])?\t(.+)/);
        if(m === null) {
            continue;
        }

        var rating = m[1];
        var second = m[2];
        if(second === undefined) {
            // If second value is undefined the rating is < 10 (on criticker)
            // and will be changed to 1 because you can't rate 0 on IMDb
            rating = "1";
        }

        $("#filmList").append(rating + "," + m[3] + "\n");
    }
}

function handleImport(evt) {
    var files = evt.target.files;
    var file = files[0];
    var reader = new FileReader();
    reader.onload = function(event){
        var file = event.target.result;
        var format = $("select[name=import]").val();
        if(format === "none") {
            alert("Select importer and try again.");
            return;
        }
        else if(format === "imdb") {
            processImdb(file);
        }
        else if(format === "rym") {
            processRym(file);
        }
        else if(format === "criticker") {
            processCriticker(file);
        }
    }

    reader.readAsText(file);
}

var ListManager = {
    regex: "^(.*)$",
    processRegex: function(rx, cb) {
        var filmTitle = rx[1];
        cb(filmTitle);
    },
    handleSelection: function(imdbId, cb) {
        cb();
    }
};

var RatingManager = {
    rating: 0,
    regex: "^([1-9]{1}|10),(.*)$",
    processRegex: function(rx, cb) {
        RatingManager.rating = rx[1];
        var filmTitle = rx[2];
        cb(filmTitle);
    },
    handleSelection: function(imdbId, cb) {
        console.log("RatingManager::handleSelection: Rating " + imdbId);
        $.get("http://www.imdb.com/title/" + imdbId, function(data) {
            var authHash = $(data).find("#star-rating-widget").data("auth");
            var params = {tconst: imdbId, rating: RatingManager.rating,
                            auth: authHash, tracking_tag: "list",
                            pageId: imdbId, pageType: "title", subPageType: "main"};
            $.post("http://www.imdb.com/ratings/_ajax/title", params, function(data) {
                if(data.status !== 200) {
                    alert("Rating failed. Status code " + data.status);
                }
                else {
                    cb();
                }
            }, "json");
        });
    }
};

var App = {
    manager: ListManager,
    films: [],
    regexObj: null,
    isEmpty: function() {
        return App.films.length === 0;
    },
    next: function() {
        return App.films.shift();
    },
    run: function() {
        GM_addStyle("#imdbListTextEdit { margin: 0 5% 5% 5%; } \
                     #imdbListTextEdit input[type=text], #imdbListTextEdit textarea { width: 100%; } \
                     #imdbListTextEdit textarea { background-color: lightyellow; }");
        var textEdit = '<div id="imdbListTextEdit" style="'
                    + 'padding: 10px; border: 1px solid #e8e8e8">'
                    + '<p><b>Import mode:</b><input type="radio" name="importmode" value="list" checked="checked">List</input>'
                    + '<input type="radio" name="importmode" value="ratings">Ratings</input></p>'
                    + '<textarea id="filmList" rows="7" cols="60" placeholder="Input titles or IMDb IDs and click Start"></textarea><br />'
                    + '<input type="button" id="doList" value="Start" /> '
                    + '<input type="button" id="skipFilm" value="Skip" /> '
                    + '<input type="button" id="retryPost" value="Retry" /> '
                    + '<span style="font-weight: bold">Remaining: <span id="filmsRemaining">0</span></span><br /><br />'
                    + '<span style="font-weight: bold;">Current: <input type="text" id="filmCurrent" size="65" style="font-family: monospace" /></span><br />'
                    + '<span style="font-weight: bold;">Regexp (matches only): <input type="text" value="" id="filmRegexp" size="65" style="font-family: monospace; margin-top: 4px; margin-left: 1px" /></span><br />'
                    + '<p id="importform" style="display: none"><b>Import from:</b> <select name="import"><option value="none">Select</option><option value="imdb">IMDb</option>'
                    + '<option value="rym">RateYourMusic</option><option value="criticker">Criticker</option></select><b> File: </b><input type="file" id="fileimport"></p>'
                    + '</div>';
        $("div.lister-search").after(textEdit);

        $("#filmRegexp").val(App.manager.regex);

        $("#fileimport").on("change", handleImport);

        $("#imdbListTextEdit").on("change", "input[name=importmode]", function() {
            var value = $(this).val();
            if(value === "list") {
                App.manager = ListManager;
                $("#importform").hide();
            }
            else {
                App.manager = RatingManager;
                $("#importform").show();
            }

            $("#filmRegexp").val(App.manager.regex);
        });

        // When start button is clicked
        $("#imdbListTextEdit").on("click", "#doList", function(e) {
            $regexBox = $("#filmRegexp");
            if($regexBox.val()) {
                App.regexObj = RegExp($regexBox.val());
            }
            else {
                App.regexObj = RegExp(App.manager.regex);
            }

            // Disable the text area and the button and the regexp box
            // as well as the import mode
            $filmList = $("#filmList");
            $filmList.attr("disabled", "disabled");
            $regexBox.attr("disabled", "disabled");
            $("#doList").attr("disabled", "disabled");
            $("input[name=importmode]").attr("disabled", "disabled");

            App.films = $filmList.val().split("\n");
            App.handleNext();
        });

        // when skip button is clicked
        $("#imdbListTextEdit").on("click", "#skipFilm", function(e) {
            App.handleNext();
        });

        // Sometimes the request fails forcing the user to skip an entry to continue
        $("#imdbListTextEdit").on("click", "#retryPost", function(e) {
            $("#add-to-list-search").trigger("keydown");
        });
    },
    reset: function() {
        App.films = [];
        App.regexObj = null;

        $("#filmList").removeAttr("disabled");
        $("#filmRegexp").removeAttr("disabled"); // leave regex
        $("#doList").removeAttr("disabled");
        $("input[name=importmode]").removeAttr("disabled");

        $("#filmCurrent").val("");

        $("#add-to-list-search", "div.add").val("");
        //$("div.results", "div.add").html("");
    },
    search: function(filmTitle) {
        // remove unnecessary whitespace
        filmTitle = $.trim(filmTitle);

        // set current text to what we're searching
        $("#filmCurrent").val(filmTitle);

        // remove the first title from the text box and set the remaining number
        $filmList = $("#filmList");
        var newList = $filmList.val().split("\n");
        $("#filmsRemaining").text(newList.length-1);
        $filmList.val(newList.slice(1).join("\n"));

        // Run regex if it matches and let the manager process the result
        var result = App.regexObj.exec(filmTitle);
        if(result !== null) {
            App.manager.processRegex(result, function(filmTitle) {
                // Set imdb search input field to film title
                $("#add-to-list-search").val(filmTitle);

                // And perform search
                $("#add-to-list-search").trigger("keydown");
            });
        }
        else {
            App.handleNext();
        }
    },
    handleNext: function() {
        if(!App.isEmpty()) {
            // if there's more items, search next...
            App.search(App.next());
        }
        else {
            // if last film
            App.reset();
        }
    }
};

$(document).ready(App.run);

// When a search result item is clicked by user or script
$("#add-to-list-search-results").on("click", "a", function(e) {
    App.manager.handleSelection($(this).attr("id"), function() {
        // Some delay is needed
        setTimeout(function() {
            App.handleNext();
        }, REQUEST_DELAY);
    });
});

// Monitors for changes to the search result box
// If it recognizes an IMDBb URL/ID, it's clicked automatically
// since there's only one result
var clickId = null;
$("#add-to-list-search-results").bind("DOMNodeInserted", function(e) {
    if($("#filmCurrent").val().match(/([CHMNTchmnt]{2}[0-9]{7})/) !== null && $("a", "#add-to-list-search-results").length) {
        // Some delay is needed for all results to appear
        clickId = setTimeout(function() {
            $("a", "#add-to-list-search-results").first()[0].click();
            clearTimeout(clickId);
        }, REQUEST_DELAY);
    }
});