// ==UserScript==
// @name        Wykop histogram
// @namespace   wykop_ginden_histogram
// @include     http://www.wykop.pl/ludzie/*/
// @version     1.0.0
// @downloadURL https://ginden.github.io/wypok_scripts/histogram.user.js
// @grant       none
// ==/UserScript==


"use strict";
var script = document.createElement("script");
script.textContent = "(" + main.toString() + ")();";
document.body.appendChild(script);
function main() {
    /*if (typeof $ === 'undefined') {
     $ = function(){
     return {
     attr: function(){return this;},
     appendTo: function(){return this;},
     fail: function(){return this;},
     done: function(){return this;}
     }
     };
     }*/
    // thx Maciej
    function parseDate(date) {
        if (!date.replace) {
            console.warn(date, new Error().stack);
        }
        return new Date(date.replace(/-/g, '/'));
    }

    if (window.wykop) {
        window.wykop.plugins = window.wykop.plugins || {};
        window.wykop.plugins.Ginden = window.wykop.plugins.Ginden || {};
        window.wykop.plugins.Ginden.Histogram = {};
    }
    var max_pages = 1;
    var maxOld = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    var sessionKey = 'SBUO6Q1ncK';
    var chartIcon = '<svg height="1000" width="1071.429" xmlns="http://www.w3.org/2000/svg"><path d="M285.696 571.456v214.272h-142.848v-214.272h142.848zm214.272 -285.696v499.968h-142.848v-499.968h142.848zm214.272 142.848v357.12h-142.848v-357.12h142.848zm214.272 -214.272v571.392h-142.848v-571.392h142.848zm71.424 624.96v-678.528q0 -7.254 -5.301 -12.555t-12.555 -5.301h-892.8q-7.254 0 -12.555 5.301t-5.301 12.555v678.528q0 7.254 5.301 12.555t12.555 5.301h892.8q7.254 0 12.555 -5.301t5.301 -12.555zm71.424 -678.528v678.528q0 36.828 -26.226 63.054t-63.054 26.226h-892.8q-36.828 0 -63.054 -26.226t-26.226 -63.054v-678.528q0 -36.828 26.226 -63.054t63.054 -26.226h892.8q36.828 0 63.054 26.226t26.226 63.054z"/></svg>';
    var blob = new Blob([chartIcon], {type: "image/svg+xml;charset=utf-8"});
    var blobUrl = URL.createObjectURL(blob);

    var ERR = {
        LAST_PAGE: Object.freeze(Object.create(null))
    };

    var profile = jQuery('h2.rel span[class*=color-]').text().trim();
    var $buttonContainer = jQuery('.user-profile div.m-reset-position').last();
    var $button = jQuery('<a class="button" />').append(
        $('<img />').attr('src', blobUrl).attr('width', 14)
    ).appendTo($buttonContainer).click(handleHistogram);

    function handleHistogram() {
        var keys = Object.keys(urls);
        var completedTasks = 0;
        var error;
        keys.forEach(function (key) {
            var func = urls[key];
            (function nextPage(page) {
                var myDone = function (err) {
                    if (!err) {
                        setTimeout(function () {
                            if (!error) {
                                nextPage(page + 1);
                            }
                        }, 1);
                    } else if (err === ERR.LAST_PAGE) {
                        endTask(null, key);
                    } else {
                        endTask(err, null);
                        error = err;
                        console.error(err);
                    }
                };
                func(page, myDone);
            }(1));
        });
        function endTask(err, key) {
            completedTasks++;
            console.log('Completed task ', key, completedTasks, '/', keys.length);

        }
    }

    var activities = [];
    var requestDone = 0;
    window.activities = {
                    get requests() {
                        return requestDone;
                    },
        activities: activities
    };
    var apiOptions = {
        dataType: 'json',
        success:  function () {
            requestDone++;
        },
        method:   'GET'
    };

    function mergeObjects() {
        var ret = {};
        for (var i = 0, obj; i < arguments.length; i++) {
            obj = arguments[i];
            Object.keys(obj).forEach(function (key) {
                ret[key] = obj[key];
            });
        }
        return ret;
    }

    var checkedEntries = {};

    var urls = {
        'dodane':            function dodane(page, done) {
            if (page > max_pages) {
                return done(ERR.LAST_PAGE);
            }
            var url = 'http://a.wykop.pl/profile/added/' + profile + '/appkey/' + sessionKey + '/page/' + page + '/';
            $.ajax(mergeObjects({url: url}, apiOptions)).done(function (data) {
                if (Array.isArray(data)) {

                    for (var i = 0, link; i < data.length; i++) {
                        link = data[i];
                        if (parseDate(link.date) < maxOld) {
                            console.log('ended on link', link);
                            done(ERR.LAST_PAGE);
                            return;
                        }
                        activities.push({id: link.id, time: parseDate(link.date), type: 'link-added'});
                    }
                    done(data.length === 0 ? ERR.LAST_PAGE : null);

                } else {
                    done(data);
                }
            }).fail(done);
        },
        'komentarze':        function komentarze(page, done) {
            if (page > max_pages) {
                return done(ERR.LAST_PAGE);
            }
            var url = 'http://a.wykop.pl/profile/comments/' + profile + '/appkey/' + sessionKey + '/page/' + page + '/';
            $.ajax(mergeObjects({url: url}, apiOptions)).done(function (data) {
                if (Array.isArray(data)) {
                    for (var i = 0, comment; i < data.length; i++) {
                        comment = data[i];
                        if (parseDate(comment.date) < maxOld) {
                            console.log('Ended on comment', comment);
                            done(ERR.LAST_PAGE);
                            return;
                        }
                        activities.push({id: comment.id, time: parseDate(comment.date), type: 'link-commented'});
                    }
                    done(data.length === 0 ? ERR.LAST_PAGE : null);
                } else {
                    done(data);
                }
            }).fail(done);
        },
        'powiazane':         function powiazane(page, done) {
            // TODO: implement it
            done(ERR.LAST_PAGE);
        },
        'wykopane':          function wykopane(page, done) {
            if (page > max_pages) {
                return done(ERR.LAST_PAGE);
            }
            var url = 'http://a.wykop.pl/profile/digged/' + profile + '/appkey/' + sessionKey + '/page/' + page + '/';
            $.ajax(mergeObjects({url: url}, apiOptions)).done(function (data) {
                if (Array.isArray(data)) {
                    for (var i = 0, dig; i < data.length; i++) {
                        dig = data[i];
                        if (parseDate(dig.date) < maxOld) {
                            done(ERR.LAST_PAGE);
                            return;
                        }
                        activities.push({id: dig.id, time: parseDate(dig.date), type: 'link-digged'});
                    }
                    done(data.length === 0 ? ERR.LAST_PAGE : null);
                } else {
                    done(data);
                }
            }).fail(done);
        },
        'wpisy':             function wpisy(page, done) {
            if (page > max_pages) {
                return done(ERR.LAST_PAGE);
            }
            var url = 'http://a.wykop.pl/profile/entries/' + profile + '/appkey/' + sessionKey + '/page/' + page + '/';
            $.ajax(mergeObjects({url: url}, apiOptions)).done(function (data) {
                if (Array.isArray(data)) {

                    for (var i = 0, entry; i < data.length; i++) {
                        entry = data[i];
                        checkedEntries[entry.id] = true;
                        if (parseDate(entry.date) < maxOld) {
                            done(ERR.LAST_PAGE);
                            return;
                        }
                        activities.push({id: entry.id, time: parseDate(entry.date), type: 'entry-added'});
                        entry.comments.forEach(EntryCommentHandler());
                    }

                    done(data.length === 0 ? ERR.LAST_PAGE : null);

                } else {
                    done(data);
                }
            }).fail(done);
        },
        'komentowane-wpisy': function komentowaneWpisy(page, done) {
            if (page > max_pages) {
                return done(ERR.LAST_PAGE);
            }
            var url = 'http://a.wykop.pl/profile/entriescomments/' + profile + '/appkey/' + sessionKey + '/page/' + page + '/';
            var morePages = true;
            $.ajax(mergeObjects({url: url}, apiOptions)).done(function (data) {
                if (Array.isArray(data)) {
                    var entries = [];
                    for (var i = 0, entryComment; i < data.length; i++) {
                        entryComment = data[i];
                        if (!checkedEntries[entryComment.entry.id]) {
                            entries.push(entryComment.entry.id);
                        }
                        if (parseDate(entryComment.date) < maxOld) {
                            morePages = false;
                        } else {
                            EntryCommentHandler()(entryComment);
                        }
                    }
                    (function nextEntry(entry) {
                        if (entry) {
                            readEntry(entry, function (err) {
                                if (err) {
                                    done(err);
                                    return;
                                }
                                nextEntry(entries.pop());
                            })
                        } else {
                            done(data.length === 0 ? ERR.LAST_PAGE : null);
                        }
                    }(entries.pop()));
                } else {
                    done(data);
                }
            }).fail(done);

        },
        'plusowane-wpisy':   function plusowaneWpisy(page, done) {
            if (page > max_pages) {
                return done(ERR.LAST_PAGE);
            }
            done(ERR.LAST_PAGE);
        }
    };

    function readEntry(id, done) {
        var url = 'http://a.wykop.pl/entries/index/' + id + '/appkey/' + sessionKey + '/';
        $.ajax(mergeObjects({url: url}, apiOptions)).done(function (data) {
            if (data.err) {
                done(data);
                return
            }
            data.voters.forEach(VoteHandler(data.id, 'entry'));
            data.comments.forEach(EntryCommentHandler());
            checkedEntries[data.id] = true;
            done();
        }).fail(done);
    }

    function EntryCommentHandler() {
        return function entryCommentHandler(entryComment) {
            if (entryComment && entryComment.voters && Array.isArray(entryComment.voters)) {
                entryComment.voters.forEach(VoteHandler(entryComment.id, 'entry-comment'));
                if (entryComment.author === profile && parseDate(entryComment.date) > maxOld) {
                    activities.push({
                        id:   entryComment.id,
                        time: parseDate(entryComment.date),
                        type: 'entry-comment-added'
                    });
                }
            } else {
                console.log(entryComment);
            }
        }
    }

    function VoteHandler(parentId, type) {
        return function voteHandler(vote) {
            if (vote.author === profile && parseDate(vote.date) > maxOld) {
                activities.push({
                    id:   parentId,
                    time: parseDate(vote.date),
                    type: type + '-voted'
                });
            }
        }
    }

}