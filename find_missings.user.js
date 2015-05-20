// ==UserScript==
// @name        Find missing entries
// @namespace   find_channels
// @include     http://www.wykop.pl/mikroblog/
// @version     1.4
// @downloadURL https://ginden.github.io/wypok_scripts/find_missings.user.js
// @grant       none
// ==/UserScript==


"use strict";
var script = document.createElement("script");
script.textContent = "(" + main.toString() + ")();";
document.body.appendChild(script);
function main() {

    if (window.wykop) {
        window.wykop.plugins = window.wykop.plugins || {};
        window.wykop.plugins.Ginden = window.wykop.plugins.Ginden || {};
        window.wykop.plugins.Ginden.SearchChannels = {};
    }

    function getWypokArchive() {
        return (
        (window.wykop && window.wykop.plugins.Ginden.Archive)
        ||
        (window.WypokArchive)
        )
    }

    var itemsStream = document.querySelector('#itemsStream');
    var items = 0;
    var processed = {};
    var displayed = {};
    var checked = {};
    var allMisses = {};
    var htmlEntries = {};
    var currentUser = $('.logged-user > a > img.avatar').attr('alt');
    var storage = currentUser ? localStorage : sessionStorage;
    var maxId = -Infinity;
    var currentDate = (new Date()).toDateString();

    function parseBlackList(callback) {
        $.ajax({
            url:      'http://www.wykop.pl/ustawienia/czarne-listy/',
            dataType: 'html',
            success:  function (data) {
                data = $(data);
                var users = $('div[data-type="users"] a[title="Przejdź do profilu użytkownika"]', data).text().split('\n').map($.trim).filter(Boolean);
                var tags = [].map.call($('div[data-type="hashtags"] .tagcard', data), $).map(function (el) {
                    return el.text().trim()
                });
                callback({
                    users: users || [],
                    tags:  currentUser ? (tags || []) : ['#polityka', '#nsfw']
                });

            }
        });
    }

    function getBlackList(callback) {
        callback = callback || Function.prototype;
        if (storage['black_list_' + currentDate]) {
            callback(JSON.parse(storage['black_list_' + currentDate]));
        }
        else {
            parseBlackList(function (data) {
                Object.keys(storage).filter(function (el) {
                    return el.indexOf('black_list') === 0;
                }).forEach(function (key) {
                    delete storage[key];
                });
                storage['black_list_' + currentDate] = JSON.stringify(data);
                callback(data);
            });
        }
    }


    function createStringTemplate(string) {
        return function substitute(values) {
            var result = String(string);
            Object.keys(values).forEach(function (key) {
                result = result.split('$' + key).join(this[key]);
            }, values);
            return result;
        }
    }

    var generateLineUrl = createStringTemplate(
        '<li><span class="status_indicator"></span> <a href="$url">Wpis $id (dodany po $time)</a></li>'
    );

    var readEntries = getBlackList.bind(null, rawReadEntries);

    function rawReadEntries(blackList) {
        if (location.hash === '#go') {
            setTimeout(function () {
                wykop.checkNewEntries()
            }, 0);
            $('#newEntriesCounter a').click();
        }
        if (itemsStream.childElementCount > items) {
            var entries = [].slice.call($('#itemsStream > li > div'), 0, itemsStream.childElementCount - items + 1).reverse();
            var misses = [];
            entries.reduce(function (prev, curr) {
                var prevID = Number(prev.getAttribute('data-id'));
                var currID = Number(curr.getAttribute('data-id'));
                var prevTime = prev.querySelector('time').getAttribute('title');
                displayed[prevID] = displayed[currID] = true;
                var j;
                if (!processed[currID] && (currID - prevID) > 2) {
                    var howManyMissing = (currID - prevID) / 2;
                    for (j = 1; j < howManyMissing; j++) {
                        if ((prevID + j * 2) > maxId && allMisses[prevID + j * 2] === undefined && misses.length < 30) {
                            allMisses[prevID + j * 2] = {time: prevTime, special: false};
                            misses.push(prevID + j * 2);
                        }
                    }
                }

                processed[prevID] = true;
                return curr;
            });
            maxId = Math.max.apply(null, [maxId].concat(Object.keys(allMisses).map(Number).filter(Boolean)))
            Object.keys(allMisses).forEach(function (key) {
                if (displayed[key]) {
                    delete this[key];
                }
            }, allMisses);

            if (misses.length) {
                Object.keys(allMisses).map(Number).filter(Boolean).sort(function (a, b) {
                    return a - b;
                }).reverse().map(function (id) {
                        var url = 'http://wykop.pl/wpis/' + id + '/';
                        var ret = $(
                            generateLineUrl({
                                url:  url,
                                id:   id,
                                time: allMisses[id].time.slice(11)
                            }));
                        htmlEntries[id] = htmlEntries[id] || ret[0];
                        if (!checked[id]) {
                            htmlEntries[id].querySelector('.status_indicator').textContent = '?';
                        }
                        return;
                    }
                );
                displayMissedEntries(blackList);
            }

        }

    }

    function checkEntry(id, blackList) {
        $.ajax({
            url:     'http://www.wykop.pl/wpis/' + id + '/',
            success: function (text, a, b) {
                var title = '';
                if (String(text).indexOf('O akceptacji lub jej braku zostaniesz poinformowany') > -1) {
                    //alert('http://www.wykop.pl/wpis/' + id + '/');
                    htmlEntries[id].querySelector('.status_indicator').textContent = '!!!';
                    htmlEntries[id].querySelector('.status_indicator').setAttribute('style', 'color: red');
                }
                else {
                    htmlEntries[id].querySelector('.status_indicator').textContent = '\u2713';
                    if (text && String(text).trim()) {
                        var $text = $(text);
                        var $entry = $('.entry > div[data-type="entry"]', $text);
                        var is404 = $entry.length === 0;
                        if (is404) {
                            title = 'Brak wpisu.';
                            htmlEntries[id].classList && htmlEntries[id].classList.add && htmlEntries[id].classList.add('e404');
                            htmlEntries[id].querySelector('.status_indicator').textContent = '\u2718';
                            htmlEntries[id].querySelector('.status_indicator').setAttribute('style', 'color: red');
                        } else {
                            if (getWypokArchive() && getWypokArchive().updateData) {
                                getWypokArchive().updateData($entry);
                            } else if (document.querySelector('#treo_script')) {
                                setTimeout(function q() {
                                    if (getWypokArchive()) {
                                        getWypokArchive().updateData($entry);
                                    } else {
                                        setTimeout(q, 100);
                                    }
                                }, (500 + Math.random() * 1000) | 0);
                            }
                            var $entry = $('.entry > div[data-type="entry"]', $text);
                            var author = $('div.author > a > b', $entry).text().trim();
                            var tagsArray = [].slice.call($('a.showTagSummary', $entry)).map(function (tag) {
                                return '#' + tag.textContent.trim();
                            });

                            var tags = tagsArray.join(' ');
                            if (!(~blackList.users.indexOf(author))) {
                                outer: for (var i = 0; i < tagsArray.length; i++) {
                                    for (var j = 0; j < blackList.tags.length; j++) {
                                        if (tagsArray[i] === blackList.tags[j]) {
                                            htmlEntries[id].querySelector('.status_indicator').textContent = '\u2622';
                                            break outer;
                                        }
                                    }
                                }
                            } else {
                                htmlEntries[id].querySelector('.status_indicator').textContent = '\u2622';
                            }
                            var entryText = $('.text > p', $entry).text().trim();
                            if (entryText[0] === '@') {
                                htmlEntries[id].querySelector('.status_indicator').textContent = '@';
                            }
                            title = 'Autor: ' + author + '; \nTagi: ' + tags;

                        }
                    }


                }
                htmlEntries[id].setAttribute('title', title);
                checked[id] = true;
            }
        });
    }

    function displayMissedEntries(blackList) {
        $list.html('');
        $list.append.apply($list, Object.keys(htmlEntries).map(Number).sort(function (a, b) {
            return a - b
        }).reverse().map(function (id) {
            return this[id];
        }, htmlEntries));

        Object.keys(allMisses).map(Number).forEach(function (id) {
            if (checked[id] === undefined) {
                checkEntry(id, blackList);
            }
        });
        $('#miss_count').text(Object.keys(allMisses).length);
    }

    var $list;
    if (window.wykop && wykop.params && wykop.params.action === 'stream' && wykop.params.method === 'index') {
        $('head').append('<style>#miss_list a:visited {color: black !important;}');
        $('.grid-right').prepend(
            $('<div class="r-block"><h4>Pomini\u0119te wpisy (<span id="miss_count">?</span>): </h4><ul id="miss_list"></ul></div>')
        );
        $list = $('#miss_list');
        readEntries();
        var mutationObserver = new MutationObserver(function () {
            readEntries();
        });
        mutationObserver.observe(document.querySelector('#itemsStream'), {
            childList: true,
            subtree:   false
        });

    }

}