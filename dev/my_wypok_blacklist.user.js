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
// @version     5.6.1
// @grant       GM_info
// @downloadURL https://ginden.github.io/wypok_scripts/dev/my_wypok_blacklist.user.js
// @license     MIT
// ==/UserScript==

/*
 Współautorzy:
 - kondominium-rosyjsko-niemieckie napisał wycinanie komentarzy kancerogennych użytkowników
 - megawatt za blokowanie przypadkowego zamknięcia karty
 */


function main() {
    "use strict";
    var $ = window.jQuery || window.$;
    var currentScriptVersion = '###';
    var trackingKey = 'black_list/tracking_' + currentScriptVersion + '_' + (new Date()).getMonth() + '_' + (new Date()).getFullYear();
    var hash = '';

    function isSuperUser() {
        return +localStorage.debug || location.hash === '#debug' || sessionStorage.debug;
    }
    if (isSuperUser()) {
        window.onerror = function(e){ console.log({Error: e, stack: e.stack}); };
    }
    var onNextFrame = (function () {
        var queue = [];
        var running = false;
        return function onNextFrameInternal(func) {
            var args = [].slice.call(arguments, 1);
            queue.push({
                func: func,
                args: args
            });
            if (running === false) {
                running = true;
                process();
            }
        };
        function process() {
            var endTime = Date.now() + 16;
            var el;
            do {
                el = queue.shift();
                try {
                    el.func.apply(null, el.args);
                } catch (e) {
                    break;
                }
            } while (queue.length && endTime > Date.now());

            if (queue.length === 0) {
                running = false;
            } else {
                requestAnimationFrame(process);
            }
        }
    }());

    var shortenedReasons = {
        'Propagowanie nienawiści lub przemocy, treści drastyczne': 'nienawiść, przemoc',
        'To jest multikonto': 'multikonto',
        'Treści o charakterze pornograficznym': 'porno',
        'Atakuje mnie lub narusza moje dobra osobiste': 'atakuje mnie',
        'Nieprawidłowe tagi': 'tagi'
    };

    function getTimeBasedUniqueString() {
        var base = (new Date()).toLocaleDateString();
        var everyHours = +(/\d*/.exec(settings.CACHE_REFRESH_TIME)); // wyciąga cyfry, wspieramy tylko liczby godzin.
        return base + '-' + everyHours + '-' + Math.floor((new Date).getHours() / everyHours); // 0 zostaje
                                                                                               // potraktowane jak 24h,
                                                                                               //  25 i więcej też
    }

    function Lock(name) {
        this.name = name;
        this.slug = '***' + this.name + '***';
        return this;
    }

    Lock.prototype.aquire = function (maxSeconds) {
        this.from = (this.state = Math.floor(Date.now() / 1000) + maxSeconds);
    };
    Lock.prototype.release = function () {
        if (this.state <= this.from) {
            this.state = null;
        }
    };
    Lock.prototype.check = function () {
        return (Number(this.state) || 0) < Math.floor(Date.now() / 1000);
    };

    Object.defineProperty(Lock.prototype, 'state', {
        get: function () {
            return localStorage[this.slug];
        },
        set: function (val) {
            if (val == undefined) {
                delete localStorage[this.slug];
            } else {
                localStorage[this.slug] = val;
                return localStorage[this.slug];
            }
        }
    });

    function getTrackingData(cb) {
        cb = cb || alert.bind(window);
        var message = ['@Ginden'];
        var table = {
            'Wersja skryptu':                        currentScriptVersion,
            'OS/CPU':                                navigator.oscpu || 'undefined',
            'Browser':                               navigator.userAgent,
            'Język':                                 navigator.language,
            'Czas':                                  formatDate('YYYY-MM-DD hh:mm:ss', new Date()),
            'Tryb nocny':                            !!(wykop.params.settings.night_mode),
            'Zablokowana polityka':                  !(wykop.params.settings.show_politics),
            'Pozwala zablokowanym pisać':            wykop.params.settings.allow_blacklisted,
            'Dostaje powiadomienia z czarnej listy': wykop.params.settings.blacklist_notifications
        };
        var features = {
            Set:                   'return new Set();',
            Map:                   'return new Map()',
            WeakMap:               'return new WeakMap();',
            WeakSet:               'return new WeakSet();',
            Promise:               'return new Promise(function(){});',
            'basic destructuring': 'var {a,b} = {a: 1, b:1}',
            'let':                 'let a = 3; return a;',
            'backquote':           'return `wow`;',
            'arrow-functions':     'return a=>(a+1);',
            'generators':          'return function*(){yield 3;}',
            Reflect:               'return typeof Reflect !== "undefined"',
            Symbol:                'return typeof Symbol !== "undefined"',
            'Symbol.iterator':     'return typeof Symbol.iterator !== "undefined"',
            'rest arguments':      'return function(...a){return a;};'

        };
        pluginSettings.filter(function (setting) {
            return setting.type !== 'button';
        }).forEach(function (setting) {
            table[setting.name + ' (' + setting.slug + ')'] = settings[setting.slug] || null;
        });
        var supportedFeatures = [];
        var unsupportedFeatures = [];
        Object.keys(features).map(function (feature) {
            var code = features[feature];
            var val = false;
            try {
                val = Function(code)();
            } catch (e) {
                val = false;
            }
            if (val) {
                supportedFeatures.push(feature);
            } else {
                unsupportedFeatures.push(feature);
            }
        });
        table['Supported browser features'] = supportedFeatures.sort().join(', ') || undefined;
        table['Unsupported browser features'] = unsupportedFeatures.sort().join(', ') || undefined;

        getBlackList(function (blackData) {
            getWhiteList(function (whiteData) {
                table['Zablokowane nsfw'] = blackData.tags.indexOf('#nsfw') !== -1;
                table['Zablokowany islam'] = blackData.tags.indexOf('#islam') !== -1;
                table['Zablokowany randomanimeshit'] = blackData.tags.indexOf('#randomanimeshit') !== -1;

                table['Liczba osób na czarnej liście'] = blackData.users.length;
                table['Liczba tagów na czarnej liście'] = blackData.tags.length;
                table['Liczba domen na czarnej liście'] = blackData.domains.length;
                table['Liczba obserwowanych użytkowników'] = whiteData.users.length;
                message.push.apply(message, Object.keys(table).map(function (key) {
                    var val = table[key];
                    key = key.replace(/_/g, '\\_');
                    if (Array.isArray(val)) {
                        val = JSON.stringify(val);
                    }
                    val = ((val === null || typeof val === 'undefined') ? 'null' : val);
                    val += '';
                    val = val.replace(/_/g, '\\_');
                    return key + ': ' + val;
                }));
                cb(message.join('\n'));
            });
        });
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
            name:         'Pozwalaj na zbieranie danych o systemie operacyjnym, przeglądarce, wersji dodatku i rozmiarach czarnej listy',
            slug:         'ALLOW_TRACKING',
            type:         'boolean',
            defaultValue: false
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
            name:         'Blokuj przypadkowe usunięcie treści',
            description:  'Blokuj przypadkowe usunięcie treści',
            slug:         'PREVENT_ACCIDENTAL_REMOVE',
            type:         'boolean',
            defaultValue: true
        },
        {
            name:         'Pokazuj powiadomienia z informacjami o aktualizacji',
            description:  '',
            slug:         'SHOW_CHANGELOG',
            type:         'boolean',
            defaultValue: true
        },
        {
            name:         'Pokazuj boksy z informacjami o wymoderowanych',
            description:  'dd',
            slug:         'SHOW_REPORT_BOXES',
            type:         'boolean',
            defaultValue: true
        },
        {
            name:         'Styl blokady',
            description:  'Zmienia styl przycisku blokady',
            slug:         'BLOCK_BUTTON_STYLE',
            type:         'select',
            defaultValue: 'ikona kłódki',
            values:       ['tekst', 'ikona kłódki']
        },
        {
            name:         'Częstość odświeżania cache',
            description:  'Zmienia częstość odświeżania cache. Po zmienie dotychczasowe cache jest inwalidowane.',
            slug:         'CACHE_REFRESH_TIME',
            type:         'select',
            defaultValue: '24h',
            values:       ['24h', '12h', '6h', '4h', '2h', '1h']
        },
        {
            name:  'Obejrzyj ustawienia',
            slug:  'DEBUG_SHOW_SETTINGS',
            type:  'button',
            debug: true,
            click: function (e) {
                var json = {};
                pluginSettings.forEach(function (setting) {
                    json[setting.slug] = settings[setting.slug] || null;
                });
                alert(JSON.stringify(json, null, 2));
                e.stopPropagation();
                e.preventDefault();
                return false;
            }
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
            name:        'Pokaż dane, które można wysłać',
            description: 'Pokazuje listę ustawień',
            slug:        'SHOW_TRACK_DATA',
            type:        'button',
            click:       function (e) {
                getTrackingData();
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
    var HIGHLIGHT_CLASS = 'type-light-warning'; // Słabo widoczne na nocnym, co robić?
    var slice = Function.prototype.call.bind([].slice);
    var map = Function.prototype.call.bind([].map);
    var forEach = Function.prototype.call.bind([].forEach);
    var trim = Function.prototype.call.bind(''.trim);

    function getTrimmedText(el) {
        return el.jquery ? el.text().trim() : el.textContent.trim();
    }

    function timeAgo(timeInPast, timeNow) {
        timeInPast = new Date(timeInPast);
        timeNow = timeNow ? new Date(timeNow) : new Date();
        var timeDiff = Math.floor((timeNow - timeInPast)/1000);
        if (timeDiff < 60) {
            return timeDiff + ' sek.';
        } else if (timeDiff < 60*60) {
            return Math.floor(timeDiff/60)+' min.';
        } else if (timeDiff < 24*60*60) {
            return Math.floor(timeDiff/(60*60)) +' godz.';
        } else if (timeDiff < 30*24*60*60) {
            return Math.floor(timeDiff/(24*60*60)) +' dni';
        } else {
            return Math.floor(timeDiff/(30*24*60*60)) +' mies.';
        }
    }



    var getUserColorFromClass = (function () {
        // cache, jako że obliczanie wartości jest dość kosztowne (trzeba wstawić do drzewa DOM, robić repaint, usuwać,
        // kolejny repaint).
        var cache = Object.create(null);
        return function getUserColorFromClass(domClass) {
            var el, color;
            if (cache[domClass]) {
                return cache[domClass];
            }
            el = document.createElement('a');
            el.setAttribute('class', domClass);
            document.body.appendChild(el);
            color = getComputedStyle(el).getPropertyValue('color');
            document.body.removeChild(el);
            cache[domClass] = color;
            return color;
        };
    })();

    function highlightDigs(subtree) {
        getWhiteList(function (data) {
            var users = new Set(data.users);
            forEach(subtree.querySelectorAll('.usercard a'), function (el) {
                if (users.has(el.getAttribute('title'))) {
                    $(el.parentNode).addClass(HIGHLIGHT_CLASS);
                }
            });
        });
    }

    function highlightComments(data) {
        var users = new Set(data.users);
        var comments = document.querySelectorAll('div[data-type=comment]');
        var cancerUsers = new Set(settings.CANCER_USERS); // lista cancerów


        onNextFrame(function next(i) {
            var el = comments[i], $el, author;
            if (!el) {
                return;
            }
            $el = $(el);
            author = getTrimmedText($el.find('a.showProfileSummary b'));
            if (users.has(author)) {
                $el.addClass(HIGHLIGHT_CLASS);
            } else if (cancerUsers.has(author)) {
                $el.addClass('deleted');
            }
            onNextFrame(next, i + 1);
        }, 0);
    }

    function removeUserFromCancerList(e) {
        var nick = $(this).parent('li').children('a').text().trim();
        settings.CANCER_USERS = (settings.CANCER_USERS || []).filter(onlyUnique, {})
            .filter(Boolean).filter(function (el) {
                return el !== nick;
            });
        console.log('Removed user ' + nick);
        onNextFrame(listCancerUsers);
        e.preventDefault();
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
            return el.indexOf('black_list/date/') === 0;
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
                    console.log('Returning setting ' + slug + ' to default value');
                    if (slug !== 'ALLOW_TRACKING') {
                        delete localStorage[lsKey];
                    }
                    return undefined;
                } else {
                    localStorage[lsKey] = JSON.stringify(val);
                    return localStorage[lsKey];
                }
            }
            if (val === undefined) {
                delete localStorage[lsKey];
                return undefined;
            } else {
                return localStorage[lsKey] = val;
            }
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

    function formatDate(format, date) {
        var year = ['0000', date.getFullYear()].join('').slice(-4);
        var month = ['0000', date.getMonth()+1].join('').slice(-2);
        var day = ['0000', date.getDate()].join('').slice(-2);
        var hour = ['00', date.getHours()].join('').slice(-2);
        var minute = ['00', date.getMinutes()].join('').slice(-2);
        var seconds = ['00', date.getSeconds()].join('').slice(-2);
        return format
            .replace(/YYYY/g, year)
            .replace(/MM/g, month)
            .replace(/DD/g, day)
            .replace(/hh/g, hour)
            .replace(/mm/g, minute)
            .replace(/ss/g, seconds);
    }

    function parseBlackList(callback) {
        $.ajax({
            url:      'http://www.wykop.pl/ustawienia/czarne-listy/',
            dataType: 'html',
            success:  function (data) {
                data = $(data);
                var users = map($('div[data-type="users"] div.usercard a span', data), getTrimmedText).map(trim).filter(Boolean).filter(onlyUnique, {});
                var tags = map($('div[data-type="hashtags"] .tagcard', data), getTrimmedText);
                var domains = map($('div[data-type="domains"] span.tag', data), getTrimmedText);
                onNextFrame(callback, {
                    users:   users || [],
                    tags:    tags || [],
                    domains: domains || []
                });
            }
        });
    }

    function sortUsersList(a, b) {
        if (a.color === b.color) {
            return naturalSort(a.nick, b.nick);
        } else {
            return a.color < b.color ? 1 : -1;
        }
    }

    function retry(func) {
        var args = [].slice.call(arguments, 1);
        onNextFrame(function () {
            return func(args);
        });
    }


    function getBlackList(callback) {
        var lock = new Lock('black list');
        callback = callback || Function.prototype;
        if (localStorage['black_list/date/' + getTimeBasedUniqueString()]) {
            var data = JSON.parse(localStorage['black_list/date/' + getTimeBasedUniqueString()]);
            data.entries = localStorage['black_list/entries'] ? JSON.parse(localStorage['black_list/entries']) : [];
            onNextFrame(callback, data);
        }
        else {
            if (lock.check()) {
                lock.aquire(3);
            } else {
                retry(getBlackList, callback);
                return;
            }

            parseBlackList(function (data) {
                lock.release();
                Object.keys(localStorage).forEach(function (el) {
                    if (el.indexOf('black_list/date/') === 0) {
                        delete localStorage[el];
                    }
                });
                data.entries = localStorage['black_list/entries'] ? JSON.parse(localStorage['black_list/entries']) : [];
                localStorage['black_list/date/' + getTimeBasedUniqueString()] = JSON.stringify(data);
                onNextFrame(callback, data);
            });
        }
    }

    function getModerated(callback) {
        var lock = new Lock('moderated');
        callback = callback || Function.prototype;
        if (lock.check()) {
            lock.aquire(3);
        } else {
            retry(getModerated, callback);
            return;
        }
        $.ajax({
            url:      'http://www.wykop.pl/naruszenia/moderated/',
            dataType: 'html',
            success:  function (data) {
                data = $(data);
                var reports = $('#violationsList tbody tr', data);
                var entries = [].map.call(reports, function(row,i) {
                    var $row = $(row);
                    var url = $row.find('.author a time').parents('a').attr('href');
                    var moderationDate = $($row.find('td')[1]).find('time').attr('datetime');
                    var reason = $($row.find('td')[1]).find('p').text().trim();
                    return {
                        moderationDate: new Date(moderationDate),
                        url: url,
                        reason: reason
                    };
                });
                callback(entries);
            }
        });
    }

    function getReports(callback) {
        var lock = new Lock('reports');
        callback = callback || Function.prototype;
        if (lock.check()) {
            lock.aquire(3);
        } else {
            retry(getReports, callback);
            return;
        }
        $.ajax({
            url:      'http://www.wykop.pl/naruszenia/moje/',
            dataType: 'html',
            success:  function (data) {
                data = $(data);
                var reports = $('#violationsList tbody tr', data);
                var entries = [];
                [].forEach.call(reports, function(row,i) {
                    var $row = $(row);
                    var stateHtml = $row.children().first().html();
                    var solvedState = stateHtml.match('waiting') ? null : (stateHtml.match('accepted') ? true : false);
                    // Ugly, to be fixed later
                    var reportID = $row.children()[2].textContent.split('\n').map(trim).join('').slice(0,5).trim().replace(':','');
                    var reason = $($row.children()[2]).find('span').text().trim();
                    var solvedDate = solvedState === null ? null : new Date($($row.children()[3]).find('time').attr('datetime'));
                    var firstSeen;
                    localStorage['black_list/report/'+reportID] = localStorage['black_list/report/'+reportID] || new Date();
                    firstSeen = new Date(localStorage['black_list/report/'+reportID]);
                    entries.push({
                        solved: solvedState,
                        reportID: reportID,
                        reason: shortenedReasons[reason] || reason,
                        solvedDate: solvedDate,
                        firstSeen: firstSeen,
                        i: i
                    });
                });
                callback(entries);
            }
        });


    }

    function removeVoteGray(subtree) {
        getWhiteList(function (data) {
            var users = new Set(data.users);
            forEach($(subtree).find('.voters-list a.gray'), function (voter) {
                var voterNick = getTrimmedText(voter);
                if (users.has(voterNick)) {
                    var $voter = $(voter);
                    $voter.removeClass('gray');
                    $voter.addClass('observed_user');
                    $voter.attr('class').split(' ').some(function (domClass) {
                        if (domClass.indexOf('color-') === 0) {
                            this.attr('style', 'color: ' + getUserColorFromClass(domClass) + ' !important');
                            return true;
                        }
                    }, $voter);
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
                var users = map($('#observedUsers a span', data), getTrimmedText).filter(Boolean).filter(onlyUnique, {});
                var tags = [];
                callback({
                    users: users || [],
                    tags:  tags || [] // TBA
                });
            }
        });
    }

    function getWhiteList(callback) {
        var lock = new Lock('white list');

        callback = callback || Function.prototype;
        if (localStorage['white_list/date/' + getTimeBasedUniqueString()]) {
            var data = JSON.parse(localStorage['white_list/date/' + getTimeBasedUniqueString()]);
            onNextFrame(callback, data);
        }
        else {
            if (lock.check()) {
                lock.aquire(3);
            } else {
                retry(getWhiteList, callback);
                return;
            }
            parseWhiteList(function (data) {
                flushWhiteListCache(noop);
                localStorage['white_list/date/' + getTimeBasedUniqueString()] = JSON.stringify(data);
                onNextFrame(callback, data);
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
            el.nick = getTrimmedText(el).toLowerCase();
            var aColor = el.querySelector('span[class*=color]') || null;
            var rawColor = (aColor && aColor.getAttribute('class').slice('color-'.length)) | 0;
            el.color = colorSortOrder[rawColor] | 0;
            el.prevColor = (localStorage['black_list/user/' + el.nick + '/color'] || el.color) | 0;
            el.prioritize = 0;
            if (el.prevColor !== el.color) {
                el.setAttribute('class', el.getAttribute('class') + ' ' + HIGHLIGHT_CLASS);
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
        enumerable:   false,
        configurable: false,
        writable:     false,
        value:        {}
    });

    pluginSettings.forEach(function (el) {
        settings._slugs[el.slug] = el; // Szybki dostęp do list ustawień.
        Object.defineProperty(settings, el.slug, {
            enumerable:   true,
            configurable: false,
            get:          createSettingGetter(el.slug),
            set:          createSettingSetter(el.slug)
        });
    });

    var $input = $('<input type="checkbox" id="black_list_toggle" name="black_list_toggle" />');
    var $label = $('<label for="black_list_toggle" />');
    var blockButtonStyle = settings.BLOCK_BUTTON_STYLE;

    function setSwitch() {
        var that = this;
        settings.ENHANCED_BLACK_LIST = that.checked;
        $(document.body).toggleClass('black_list_on', that.checked);
        if (blockButtonStyle === 'tekst') {
            onNextFrame(function () {
                $label.text((that.checked ? 'wyłącz' : String.fromCharCode(160) + 'włącz') + ' #czarnolisto' + (that.checked ? ' (' + document.querySelectorAll('.ginden_black_list').length + ' zablokowanych)' : ''));
            });
        } else if (blockButtonStyle === 'ikona kłódki') {
            onNextFrame(function () {
                if (that.checked) {
                    $label.html('<i class="fa fa-unlock" /> (' + document.querySelectorAll('.ginden_black_list').length + ')');
                } else {
                    $label.html('<i class="fa fa-lock" />');
                }
            });
        }
    }


    $input.change(setSwitch);
    $input.prop('checked', !!settings.ENHANCED_BLACK_LIST);
    setSwitch.call($input[0]);
    var style = document.createElement('style');
    var styleHTML;

    var baseStyleHTML = function(){/*

     body.black_list_on .ginden_black_list {display: none; }
     #black_list_toggle {display: none}
     #black_list_toggle_cont {
     padding: 10px;
     }

     #reports li {
     vertical-align: middle;
     padding-top: 0.1em;
     padding-bottom: 0.1em;
     }

     #reports li:nth-child(2n+1) {
     background-color: rgba(220,220,220,0.2);
     }

     #reports .report-state-icon {
     font-size: 1.2em;
     display: inline-block;
     width: 1em;

     }


     */}.toString();


    styleHTML = baseStyleHTML.slice(baseStyleHTML.indexOf('/*')+2, baseStyleHTML.lastIndexOf('*/'));

    style.innerHTML =   styleHTML;
    var $blackListToggleCont = $('<li id="black_list_toggle_cont">').append($input, $label);

    document.head.appendChild(style);

    if (window.wykop) {
        window.wykop.plugins = window.wykop.plugins || {};
        window.wykop.plugins.Ginden = window.wykop.plugins.Ginden || {};
        window.wykop.plugins.Ginden.MojWykopBlackList = {
            setSwitch:           function (state) {
                $input.prop('checked', !!state);
            },
            dateTimeString:      getTimeBasedUniqueString(),
            parseBlackList:      parseBlackList,
            getBlackList:        getBlackList,
            removeEntries:       removeEntries,
            getWhiteList:        getWhiteList,
            flushBlackListCache: flushBlackListCache,
            flushWhiteListCache: flushWhiteListCache,
            getTrackingData:     getTrackingData,
            trackingKey:         trackingKey,
            settings:            settings,
            _lines:              ['//empty line'].concat(main.toString().split('\n'))
        };
    }

    if (window.wykop && window.wykop.params) {
        var wykopParams = window.wykop.params;
        if (wykopParams.action === 'mywykop') {
            $('.bspace ul').last().append($blackListToggleCont);
            getBlackList(removeEntries);
            if (settings.SHOW_REPORT_BOXES) {
                var $block = $('<div class="r-block">' +
                               '<h4>Zgłoszenia</h4>' +
                               '<div id="reports" class="objectsList" style="max-height: 30em; overflow-y: auto; padding-top: 4px;"><ul></ul>' +
                               '</div>');
                var $ul = $block.find('ul');
                getReports(function (reports) {
                    reports.forEach(function (el) {
                        var $li = $('<li class="report-li"></li>');

                        var elements = [];
                        var icon = el.solved === null ? '⌛' : (el.solved ? '✔' : '✘');
                        var $icon = $('<span class="report-state-icon report-solved-state-' + el.solved + '"></span>').text(icon);
                        elements.push($icon);
                        elements.push(' ');
                        elements.push($('<span class="report-id"></span>').text(el.reportID));
                        elements.push(' (', $('<span class="report-reason"></span>').text(el.reason), ')');
                        if (el.solved !== null) {
                            elements.push('; zamknięto: ');
                            elements.push(
                                $('<time></time>')
                                    .text(timeAgo(el.solvedDate))
                                    .attr('title', formatDate('YYYY-MM-DD hh:mm:ss', new Date(el.solvedDate)))
                            );
                            elements.push(' temu; zgłoszono: przynajmniej ');
                            var firstSeenDisplay = Math.min(el.firstSeen, el.solvedDate);
                            elements.push(
                                $('<time></time>')
                                    .text(timeAgo(firstSeenDisplay))
                                    .attr('title', formatDate('YYYY-MM-DD hh:mm:ss', new Date(firstSeenDisplay)))
                            );
                        }

                        $li.append.apply($li, elements);
                        $ul.append($li);
                    });
                    getModerated(function (moderated) {
                        moderated.forEach(function (el) {
                            var $li = $('<li class="report-li"></li>');
                            var elements = [];
                            var icon = '❗';
                            var $icon = $('<span class="report-state-icon moderated-item"></span>').text(icon);
                            elements.push($icon);
                            elements.push(' wymoderowano ', $('<a></a>').attr('href', el.url).text('twoją treść'), ' z powodu "'+el.reason+'" (');
                            elements.push(
                                $('<time></time>')
                                    .text(timeAgo(el.moderationDate))
                                    .attr('title', formatDate('YYYY-MM-DD hh:mm:ss', new Date(el.moderationDate)))
                            );
                            elements.push(')');

                            $li.append.apply($li, elements);
                            $ul.prepend($li);
                        });
                    });
                });
                $('#tagsConf').parent().before($block)

            }


        } else if (wykopParams.action === 'tag') {
            getBlackList(removeEntries);
            $('.fix-b-border > ul').last().append(
                $blackListToggleCont
            );
        } else if (wykopParams.action === "profile") {
            $blackListToggleCont = $('<span id="black_list_toggle_cont">').append($input, $label);
            $('h4.space').last().append(
                $blackListToggleCont
            );
            getBlackList(removeEntries);
        } else if (wykopParams.action === 'stream' && (wykopParams.method === 'index' || wykopParams.method === 'hot')) {
            $('.bspace ul').last().append($blackListToggleCont);
            getBlackList(removeEntries);
        } else if (settings.BLACK_LIST_SORT && wykopParams.action === "settings" && wykopParams.method === "blacklists") {
            var entriesContainer = document.querySelector('div.space[data-type="users"]');
            sortBlackListEntries(entriesContainer);

        } else if (settings.REPORT_DELETED_ACCOUNTS && wykopParams.action === 'error' && wykopParams.method === '404' && location.pathname.match(/\/ludzie\/.*\//)) {
            var user = (location.pathname.match(/\/ludzie\/(.*)\//) || [])[1];
            $('h4.bspace + p > a.button').after(
                $('<span class="dC" data-type="profile" data-id="' + user + '" />').append(
                    $('<a class="btnNotify button"><i class="fa fa-flag"></i></a>')
                )
            );
        } else if (wykopParams.action === "settings" && wykopParams.method === "index") {
            var $fieldset = $('<fieldset />');
            var $settings = $('<div class="space" />');
            var $header = $('<h4 />').text('Czarnolistuj Mój Wypok');
            $fieldset.append($header, $settings);
            pluginSettings.forEach(function createSettings(setting) {
                if (setting.debug && !isSuperUser()) {
                    return;
                }
                var $settingContainer = $('<div class="row" />');
                var $p = $('<p/>');
                var id = 'my_wykop_black_list_' + setting.slug;
                var $input = $('<span />').text('invalid setting:' + JSON.stringify(setting, null, 1));
                var $label = $('<span />').text('invalid setting:' + JSON.stringify(setting, null, 1));
                var $extra = [];
                if (setting.type === 'boolean') {
                    $input = $('<input />')
                        .addClass('chk-box')
                        .attr('type', 'checkbox')
                        .attr('id', id)
                        .prop('checked', settings[setting.slug])
                        .change(function () {
                            settings[setting.slug] = this.checked;
                        });
                    $label = $('<label />')
                        .addClass('inline')
                        .attr('for', id)
                        .attr('title', setting.description || '')
                        .text(setting.name);
                } else if (setting.type === 'open_list') {
                    var $list = $('<ul />');
                    $input = $('<input id="cancer_user_input" type="text" />');
                    $label = $('<label />').text(setting.description).attr('for', 'cancer_user_input');
                    $input.on('keypress keydown keyup', function (e) {
                        if (e.keyCode == ENTER_KEY_CODE) {
                            e.stopPropagation();
                            e.preventDefault();
                            settings[setting.slug] = (settings[setting.slug] || []).concat(this.value.trim()).filter(onlyUnique, {}).filter(Boolean);
                            this.value = '';
                            onNextFrame(listCancerUsers, $list, setting);

                            return false;
                        }
                    });
                    listCancerUsers($list, setting);
                    $extra = [$list];
                } else if (setting.type === 'button') {
                    $input = $('<button class="submit">').text(setting.name).attr('title', setting.description).click(setting.click);
                    $label = $();
                } else if (setting.type === 'select') {
                    $input = $('<select class="margin5_0" />').attr('id', id).on('change', function () {
                        settings[setting.slug] = $(this).val();
                    });
                    $input.append.apply($input, setting.values.map(function (val) {
                        var ret = $('<option />').text(val).val(val);
                        if (val === settings[setting.slug]) {
                            ret.attr('selected', 'selected');
                        }
                        return ret;
                    }));

                    $label = $('<label />')
                        .addClass('inline')
                        .attr('for', id)
                        .attr('title', setting.description || '')
                        .text(setting.name);
                    $settingContainer.append.apply($settingContainer, [$label, $input].concat(slice($extra)));
                    $settings.append($settingContainer);
                    return;
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
            var mutationObserver = new MutationObserver(highlightDigs.bind(null, document.querySelector('#votesContainer')));
            mutationObserver.observe(document.querySelector('#votesContainer'), {childList: true, subtree: true});
            highlightDigs(document.querySelector('#votesContainer'));
        }
        if (settings.HILIGHT_COMMENTS && wykop.params.action === 'link') {
            getWhiteList(highlightComments);
        }
        if (settings.PREVENT_ACCIDENTAL_REMOVE && typeof WeakMap === 'function') {
            var firstValues = new WeakMap();
            window.onbeforeunload = function (e) {
                function isModified(el) {
                    var savedValue = firstValues.get(el);
                    if (savedValue === undefined || el.value === '') {
                        return false;
                    } else {
                        return el.value !== savedValue;
                    }
                }

                if ([].some.call(document.querySelectorAll('textarea'), isModified)) {
                    e.returnValue = 'yeah';
                    return 'Are you sure';
                }
            };
            var handleEvent = function handleEvent(e) {
                if (firstValues.get(this) === undefined) {
                    firstValues.set(this, this.value);
                }
            };
            $(document.body).on("click focus select", "textarea", handleEvent);
            [].forEach.call(document.querySelectorAll('textarea'), function (el) {
                handleEvent.call(el);
            });
        }


        if (settings.CANCER_USERS.length > 0) {
            document.addEventListener('click', function (e) {
                var target = e.originalTarget;
                if (target.tagName === 'A' && target.getAttribute('class') === 'unhide') {
                    var $el = $(target);
                    var author = getTrimmedText($el.parents('[data-type]').find('.author.ellipsis a b'));
                    if (settings.CANCER_USERS.indexOf(author) !== -1) {
                        alert('Rozwijanie komentarzy użytkownika ' + author + ' jest zablokowane; Zajrzyj do ustawień by na to pozwolić.');
                        e.stopPropagation();
                        e.preventDefault();
                        return false;
                    }
                    return true;
                }
            }, true);
        }

        if (blockButtonStyle === 'ikona kłódki') {
            $label.addClass('button');
        }

        if (!localStorage[trackingKey] && !settings.ALLOW_TRACKING && (localStorage['black_list/ALLOW_TRACKING'] + '') === 'undefined') {

            var val = confirm('Czy zgadzasz się na zbieranie danych o Twoim systemie,' +
                              'przeglądarce, używanych ustawieniach, rozmiarach czarnej listy?\ ' +
                              'Możesz to w każdej chwili zmienić w ustawieniach.' +
                              'Zbierane dane możesz też podejrzeć tamże.');
            settings.ALLOW_TRACKING = !!val;
        }
        if (settings.ALLOW_TRACKING) {

            if (!localStorage[trackingKey]) {
                var entryId = 14431827;
                var commentEntry = function commentEntry(message, entryId) {
                    return $.ajax({
                        url:     'http://www.wykop.pl/ajax2/wpis/CommentAdd/' +
                                 entryId + '/hash/' + wykop.params.hash + '/',
                        type:    'POST',
                        data:    {
                            '__token': wykop.params.hash,
                            'body':    message
                        },
                        success: function () {

                        }
                    });
                };
                getTrackingData(function (message) {
                    if (!localStorage[trackingKey]) {
                        commentEntry(message, entryId);
                        localStorage[trackingKey] = Date();
                    }
                });
            }
        }
    }

}


var script = document.createElement("script");
var scriptVersion = typeof GM_info !== 'undefined' ? GM_info.script.version : '5.5';

script.textContent = "try { (" + main.toString().replace('###', scriptVersion) + ")(); } catch(e) {console.error(e); throw e;}";
document.body.appendChild(script);
