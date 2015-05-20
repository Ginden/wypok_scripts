// ==UserScript==
// @name        Wypok Archive
// @namespace   archive_wypok
// @include     http://www.wykop.pl/wpis/*/*
// @include     http://www.wykop.pl/mikroblog/
// @include     http://www.wykop.pl/ustawienia/
// @version     1.2
// @downloadURL https://ginden.github.io/wypok_scripts/archive_wypok.user.js
// @grant       none
// ==/UserScript==


var script = document.createElement("script");
script.textContent = '(' + main + ")();";
document.body.appendChild(script);

function main() {
    (function clearAds() {
        $('*[id|=bmone2n], iframe[id|=gemius]').remove();
        localStorage.removeItem('BProfiler');
        localStorage.removeItem('ibbid');
        document.cookie = 'ibbid=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = '__utmmobile=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = 'JSESSIONIDN=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = '_gat=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        document.cookie = '_ga=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    })();
    function isDebug() {
        return localStorage.debug === 'true' || location.hash === '#debug';
    }

    var saveFile = (function () {
        var a = document.createElement("a");
        a.style = 'display: none';
        return function (data, mimeType, fileName) {
            var blob = new Blob([data], {type: 'application/octet-stream'}),
                url = window.URL.createObjectURL(blob);
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            setTimeout(function () {
                a.click();
                D.body.removeChild(a);
                setTimeout(function () {
                    URL.revokeObjectURL(url);
                }, 1500);
            }, 500);
        };
    }());

    if (!window.treo) {
        if (!document.querySelector('#treo_script')) {
            var treoScript = document.createElement('script');
            treoScript.setAttribute('src', 'https://ginden.github.io/wypok_scripts/treo.js');
            treoScript.setAttribute('id', 'treo_script');
            document.body.appendChild(treoScript);
        }
        setTimeout(main, 50);
        return;
    }
    var archiveApi = window.WypokArchive = {};
    archiveApi.updateData = updateData;
    archiveApi.exportToFile = exportToFile;
    function murmurhash3_32_gc(key) {
        'use strict';
        var remainder, bytes, h1, h1b, c1, c2, k1, i, seed;
        seed = 904955607;
        key = String(key);
        remainder = key.length & 3; // key.length % 4
        bytes = key.length - remainder;
        h1 = seed;
        c1 = 0xcc9e2d51;
        c2 = 0x1b873593;
        i = 0;

        while (i < bytes) {
            k1 =
            ((key.charCodeAt(i) & 0xff)) |
            ((key.charCodeAt(++i) & 0xff) << 8) |
            ((key.charCodeAt(++i) & 0xff) << 16) |
            ((key.charCodeAt(++i) & 0xff) << 24);
            ++i;

            k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
            k1 = (k1 << 15) | (k1 >>> 17);
            k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;

            h1 ^= k1;
            h1 = (h1 << 13) | (h1 >>> 19);
            h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
            h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
        }

        k1 = 0;

        switch (remainder) {
            case 3:
                k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
            case 2:
                k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
            case 1:
                k1 ^= (key.charCodeAt(i) & 0xff);

                k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
                k1 = (k1 << 15) | (k1 >>> 17);
                k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
                h1 ^= k1;
        }

        h1 ^= key.length;

        h1 ^= h1 >>> 16;
        h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
        h1 ^= h1 >>> 13;
        h1 = ((((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16))) & 0xffffffff;
        h1 ^= h1 >>> 16;

        return h1 >>> 0;
    }

    function hashObject(obj) {
        return Object.keys(obj).sort().reduce(function (str, key) {
            str.push(murmurhash3_32_gc(key), murmurhash3_32_gc(obj[key]));
            return str;
        }, []).join('');
    }

    var schema = treo.schema()
        .version(1)
        .addStore('entries', {key: 'id'})
        .addIndex('byId', 'id', {unique: true})
        .addIndex('byParentId', 'parent_id')
        .addIndex('byAuthor', 'author')
        .version(2)
        .addStore('votes')
        .addIndex('byParentId', 'parent_id')
        .addIndex('byAuthor', 'author');
    // open db
    var db = treo('wypok_archive', schema);

    function updateData($entry) {
        var entry = {};
        $entry = $entry || $('#itemsStream > li > div[data-type="entry"]');
        entry.id = Number($entry.attr('data-id'));
        entry.author = $('.author a.showProfileSummary b', $entry).text().trim();
        entry.parent_id = null;
        entry.hasImage = !!$('.media-content', $entry).length;
        entry.cdnImage = entry.hasImage ? $('.media-content a > img', $entry).parent().attr('href') : null;
        entry.sourceImage = entry.hasImage ? $('p.description > a', $entry).attr('href') : null;
        entry.votesCount = Number($('.vc > b', $entry).text().trim());
        entry.tags = [].map.call($('a.showTagSummary', $entry), function (el) {
            return el.textContent.trim();
        });
        entry.deleted = false;
        entry.html = $('.text > p', $entry).html().trim();
        entry.text = $('.text > p', $entry).text().split('\n').map(function (el) {
            return el.trim();
        }).join('\n');
        entry.time = $('time', $entry).attr('datetime');
        entry.unix = Math.floor((+(new Date($('time', $entry).attr('datetime')))) / 1000);

        var entry_votes = [].concat.apply([], ($('.showVotes', $entry).length && entry.votesCount) ? [].map.call($('.voters-list a'), function (el) {
            return {author: el.textContent.trim(), parent_id: entry.id};
        }) : []);
        entry.channel = $('.author', $entry).text().indexOf('\u21D2') === -1 ? null : $('.author > small > a.c888', $entry).text().trim();

        var entries = [].map.call($('ul.sub > li > div[data-type="entrycomment"]', $entry.parent('#itemsStream')[0]), function (entryComment) {
            var $comment = $(entryComment);
            var comment = {
                channel:   entry.channel,
                parent_id: entry.id

            };
            comment.id = Number($comment.attr('data-id'));
            comment.author = $('.author a.showProfileSummary b', $comment).text().trim();
            comment.hasImage = !!$('.media-content', $comment).length;
            comment.cdnImage = comment.hasImage ? $('.media-content a > img', $comment).parent().attr('href') : null;
            comment.sourceImage = comment.hasImage ? $('p.description > a', $comment).attr('href') : null;
            comment.votesCount = Number($('.vc > b', $comment).text().trim());
            comment.tags = [].map.call($('a.showTagSummary', $comment), function (el) {
                return el.textContent.trim();
            });
            comment.html = $('.text > p', $comment).html().trim();
            comment.text = $('.text > p', $comment).text().split('\n').map(function (el) {
                return el.trim();
            }).join('\n');
            comment.time = $('time', $comment).attr('datetime');
            comment.unix = Math.floor((+(new Date($('time', $comment).attr('datetime')))) / 1000);
            entry_votes.concat(($('.showVotes', $comment).length && entry.votesCount) ? [].map.call($('.voters-list a'), function (el) {
                return {author: el.textContent.trim(), parent_id: entry.id};
            }) : []);

            return comment;
        });
        entries.push(entry);
        isDebug() && console.log(entries);
        logEntries(entries);
        // logVotes(entry_votes);
    }

    function logEntries(entries) {
        var store = db.store('entries');
        entries.forEach(function (entry) {
            store.get(entry.id, function (err, oldEntry) {
                if (err) {
                    console.error(err);
                } else {
                    if (oldEntry === undefined) {
                        store.put(entry.id, entry, Function());
                    } else {
                        if (hashObject(entry) !== hashObject(oldEntry)) {
                            store.del(entry.id, function (err) {
                                if (err) {
                                    isDebug() && console.error(err);
                                }
                                else {
                                    store.put(entry.id, entry, Function());
                                }
                            })
                        } else {

                        }
                    }
                }
            });
        });
    }

    function logVotes(votes) {
        var store = db.store('votes');
        votes.forEach(function () {

        });
    }

    function clearDatabase() {
        var store1 = db.store('votes');
        var store2 = db.store('entries');
        if (confirm('Really clear database?')) {
            store1.clear(Function());
            store2.clear(Function());
        }
        alert('Database was cleared');
    }

    function exportToFile(entries, e) {
        e.preventDefault();
        var parents = [];
        var childs = [];
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].parent_id === null) {
                entries[i].childs = [];
                parents.push(entries[i]);
            }
            else {
                childs.push(entries[i]);
            }
        }
        parents.sort(function (a, b) {
            return a.id === b.id ? 0 : (a.id < b.id ? 1 : -1);
        });
        childs.sort(function (a, b) {
            return a.parent_id === b.parent_id ? (a.id === b.id ? 0 : (a.id < b.id ? 1 : -1)) : (a.parent_id < b.parent_id ? 1 : -1);
        });

        for (var childPointer = 0, parentPointer = 0, parent, child; parentPointer < parents.length; parentPointer++) {
            parent = parents[parentPointer];
            while (true) {
                child = childs[childPointer];
                if (child && child.parent_id === parent.id) {
                    parent.childs.push(child);
                    childPointer++;
                } else {
                    break;
                }

            }
        }
        var ret = {
            time:          Date(),
            entries_total: entries.length,
            author:        $('.logged-user > a > img.avatar').attr('alt'),
            data:          parents,
            with_childs:   true,
            with_votes:    false
        };
        var fileName = 'wypok_archive_' + [(new Date).getYear(), (new Date).getMonth(), (new Date).getDate()].join('_') + '_entries_' + entries.length + '.json';
        saveFile(JSON.stringify(ret, null, 1), 'application/json', fileName);
        return false;
    }

    var mutationObserver = new MutationObserver(function () {
        updateData();
    });
    if (window.wykop && wykop.params && wykop.params.action === 'entries' && wykop.params.method === 'index') {
        mutationObserver.observe(document.querySelector('#itemsStream'), {
            childList: true,
            subtree:   true
        });
        updateData();
    } else if (window.wykop && wykop.params && wykop.params.action === 'settings' && wykop.params.method === 'index') {
        (function () {
            var store = db.store('entries');
            store.all(function (err, all) {
                var l = (all && all.length) || 0;
                $('<button />').attr('class', 'button').click(exportToFile.bind(null, all)).appendTo('.buttons p').text('Eksportuj zapisane wpisy (' + l + ')');
                $('<button />').attr('class', 'button').click(clearDatabase).appendTo('.buttons p').text('Wyczyść bazę danych (' + l + ')');
            })
        }())
    }

}
