// ==UserScript==
// @name        Czarnolistuj Mój Wykop (dev)
// @namespace   my_wykop_blacklists_dev
// @include     http://www.wykop.pl/moj/*
// @include     http://www.wykop.pl/tag/*
// @include     http://www.wykop.pl/ustawienia/czarne-listy/
// @include     http://www.wykop.pl/ludzie/*
// @include     http://www.wykop.pl/mikroblog/kanal/*
// @include     http://www.wykop.pl/ustawienia/
// @include     http://www.wykop.pl/mikroblog/*
// @include     http://www.wykop.pl/wpis/*
// @version     1.7.0
// @grant       none
// @downloadURL https://ginden.github.io/wypok_scripts/dev/my_wypok_blacklist.user.js
// @license CC BY-SA 3.0
// ==/UserScript==


function main() {

    var currentDate = (new Date()).toDateString();

    var colorSortOrder = {
        1002: 100, //konto usunięte
        1001: 90, // konto zbanowane
        2001: 80, // sponosorwane
        5:    80, // admin
        2:    70, //bordo
        1:    60, // pomarańcza
        0:    50,
        null: 0
    };
    var getUserColorFromClass = (function(){
        var cache = Object.create(null);
        return function getUserColorFromClass(domClass){
            if (cache[domClass]) {
                return cache[domClass];
            }
            var el = document.createElement('a');
            el.setAttribute('class', domClass);
            document.body.appendChild(el);
            var color = getComputedStyle(el).getPropertyValue('color');
            document.body.removeChild(el);
            cache[domClass] = color;
            return color;
        };
    })()
    

    var pluginSettings = [
        {
            name: 'Włącz ulepszoną czarną listę',
            description: 'Włącza podstawową funkcjonalność dodatku',
            slug: 'ENHANCED_BLACK_LIST',
            type: 'boolean',
            defaultValue: true
        },
        {
            name: 'Sortuj użytkowników na czarnej liście',
            description: 'Sortuje użytkowników wg koloru, a następnie wg nicka',
            slug: 'BLACK_LIST_SORT',
            type: 'boolean',
            defaultValue: true
        },
        {
            name: 'Podświetlaj obserwujących na liście plusujących',
            description: 'Podświetla obserwujących na liście plusujących',
            slug: 'HILIGHT_PLUS',
            type: 'boolean',
            defaultValue: true
        },
        {
            name: 'Podświetlaj obserwujących na liście wykopujących',
            description: 'Podświetla obserwujących na liście wykopujących',
            slug: 'HILIGHT_VOTES',
            type: 'boolean',
            defaultValue: true
        },
        {
            name: 'Zgłaszanie profili w czasie usuwania',
            description: 'Dodaje przycisk zgłoszenia na stronie usuniętego profilu',
            slug: 'REPORT_DELETED_ACCOUNTS',
            type: 'boolean',
            defaultValue: true
        }
    ];
    function createSettingGetter(slug) {
        var lsKey = 'black_list/'+slug;
        var ret = function(){
            var slugs = this._slugs;
            if (slugs[slug].type === 'boolean') {
                var matrix = {'true': true, 'false': false, 'undefined': slugs[slug].defaultValue};
                return matrix[localStorage[lsKey]];
            }
            return localStorage[lsKey] === undefined ? slugs[slug].defaultValue : localStorage[lsKey];
        };
        ret.displayName = 'get setting: '+slug;
        return ret;
    }

    function createSettingSetter(slug) {
        var lsKey = 'black_list/'+slug;
        var ret = function(val){
            var slugs = this._slugs;
            return val === undefined ? (delete localStorage[lsKey], undefined) : localStorage[lsKey] = val;
        }
        ret.displayName = 'set setting: '+slug;
        return ret;
    }

    var settings = {};
            Object.defineProperty(settings, '_slugs', {
                enumerable: true,
                configurable: false,
                writable: false,
                value: {}
            });

    pluginSettings.forEach(function(el) {
            settings._slugs[el.slug] = el;
            Object.defineProperty(settings, el.slug, {
                enumerable: true,
                configurable: false,
                get: createSettingGetter(el.slug),
                set: createSettingSetter(el.slug)
            });
    });


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
                    tags:  tags || []
                });

            }
        });
    }

    function sortUsersLis(a, b) {
        if (a.color === b.color) {
            return ((a.nick+'').toLowerCase() > (''+b.nick).toLowerCase() ? 1 : -1);
        } else {
            return a.color < b.color ? 1 : -1;
        }
    }

    function getBlackList(callback) {
        callback = callback || Function.prototype;
        if (localStorage['black_list/date/'+ currentDate]) {
            var data = JSON.parse(localStorage['black_list/date/' + currentDate]);
            setTimeout(callback.bind(null, data),0);
        }
        else {
            parseBlackList(function (data) {
                Object.keys(localStorage).filter(function (el) {
                    return el.indexOf('black_list/date/') === 0 || el.indexOf('black_list_') === 0;
                }).forEach(function (key) {
                    delete localStorage[key];
                });
                localStorage['black_list/date/' + currentDate] = JSON.stringify(data);
                callback(data);
            });
        }
    }


    function parseWhiteList(callback) {
        $.ajax({
            url:      'http://www.wykop.pl/moj/',
            dataType: 'html',
            success:  function (data) {
                data = $(data);
                var users = [].map.call($('#observedUsers a span', data), function(el){
                    return el.textContent.trim();
                });
                callback({
                    users: users || [],
                    tags:  []
                });
            }
        });
    }

    function getWhiteList(callback) {
        callback = callback || Function.prototype;
        if (localStorage['white_list/date/'+ currentDate]) {
            var data = JSON.parse(localStorage['white_list/date/' + currentDate]);
            setTimeout(callback.bind(null, data),0);
        }
        else {
            parseWhiteList(function (data) {
                Object.keys(localStorage).filter(function (el) {
                    return el.indexOf('white_list/date/') === 0;
                }).forEach(function (key) {
                    delete localStorage[key];
                });
                localStorage['white_list/date/' + currentDate] = JSON.stringify(data);
                callback(data);
            });
        }
    }

    function sortBlackListEntries(entriesContainer) {
        var childs = [].slice.call(entriesContainer.children);
        childs.map(function (el) {
            el.nick = el.textContent.toLowerCase().trim();
            var aColor = el.querySelector('span[class*=color]') || null;
            var rawColor = (aColor && aColor.getAttribute('class').slice('color-'.length)) | 0;
            el.color = colorSortOrder[rawColor] | 0;
            el.prevColor = (localStorage['black_list/user/' + el.nick + '/color'] || el.color) | 0;
            el.prioritize = 0;
            if (el.prevColor !== el.color) {
                el.setAttribute('class', el.getAttribute('class') + ' type-light-warning');
            }
            localStorage['black_list/user/' + el.nick + '/color'] = el.color;
            return el;
        }).sort(sortUsersLis).forEach(function (el) {
            entriesContainer.appendChild(el);
        });
    }

    function removeEntries(blackLists) {
        var blockedUsers = new Set(blackLists.users);
        var blockedTags = new Set(blackLists.tags)
        var entries = $('#itemsStream .entry').filter(function (i, el) {
            var $el = $(el);
            var author = $('div[data-type="entry"] .author .showProfileSummary', $el).text().trim();
            var tags = [].map.call($('div[data-type="entry"] .text a.showTagSummary', $el), function(el){return el.textContent.trim();});
            var hasBlackListedTag = blockedUsers.has(author) || blackLists.tags.some(blockedTags.has.bind(blockedTags));
            return hasBlackListedTag;
        }).toggleClass('ginden_black_list', true);
        setSwitch.call($input[0]);
    }


    var $input = $('<input type="checkbox" id="black_list_toggle" name="black_list_toggle" />');
    var $label = $('<label for="black_list_toggle" />');

    function setSwitch() {
        settings.ENHANCED_BLACK_LIST = this.checked;
        $(document.body).toggleClass('black_list_on', this.checked);
        $label.text((this.checked ? 'wyłącz' : String.fromCharCode(160) + 'włącz') + ' #czarnolisto' + (this.checked ? ' (' + document.querySelectorAll('.ginden_black_list').length + ' zablokowanych)' : ''));
    }

    $input.change(setSwitch);
    $input.prop('checked', settings.ENHANCED_BLACK_LIST);
    setSwitch.call($input[0]);
    var style = document.createElement('style');
    style.innerHTML = ['body.black_list_on .ginden_black_list {display: none; }',
                       '#black_list_toggle {display: none}',
                       '#black_list_toggle_cont {padding: 10px;}'
    ].join('\n');


    document.head.appendChild(style);
    if (window.wykop && window.wykop.params) {
        if (wykop.params.action === 'mywykop') {
            $('.bspace ul').last().append($('<li id="black_list_toggle_cont">').append($input, $label));
            getBlackList(removeEntries);
        } else if (wykop.params.action === 'tag') {
            getBlackList(removeEntries);
            $('.fix-b-border > ul').last().append(
                $('<li id="black_list_toggle_cont">').append($input, $label)
            );
        } else if (wykop.params.action === "profile") {
            $('h4.space').last().append(
                $('<span id="black_list_toggle_cont">').append($input, $label)
            );
            getBlackList(removeEntries);
        } else if (wykop.params.action === 'stream' && wykop.params.method === 'index' && location.pathname.indexOf('/mikroblog/kanal/') === 0) {
            $('.bspace ul').last().append($('<li id="black_list_toggle_cont">').append($input, $label));
            getBlackList(removeEntries);
        } else if (settings.BLACK_LIST_SORT && wykop.params.action === "settings" && wykop.params.method === "blacklists") {
            var entriesContainer = document.querySelector('div.space[data-type="users"]');
            sortBlackListEntries(entriesContainer);

        } else if (settings.REPORT_DELETED_ACCOUNTS && wykop.params.action === 'error' && wykop.params.method === '404' && location.pathname.match(/\/ludzie\/.*\//)) {
            var user = (location.pathname.match(/\/ludzie\/(.*)\//) || [])[1];
            $('h4.bspace + p > a.button').after(
                $('<span class="dC" data-type="profile" data-id="'+user+'" />').append(
                    $('<a class="btnNotify button"><i class="fa fa-flag"></i></a>')
                )
            );
        } else if (wykop.params.action === "settings" && wykop.params.method === "index") {
            var $fieldset = $('<fieldset />');
            var $settings = $('<div class="space" />');
            var $header = $('<h4 />').text('Czarnolistuj Mój Wypok');
            $fieldset.append($header, $settings);
            pluginSettings.forEach(function(setting){
                var $settingContainer = $('<div class="row" />');
                var $p = $('<p/>');
                var id = 'my_wykop_black_list_'+setting.slug;
                var $input = $('<span />').text('invalid setting:'+ JSON.stringify(setting,null,1));
                var $label = $('<span />').text('invalid setting:'+ JSON.stringify(setting,null,1));
                if (setting.type === 'boolean') {
                    $input = $('<input />');
                    $input
                        .addClass('chk-box')
                        .attr('type', 'checkbox')
                        .attr('id', id)
                        .prop('checked', settings[setting.slug])
                        .change(function() {
                            settings[setting.slug] = this.checked;
                        });
                    var $label = $('<label />');
                    $label
                        .addClass('inline')
                        .attr('for', id)
                        .attr('title', setting.description || '')
                        .text(setting.name);
                } 
                $p.append($input, $label);
             //   console.log($p.html(), $input.html(), $label.html())
                $settingContainer.append($p);
                $settings.append($settingContainer);
            });
            $('form.settings').prepend($fieldset);
        } else if (settings.HILIGHT_VOTES && document.querySelector('div[data-type="entry"]')) {

            function removeVoteGray(subtree) {
                getWhiteList(function(data){
                    var users = new Set(data.users);
                    [].forEach.call($(subtree).find('.voters-list a.link.gray'), function(el){
                        if(users.has(el.textContent.trim())) {
                            var $el = $(el);
                            $el.removeClass('gray');
                            $el.addClass('observed_user');
                            $el.attr('class').split(' ').some(function(domClass){
                                if (domClass.indexOf('color-') === 0) {
                                    this.attr('style', 'color: '+getUserColorFromClass(domClass)+' !important');
                                    return true;
                                }

                            }, $el)
                        }
                    });
                });
            }
            removeVoteGray(document.body);
            var mutationObserver = new MutationObserver(removeVoteGray.bind(null, document.body));
            mutationObserver.observe(document.body, {childList: true, subtree: true});
        }
    }
    if (window.wykop) {
        window.wykop.plugins = window.wykop.plugins || {};
        window.wykop.plugins.Ginden = window.wykop.plugins.Ginden || {};
        window.wykop.plugins.Ginden.MojWykopBlackList = {
            setSwitch:      function (state) {
                $input.prop('checked', !!state);
            },
            parseBlackList: parseBlackList,
            getBlackList:   getBlackList,
            removeEntries:  removeEntries,
            getWhiteList:   getWhiteList,
            flushBlackListCache: function(){
                var entries = Object.keys(localStorage).filter(function (el) {
                    return el.indexOf('black_list/date/') === 0 || el.indexOf('black_list_') === 0;
                });
                entries.forEach(function (key) {
                    delete localStorage[key];
                });
                console.log('Removed '+entries.length+' black list cache entries');
            },
            settings: settings,
            _lines: ['//empty line'].concat(main.toString().split('\n'))
        };
    }
}


var script = document.createElement("script");
script.textContent = "(" + main.toString() + ")();";
document.body.appendChild(script);
