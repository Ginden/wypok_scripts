// ==UserScript==
// @name        Powiadomienia wg tagów
// @namespace   sort_notifications
// @include     http://www.wykop.pl/powiadomienia/tagi/*
// @version     1
// @grant       none
// @downloadURL https://ginden.github.io/wypok_scripts/powiadomienia_wg_tagow.user.js
// ==/UserScript==

function main() {

    if (window.wykop) {
        window.wykop.plugins = window.wykop.plugins || {};
        window.wykop.plugins.Ginden = window.wykop.plugins.Ginden || {};
        window.wykop.plugins.Ginden.SortNotifications = {};
    }
    function dbSortOrder(tag) {
        return localStorage[sort_tags_prefix + tag] ? Number(localStorage[sort_tags_prefix + a]) : undefined;
    }

    var sort_tags_prefix = 'GINDEN_SORT_TAGS_#';
    var state = window.wykop.plugins.Ginden.SortNotifications.x = {
        list: [],
        tags: {},
                 get sortedTags() {

                     var tagArray = [];
                     Object.keys(this.tags).forEach(function (key) {
                         tagArray.push(key);
                     });

                     return tagArray.sort(function (a, b) {
                         if (dbSortOrder(a) === dbSortOrder(b)) {
                             return a.toLowerCase() > b.toLowerCase();
                         } else if (dbSortOrder(a) !== undefined && dbSortOrder(b) === undefined) {
                             return 1;
                         } else if (dbSortOrder(a) === undefined && dbSortOrder(b) !== undefined) {
                             return -1;
                         } else {
                             return dbSortOrder(a) > dbSortOrder(b) ? 1 : -1;
                         }
                     }).map(function (key) {
                         return this.tags[key]
                     }, this);
                 },
        add:     function (el) {
            console.log(el);
            this.list.push(el);
            this.tags[el.tag] = this.tags[el.tag] || {
                html:     $('<li  class="annotation space ginden-sort-tags-tag"><h3 class="clear-bottom">#' + el.tag + '</h3></li>')[0],
                tag:      el.tag,
                elements: []
            };
            this.tags[el.tag].elements.push(el);
        },
        render:  function (firstTime) {
            var $panel = $('ul.notification');
            console.log('rendering');
            if (firstTime) {
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
            $panel.find('#ginden-sort-tags-loading h4').text(this.loading ? 'ładowanie' : 'pobrano');
            $panel.find('li').not(':eq(0)');
            console.log(html);
            $panel.append.apply($panel, html.map(function (el) {
                return el.html;
            }));
        },
        loading: true
    };

    function extractNotifications(doc) {
        state.loading = false;
        var $panel = $('ul.notification', doc);
        var $list = $panel.find('li.type-light-warning');
        [].map.call($list, function (el) {
            var $el = $(el);
            var html = el.cloneNode(true);
            var ret = {
                html:     html,
                rendered: false
            };
            var tag = [].filter.call($el.find('a'), function (el) {
                return el.getAttribute('href') && el.getAttribute('href').match(RegExp('/tag/')) && el.textContent.trim();
            }).map(function (el) {
                return el && el.textContent.trim();
            }).pop();
            ret.tag = (tag || '').slice(1) || null;

            return ret;
        }).forEach(state.add.bind(state));


        var nextUrl = $('a:contains("następna")', $('div.pager', doc)).attr('href');
        if ($list.length) {
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
        state.render(doc === window.document);
        return false;
    }

    $('.bspace > ul').first().prepend(
        $('<li />').append(
            $('<a href="#"/>').text('sortuj').click(extractNotifications.bind(null, document))
        )
    );


}


var script = document.createElement("script");
script.textContent = "(" + main.toString() + ")();";
document.body.appendChild(script);
