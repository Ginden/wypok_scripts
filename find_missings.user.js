// ==UserScript==
// @name        Find missings
// @namespace   find_channels
// @include     http://www.wykop.pl/mikroblog/
// @version     1.3
// @downloadURL https://ginden.github.io/wypok_scripts/find_missings.user.js
// @grant       none
// ==/UserScript==


"use strict";
var script = document.createElement("script");
script.textContent = "(" + main.toString() + ")();";
document.body.appendChild(script);
function main() {
    var itemsStream = document.querySelector('#itemsStream');
    var items = 0;
    var processed = {};
    var displayed = {};
    var checked = {};
    var allMisses = window.widows = {};
    var htmlEntries = {};

    function readEntries() {
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
                        if (allMisses[prevID + j * 2] === undefined) {
                            allMisses[prevID + j * 2] = {time: prevTime, special: false};
                            misses.push(prevID + j * 2);
                        }
                    }
                }

                processed[prevID] = true;
                return curr;
            });

            Object.keys(allMisses).forEach(function (key) {
                if (displayed[key]) {
                    delete this[key];
                }
            }, allMisses);

            if (misses.length) {
                Object.keys(allMisses).map(Number).filter(Boolean).sort(function (a, b) {
                    return a - b
                }).reverse().map(function (id) {
                        var url = 'http://wykop.pl/wpis/' + id + '/';
                        var ret = $('<li><a href="' + url + '">Wpis ' + id + ' (dodany po ' + allMisses[id].time.slice(11) + ')<span class="check_status">' + (checked[id] ? '' : '?') + '</span></a></li>');
                        htmlEntries[id] = htmlEntries[id] || ret[0];
                        return;
                    }
                );
                displayMissedEntries(misses);

            }

        }

    }

    function displayMissedEntries(misses) {
        $list.html('');
        $list.append.apply($list, Object.keys(htmlEntries).map(Number).sort(function (a, b) {
            return a - b
        }).reverse().map(function (id) {
            return this[id];
        }, htmlEntries));

        Object.keys(allMisses).map(Number).forEach(function (id) {
            if (checked[id] === undefined) {
                $.ajax({
                    url:     'http://www.wykop.pl/wpis/' + id + '/',
                    success: function (text, a, b) {
                        var title = 'default';
                        if (String(text).indexOf('O akceptacji lub jej braku zostaniesz poinformowany') > -1) {
                            alert('http://www.wykop.pl/wpis/' + id + '/');
                            htmlEntries[id].querySelector('.check_status').textContent = '!!!';
                            htmlEntries[id].setAttribute('style', 'color: red !important;');
                            $(htmlEntries[id]).prepend('<span style="color: green" title="404">\u2718</span>');
                        }
                        else {
                            htmlEntries[id].querySelector('.check_status').textContent = '';
                            if (text && String(text).trim()) {
                                var $text = $(text);
                                var $entry = $('.entry > div[data-type="entry"]', $text);
                                var is404 = $entry.length === 0;
                                if (is404) {
                                    title = 'Brak wpisu.';
                                    htmlEntries[id].classList && htmlEntries[id].classList.add('e404');
                                    $(htmlEntries[id]).prepend('<span style="color: red" title="404">\u2718</span>');
                                } else {
                                    if (window.WypokArchive && window.WypokArchive.updateData) {
                                        window.WypokArchive.updateData($entry);
                                    } else if (document.querySelector('#treo_script')) {
                                        setTimeout(function () {
                                            window.WypokArchive.updateData($entry);
                                        }, (500 + Math.random() * 1000) | 0);
                                    }
                                    var $entry = $('.entry > div[data-type="entry"]', $text);
                                    var author = $('div.author > a > b', $entry).text().trim();
                                    var tags = [].slice.call($('a.showTagSummary', $entry)).map(function (tag) {
                                        return '#' + tag.textContent.trim();
                                    }).join(' ');
                                    title = 'Autor: ' + author + '; \nTagi: ' + tags;

                                }
                            }


                        }
                        htmlEntries[id].setAttribute('title', title);

                        checked[id] = true;

                    }
                });
            }
        });
        $('#miss_count').text(Object.keys(allMisses).length);
    }

    $('.grid-right').prepend(
        $('<div class="r-block"><h4>Pomini\u0119te wpisy (<span id="miss_count"></span>): </h4><ul id="miss_list"></ul></div>')
    );
    var $list = $('#miss_list');
    if (window.wykop && wykop.params && wykop.params.action === 'stream' && wykop.params.method === 'index') {
        readEntries();
        var mutationObserver = new MutationObserver(function () {
            readEntries();
        });
        mutationObserver.observe(document.querySelector('#itemsStream'), {
            childList: true,
            subtree:   false
        });
    }
    $('head').append('<style>#miss_list a:visited {color: black !important;}');
}