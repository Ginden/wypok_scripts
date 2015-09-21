// ==UserScript==
// @name        Czarnolistuj Mój Wykop (dev)
// @namespace   my_wykop_blacklists_dev
// @include     http://www.wykop.pl/moj/*
// @include     http://www.wykop.pl/tag/*
// @include     http://www.wykop.pl/ustawienia/czarne-listy/
// @include     http://www.wykop.pl/ludzie/*
// @include     http://www.wykop.pl/mikroblog/*
// @include     http://www.wykop.pl/ustawienia/
// @include     http://www.wykop.pl/mikroblog/*
// @include     http://www.wykop.pl/wpis/*
// @include     http://www.wykop.pl/link/*
// @version     3.0.0
// @grant       none
// @downloadURL https://ginden.github.io/wypok_scripts/dev/my_wypok_blacklist.user.js
// @license CC  MIT
// ==/UserScript==


function main() {
    "use strict";
    var $ = window.jQuery || window.$;
    function getPerDayUniqueString() {
        return (new Date()).toDateString();
    }

    function noop() {
    }

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

    var pluginSettings = [
        {
            name:         'Włącz ulepszoną czarną listę',
            description:  'Włącza podstawową funkcjonalność dodatku',
            slug:         'ENHANCED_BLACK_LIST',
            type:         'boolean',
            defaultValue: true
        },
        {
            name:         'Sortuj użytkowników na czarnej liście',
            description:  'Sortuje użytkowników wg koloru, a następnie wg nicka',
            slug:         'BLACK_LIST_SORT',
            type:         'boolean',
            defaultValue: true
        },
        {
            name:         'Podświetlaj obserwujących na liście plusujących',
            description:  'Podświetla obserwujących na liście plusujących',
            slug:         'HILIGHT_PLUS',
            type:         'boolean',
            defaultValue: true
        },
        {
            name:         'Podświetlaj obserwujących na liście wykopujących',
            description:  'Podświetla obserwujących na liście wykopujących',
            slug:         'HILIGHT_VOTES',
            type:         'boolean',
            defaultValue: true
        },
        {
            name:         'Zgłaszanie profili w czasie usuwania',
            description:  'Dodaje przycisk zgłoszenia na stronie usuniętego profilu',
            slug:         'REPORT_DELETED_ACCOUNTS',
            type:         'boolean',
            defaultValue: true
        },
        {
            name:         'Podświetlaj komentarze obserwowanych',
            description:  'Podświetlanie komentarzy obserwowanych',
            slug:         'HILIGHT_COMMENTS',
            type:         'boolean',
            defaultValue: false
        },
        {
            name:        'Wyczyść listę ukrytych wpisów',
            description: 'Czyści listę usuniętych wpisów',
            slug:        'CLEAR_HIDDEN_ENTRIES',
            type:        'button',
            click:       clearHiddenEntries
        },
        {
            name:        'Wyczyść cache',
            description: 'Czyści cache czarnej i białej listy, domyślnie co 24h',
            slug:        'CLEAR_CACHE',
            type:        'button',
            click:       function (e) {
                var a = [];
                flushBlackListCache([].push.bind(a));
                flushWhiteListCache([].push.bind(a));
                alert('Cache wyczyszczone. Wiadomości: \n' + a.join('\n'));
                e.stopPropagation();
                e.preventDefault();
                return false;
            }
        },
        {
            name:         'Rakotwórczy użytkownicy:',
            description:  'Blokuje rozwijanie wpisów autorstwa rakotwórczych użytkowników',
            slug:         'CANCER_USERS',
            type:         'open_list',
            defaultValue: []
        }
    ];


    var ENTER_KEY_CODE = 13;
    var slice = Function.prototype.call.bind([].slice);
    var map = Function.prototype.call.bind([].map);
    var forEach = Function.prototype.call.bind([].forEach);
    var trim = Function.prototype.call.bind(''.trim);
    var getTrimedText = function (el) {
        return el.jquery ? el.text().trim() : el.textContent.trim();
    };
    var getUserColorFromClass = (function () {
        var cache = Object.create(null);
        return function getUserColorFromClass(domClass) {
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
    })();

    function hilightDigs(subtree) {
        getWhiteList(function (data) {
            var users = new Set(data.users);
            forEach(subtree.querySelectorAll('.usercard a'), function (el) {
                if (users.has(el.getAttribute('title'))) {
                    $(el.parentNode).addClass('type-light-warning');
                }
            });
        });
    }

    function hilightComments(data) {
        var users = new Set(data.users);
        var comments = document.querySelectorAll('div[data-type=comment]');
        (function next(i) {
            var el = comments[i];
            if (!el) {
                return;
            }
            var $el = $(el);
            var author = getTrimedText($el.find('a.showProfileSummary b'));
            if (users.has(author)) {
                $el.addClass('type-light-warning');
            }
            (i % 10 === 0) ? setTimeout(next, 0, i + 1) : next(i + 1);
        })(0);
    }

    function removeUserFromCancerList(e) {
        var nick = $(this).parent('li').children('a').text().trim();
        settings.CANCER_USERS = (settings.CANCER_USERS || []).filter(onlyUnique, {})
            .filter(Boolean).filter(function (el) {
                return el !== nick;
            });
        console.log('Removed user ' + nick);
        setTimeout(listCancerUsers, 4);
        return false;
    }

    function listCancerUsers($list, setting) {
        $list.html('');
        settings[setting.slug].filter(Boolean).forEach(function (cancerUser) {
            var $row = $('<li />').append(
                $('<span />').append(
                    $('<i class="fa fa-times" />')
                ).click(removeUserFromCancerList),
                $('<a />').text(cancerUser).attr('href', 'http://wykop.pl/ludzie/' + cancerUser + '/')
            );
            $list.append($row);
        });
    }



    function flushBlackListCache(cb) {
        cb = typeof cb === 'function' ? cb : console.log.bind(console);
        var entries = Object.keys(localStorage).filter(function (el) {
            return el.indexOf('black_list/date/') === 0 || el.indexOf('black_list_') === 0;
        });
        entries.forEach(function (key) {
            delete localStorage[key];
        });
        cb('Removed ' + entries.length + ' black list cache entries');
    }

    function flushWhiteListCache(cb) {
        cb = typeof cb === 'function' ? cb : console.log.bind(console);
        var entries = Object.keys(localStorage).filter(function (el) {
            return el.indexOf('white_list/date/') === 0;
        });
        entries.forEach(function (key) {
            delete localStorage[key];
        });
        cb('Removed ' + entries.length + ' white list cache entries');
    }

    function createSettingGetter(slug) {
        var lsKey = 'black_list/' + slug;
        return function settingGetter() {
            var slugs = this._slugs;
            if (slugs[slug].type === 'boolean') {
                var matrix = {'true': true, 'false': false, 'undefined': slugs[slug].defaultValue};
                return matrix[localStorage[lsKey]];
            } else if (slugs[slug].type === 'open_list' && localStorage[lsKey]) {
                try {
                    return JSON.parse(localStorage[lsKey]);
                } catch (e) {
                    console.error({e: e, content: localStorage[lsKey]});
                    return slugs[slug].defaultValue;
                }
            }
            return localStorage[lsKey] === undefined ? slugs[slug].defaultValue : localStorage[lsKey];
        };
    }

    function createSettingSetter(slug) {
        var lsKey = 'black_list/' + slug;
        return function settingSetter(val) {
            var slugs = this._slugs;
            if (slugs[slug].type === 'open_list') {
                if (val === undefined) {
                    delete localStorage[lsKey];
                    return undefined;
                } else {
                    localStorage[lsKey] = JSON.stringify(val);
                    return localStorage[lsKey];
                }
            }
            return val === undefined ? (delete localStorage[lsKey], undefined) : localStorage[lsKey] = val;
        }

    }

    function onlyUnique(key) {
        return this[key] ? false : (this[key] = true);
    }

    function naturalSort(a, b) {
        a = ('' + a).toLowerCase();
        b = ('' + b).toLowerCase();
        return a === b ? 0 : (a > b ? 1 : -1);
    }


    function parseBlackList(callback) {
        $.ajax({
            url:      'http://www.wykop.pl/ustawienia/czarne-listy/',
            dataType: 'html',
            success:  function (data) {
                data = $(data);
                var users = map($('div[data-type="users"] div.usercard a span', data), getTrimedText).map(trim).filter(Boolean).filter(onlyUnique, {});
                var tags = map($('div[data-type="hashtags"] .tagcard', data), getTrimedText);
                var domains = map($('div[data-type="domains"] span.tag', data), getTrimedText);
                callback({
                    users:   users || [],
                    tags:    tags || [],
                    domains: domains || []
                });
            }
        });
    }

    function sortUsersList(a, b) {
        if (a.color === b.color) {
            return ((a.nick + '').toLowerCase() > ('' + b.nick).toLowerCase() ? 1 : -1);
        } else {
            return a.color < b.color ? 1 : -1;
        }
    }

    function getBlackList(callback) {
        callback = callback || Function.prototype;
        if (localStorage['black_list/date/' + getPerDayUniqueString()]) {
            var data = JSON.parse(localStorage['black_list/date/' + getPerDayUniqueString()]);
            data.entries = localStorage['black_list/entries'] ? JSON.parse(localStorage['black_list/entries']) : [];
            setTimeout(callback.bind(null, data), 0);
        }
        else {
            parseBlackList(function (data) {
                Object.keys(localStorage).forEach(function (el) {
                    if (el.indexOf('black_list/date/') === 0 || el.indexOf('black_list_') === 0) {
                        delete localStorage[el];
                    }
                });
                data.entries = localStorage['black_list/entries'] ? JSON.parse(localStorage['black_list/entries']) : [];
                localStorage['black_list/date/' + getPerDayUniqueString()] = JSON.stringify(data);
                callback(data);
            });
        }
    }

    function removeVoteGray(subtree) {
        getWhiteList(function (data) {
            var users = new Set(data.users);
            forEach($(subtree).find('.voters-list a.gray'), function (el) {
                if (users.has(getTrimedText(el))) {
                    var $el = $(el);
                    $el.removeClass('gray');
                    $el.addClass('observed_user');
                    $el.attr('class').split(' ').some(function (domClass) {
                        if (domClass.indexOf('color-') === 0) {
                            this.attr('style', 'color: ' + getUserColorFromClass(domClass) + ' !important');
                            return true;
                        }
                    }, $el)
                }
            });
        });
    }

    function parseWhiteList(callback) {
        $.ajax({
            url:      'http://www.wykop.pl/moj/',
            dataType: 'html',
            success:  function (data) {
                data = $(data);
                var users = map($('#observedUsers a span', data), getTrimedText).filter(Boolean).filter(onlyUnique, {});
                var tags = [];
                callback({
                    users: users || [],
                    tags:  tags || [] // TBA
                });
            }
        });
    }

    function getWhiteList(callback) {
        callback = callback || Function.prototype;
        if (localStorage['white_list/date/' + getPerDayUniqueString()]) {
            var data = JSON.parse(localStorage['white_list/date/' + getPerDayUniqueString()]);
            setTimeout(callback, 0, data);
        }
        else {
            parseWhiteList(function (data) {
                flushWhiteListCache(noop);
                localStorage['white_list/date/' + getPerDayUniqueString()] = JSON.stringify(data);
                callback(data);
            });
        }
    }

    function clearHiddenEntries() {
        var p = JSON.parse(localStorage['black_list/entries'] || '[]').length;
        localStorage['black_list/entries'] = '[]';
        alert('Usunięto ' + p + ' ukrytych wpisów z bazy');
        return false;
    }

    function sortBlackListEntries(entriesContainer) {
        var childs = slice(entriesContainer.children);
        childs.map(function (el) {
            el.nick = getTrimedText(el).toLowerCase();
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
        }).sort(sortUsersList).forEach(function (el) {
            entriesContainer.appendChild(el);
        });
    }

    function find(arr, func, thisArg) {
        var ret = undefined;
        arr.some(function (el) {
            if (func.apply(thisArg, arguments)) {
                ret = el;
                return true;
            }
            return false;
        });
        return ret;
    }

    function removeEntries(blackLists) {
        var blockedUsers = new Set(blackLists.users);
        var blockedTags = new Set(blackLists.tags);
        var blockedEntries = new Set(blackLists.entries);
        var entries = $('#itemsStream .entry').filter(function (i, el) {
            var $el = $(el);
            var author = $('div[data-type="entry"] .author .showProfileSummary', $el).text().trim();
            var tags = map($('div[data-type="entry"] a.showTagSummary', $el), function (el) {
                return '#' + el.textContent.trim();
            });
            var id = Number($el.attr('data-id'));
            var isBlockedAuthor = blockedUsers.has(author);
            var blockedTag;
            if (isBlockedAuthor) {
                $el.attr('data-black-list-reason', author);
                return true;
            } else if (blockedTag = find(tags, blockedTags.has.bind(blockedTags))) {
                $el.attr('data-black-list-reason', '#' + blockedTag);
                return true;
            } else {
                return false;
            }
        }).toggleClass('ginden_black_list', true);
        forEach(document.querySelectorAll('#itemsStream .entry div[data-type="entry"]'), function (el) {
            var id = Number(el.getAttribute('data-id'));
            var $menu = $(el).find('ul.responsive-menu');
            var $li = $('<li />');
            var $a = $('<a />')
                .addClass('affect hide black-list-entry-hide-switch')
                .attr('data-id', id)
                .attr('href', '#')
                .text(blockedEntries.has(id) ? 'pokazuj' : 'ukryj');
            if (blockedEntries.has(id)) {
                $(el).parent('li.entry').toggleClass('ginden_black_list', true);
            }
            $li.append($a);
            $menu.append($li);
        });
        $("#itemsStream").on("click", "a.black-list-entry-hide-switch", function (e) {
            var $this = $(this);
            var id = Number($this.attr('data-id'));
            var hidden = $(this).text() !== 'ukryj';

            if (localStorage['black_list/entries']) {
                var list = JSON.parse(localStorage['black_list/entries']).filter(onlyUnique, {});
                if (hidden) {
                    list = list.filter(function (el) {
                        return el !== id
                    });
                    $this.text('ukryj');
                } else {
                    list.push(id);
                    $this.text('pokazuj');
                }
                localStorage['black_list/entries'] = JSON.stringify(list);

            } else {
                localStorage['black_list/entries'] = JSON.stringify([id]);
                $this.text('pokazuj');
            }
            $this.parents('div[data-type="entry"]').parent().toggleClass('ginden_black_list', !hidden);
            e.stopPropagation();
            e.preventDefault();
            return false;
        });

        setSwitch.call($input[0]);
    }

    var settings = {};
    Object.defineProperty(settings, '_slugs', {
        enumerable:   true,
        configurable: false,
        writable:     false,
        value:        {}
    });

    pluginSettings.forEach(function (el) {
        settings._slugs[el.slug] = el;
        Object.defineProperty(settings, el.slug, {
            enumerable:   true,
            configurable: false,
            get:          createSettingGetter(el.slug),
            set:          createSettingSetter(el.slug)
        });
    });

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
                       '#black_list_toggle_cont {padding: 10px;}',
                       ''
    ].join('\n');

    var $blackListToggleCont = $('<li id="black_list_toggle_cont">').append($input, $label);

    document.head.appendChild(style);

    if (window.wykop) {
        window.wykop.plugins = window.wykop.plugins || {};
        window.wykop.plugins.Ginden = window.wykop.plugins.Ginden || {};
        window.wykop.plugins.Ginden.MojWykopBlackList = {
            setSwitch:           function (state) {
                $input.prop('checked', !!state);
            },
            parseBlackList:      parseBlackList,
            getBlackList:        getBlackList,
            removeEntries:       removeEntries,
            getWhiteList:        getWhiteList,
            flushBlackListCache: flushBlackListCache,
            flushWhiteListCache: flushWhiteListCache,
            settings:            settings,
            _lines:              ['//empty line'].concat(main.toString().split('\n'))
        };
    }

    if (window.wykop && window.wykop.params) {
        if (wykop.params.action === 'mywykop') {
            $('.bspace ul').last().append($blackListToggleCont);
            getBlackList(removeEntries);
        } else if (wykop.params.action === 'tag') {
            getBlackList(removeEntries);
            $('.fix-b-border > ul').last().append(
                $blackListToggleCont
            );
        } else if (wykop.params.action === "profile") {
            $blackListToggleCont = $('<span id="black_list_toggle_cont">').append($input, $label);
            $('h4.space').last().append(
                $blackListToggleCont
            );
            getBlackList(removeEntries);
        } else if (wykop.params.action === 'stream' && (wykop.params.method === 'index' || wykop.params.method === 'hot')) {
            $('.bspace ul').last().append($blackListToggleCont);
            getBlackList(removeEntries);
        } else if (settings.BLACK_LIST_SORT && wykop.params.action === "settings" && wykop.params.method === "blacklists") {
            var entriesContainer = document.querySelector('div.space[data-type="users"]');
            sortBlackListEntries(entriesContainer);

        } else if (settings.REPORT_DELETED_ACCOUNTS && wykop.params.action === 'error' && wykop.params.method === '404' && location.pathname.match(/\/ludzie\/.*\//)) {
            var user = (location.pathname.match(/\/ludzie\/(.*)\//) || [])[1];
            $('h4.bspace + p > a.button').after(
                $('<span class="dC" data-type="profile" data-id="' + user + '" />').append(
                    $('<a class="btnNotify button"><i class="fa fa-flag"></i></a>')
                )
            );
        } else if (wykop.params.action === "settings" && wykop.params.method === "index") {
            var $fieldset = $('<fieldset />');
            var $settings = $('<div class="space" />');
            var $header = $('<h4 />').text('Czarnolistuj Mój Wypok');
            $fieldset.append($header, $settings);
            pluginSettings.forEach(function (setting) {
                var $settingContainer = $('<div class="row" />');
                var $p = $('<p/>');
                var id = 'my_wykop_black_list_' + setting.slug;
                var $input = $('<span />').text('invalid setting:' + JSON.stringify(setting, null, 1));
                var $label = $('<span />').text('invalid setting:' + JSON.stringify(setting, null, 1));
                var $extra = [];
                if (setting.type === 'boolean') {
                    $input = $('<input />');
                    $input
                        .addClass('chk-box')
                        .attr('type', 'checkbox')
                        .attr('id', id)
                        .prop('checked', settings[setting.slug])
                        .change(function () {
                            settings[setting.slug] = this.checked;
                        });
                    $label = $('<label />');
                    $label
                        .addClass('inline')
                        .attr('for', id)
                        .attr('title', setting.description || '')
                        .text(setting.name);
                } else if (setting.type === 'open_list') {
                    var $list = $('<ul />');
                    $input = $('<input id="cancer_user_input" type="text" />');
                    $label = $('<label />').text(setting.description);
                    $label.attr('for', 'cancer_user_input');
                    $input.on('keypress keydown keyup', function (e) {
                        if (e.keyCode == ENTER_KEY_CODE) {
                            e.stopPropagation();
                            e.preventDefault();
                            settings[setting.slug] = (settings[setting.slug] || []).concat(this.value.trim()).filter(onlyUnique, {}).filter(Boolean);
                            this.value = '';
                            setTimeout(listCancerUsers, 4, $list, setting);

                            return false;
                        }
                    });
                    listCancerUsers($list, setting);
                    $extra = [$list];
                } else if (setting.type === 'button') {
                    $input = $('<button class="submit">').text(setting.name).attr('title', setting.description).click(setting.click);
                    $label = $();
                }
                $p.append.apply($p, [$input, $label].concat(slice($extra)));
                $settingContainer.append($p);
                $settings.append($settingContainer);
            });
            $('form.settings').prepend($fieldset);
        }
        if (document.querySelector('.r-block.channels h4')) {
            var p = document.querySelector('.r-block.channels h4');
            p.innerHTML = '<a href="http://www.wykop.pl/mikroblog/kanaly/">' + p.innerHTML + '</a>';
        }

        if (settings.HILIGHT_PLUS && document.querySelector('div[data-type="entry"]')) {
            var boundRemoveVoteGray = removeVoteGray.bind(null, document.querySelector('#itemsStream'));
            var mutationObserver = new MutationObserver(boundRemoveVoteGray);
            mutationObserver.observe(document.body, {childList: true, subtree: true});
            removeVoteGray(document.body);
        }
        if (settings.HILIGHT_VOTES && wykop.params.action === 'link' && document.querySelector('#votesContainer')) {
            var mutationObserver = new MutationObserver(hilightDigs.bind(null, document.querySelector('#votesContainer')));
            mutationObserver.observe(document.querySelector('#votesContainer'), {childList: true, subtree: true});
            hilightDigs(document.querySelector('#votesContainer'));
        }
        if (settings.HILIGHT_COMMENTS && wykop.params.action === 'link') {
            getWhiteList(hilightComments);
        }
        if (settings.CANCER_USERS.length > 0) {
            document.addEventListener('click', function(e) {
                var target = e.originalTarget;
                if (target.tagName === 'A' && target.getAttribute('class') === 'unhide') {
                    var $el = $(target);
                    var author = getTrimedText($el.parents('[data-type]').find('.author.ellipsis a b'));
                    if (settings.CANCER_USERS.indexOf(author) !== -1) {
                        alert('Rozwijanie komentarzy użytkownika '+author +' jest zablokowane; Zajrzyj do ustawień by na to pozwolić.');
                        e.stopPropagation();
                        e.preventDefault();
                        return false;
                    }
                    return true;
                }
            }, true);
        }
    }

}


var script = document.createElement("script");
script.textContent = "(" + main.toString() + ")();";
document.body.appendChild(script);
