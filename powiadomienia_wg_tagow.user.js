// ==UserScript==
// @name        Powiadomienia wg tagów
// @namespace   sort_notifications
// @include     http://www.wykop.pl/powiadomienia/tagi/*
// @include     http://www.wykop.pl/powiadomienia/channels/*
// @version     1.2
// @grant       none
// @downloadURL https://ginden.github.io/wypok_scripts/powiadomienia_wg_tagow.user.js
// ==/UserScript==

function main() {

    if (window.wykop) {
        window.wykop.plugins = window.wykop.plugins || {};
        window.wykop.plugins.Ginden = window.wykop.plugins.Ginden || {};
        window.wykop.plugins.Ginden.SortNotifications = {};
    }
    function dbGetSortOrder(tag) {
        return localStorage[sort_tags_prefix + tag] ? Number(localStorage[sort_tags_prefix + tag]) : undefined;
    }

    function dbSetSortOrder(tag, value) {
        if (value !== undefined) {
            return localStorage[sort_tags_prefix + tag] = value;
        } else {
            delete localStorage[sort_tags_prefix + tag];
            return undefined;
        }
    }

    var sort_tags_prefix = 'GINDEN_SORT_TAGS_#';
    var state = window.wykop.plugins.Ginden.SortNotifications.state = {
        list: [],
        tags: {},
                 get sortedTags() {

                     var tagArray = Object.keys(this.tags);

                     return tagArray.sort(function (a, b) {
                         if (dbGetSortOrder(a) === dbGetSortOrder(b)) {
                             return a.toLowerCase() > b.toLowerCase();
                         } else if (dbGetSortOrder(a) !== undefined && dbGetSortOrder(b) === undefined) {
                             return -1;
                         } else if (dbGetSortOrder(a) === undefined && dbGetSortOrder(b) !== undefined) {
                             return 1;
                         } else {
                             return dbGetSortOrder(a) > dbGetSortOrder(b) ? -1 : 1;
                         }
                     }).map(function (key) {
                         var ret = this.tags[key];
                         ret.elements.sort(function (a, b) {
                             return a.read === b.read ? 0 : (a.read > b.read ? 1 : -1);
                         });
                         return ret;
                     }, this);
                 },
        add:     function (el) {
            this.list.push(el);
            this.tags[el.tag] = this.tags[el.tag] || {
                html:     $('<li  class="annotation space ginden-sort-tags-tag ' + (dbGetSortOrder(el.tag) === undefined ? '' : 'pinned') + '" data-tag="' + el.tag + '">\
                           <h3 class="clear-bottom">' + el.tag + '<i class="pin">\uD83D\uDCCC</i><i class="up">\u25b2</i><i class="down">\u25BC</i></h3></li>')[0],
                tag:      el.tag,
                elements: []
            };
            this.tags[el.tag].elements.push(el);
        },
        render:  function (firstTime) {
            var $panel = $('ul.notification');

            if (firstTime) {
                $panel.on('click', 'h3 i.pin', function (e) {
                    var $parent = $(e.target).closest('[data-tag]');
                    var tag = $parent.attr('data-tag');
                    if (dbGetSortOrder(tag) === undefined) {
                        dbSetSortOrder(tag, 100);
                        $parent.toggleClass('pinned', true);
                    } else {
                        dbSetSortOrder(tag, undefined);
                        $parent.toggleClass('pinned', false);
                    }
                    state.render();
                });
                $panel.on('click', 'i.up, i.down', function (e) {
                    if ($(e.target).closest('[data-tag]').hasClass('pinned') === false) {
                        return false;
                    }
                    var up = $(e.target).hasClass('up');
                    var tag = $(e.target).closest('[data-tag]').attr('data-tag');
                    console.log({up: up, tag: tag, target: e.target, dbGetSortOrder: dbGetSortOrder(tag)});
                    if (up) {

                        dbSetSortOrder(tag, (dbGetSortOrder(tag) || 0) + 10);
                    } else {
                        dbSetSortOrder(tag, (dbGetSortOrder(tag) || 0) - 10);
                    }
                    state.render();
                });
                $panel.html('');
                $panel.append(
                    $('<li class="annotation space" id="ginden-sort-tags-loading"><h4 class="clear-bottom"></h4></li>')
                );

            }
            var html = [];
            this.sortedTags.forEach(function (el) {
                html.push(el);
                [].push.apply(html, el.elements);
            });
            $panel.find('#ginden-sort-tags-loading h4').text(this.loading ? 'ładowanie' : ('pobrano (przeszukano stron: ' + retrievedPages + ')'));
            $panel.find('li').not(':eq(0)');

            $panel.append.apply($panel, html.map(function (el) {
                return el.html;
            }));
        },
        loading: true
    };
    var retrievedPages = 0;

    function extractNotifications(doc) {
        state.loading = false;
        var $panel = $('ul.notification', doc);
        // var $list = $panel.find('li.type-light-warning');
        var $list = $panel.find('li:not([class]), li.type-light-warning');
        var retrieveNext = false;
        if ($panel.find('li.type-light-warning')) {
            [].map.call($list, function (el) {
                var $el = $(el);
                retrieveNext = retrieveNext || $el.hasClass('type-light-warning');
                var html = el.cloneNode(true);
                var ret = {
                    html:     html,
                    rendered: false,
                    read:     !$el.hasClass('type-light-warning')
                };
                var tag;
                if (window.wykop && wykop.params && wykop.params.action === 'notifications' && wykop.params.method === 'tags') {
                    tag = [].filter.call($el.find('a'), function (el) {
                        return el.getAttribute('href') && el.getAttribute('href').match(RegExp('/tag/')) && el.textContent.trim();
                    }).map(function (el) {
                        return el && el.textContent.trim();
                    }).pop();
                    tag = (tag || '') || null;
                } else if (window.wykop && wykop.params && wykop.params.action === 'notifications' && wykop.params.method === 'channels') {
                    tag = ($el.text().match(/[napisał|napisała] w kanale (.*) wpis /) || [])[1] || null;
                    if (tag) {
                        tag = tag.split(' ')[0] || null;
                    }
                }
                ret.tag = tag;
                return ret;
            }).forEach(state.add.bind(state));
        }


        var nextUrl = $('a:contains("następna")', $('div.pager', doc)).attr('href');
        if (retrieveNext) {
            $.ajax({
                url:      nextUrl,
                dataType: 'html',
                success:  function (data) {
                    data = $(data);
                    extractNotifications(data);

                }
            });
            state.loading = true;
        }
        retrievedPages++;
        state.render(doc === window.document);
        return false;
    }

    $('.bspace > ul').first().prepend(
        $('<li />').append(
            $('<a href="#"/>').text('sortuj').click(function () {
                $(this).parent().toggleClass('active', true);
            }).one('click', extractNotifications.bind(null, document))
        )
    );
    var style = '.ginden-sort-tags-tag:not(.pinned) i.up, .ginden-sort-tags-tag:not(.pinned) i.down { display: none; } \
    .ginden-sort-tags-tag.pinned i.pin { color: red; }\
    i.pin, i.up, i.down { opacity: 0.5; cursor: pointer; }\
    ';
    document.head.appendChild(document.createElement('style')).innerHTML = style;
}


var script = document.createElement("script");
script.textContent = "(" + main.toString() + ")();";
document.body.appendChild(script);
