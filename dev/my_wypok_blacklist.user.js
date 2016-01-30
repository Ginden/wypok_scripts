// ==UserScript==
// @name        Czarnolistuj Mój Wykop (dev)
// @namespace   my_wykop_blacklists_dev
// @include     http://www.wykop.pl/moj/*
// @include     http://www.wykop.pl/tag/*
// @include     http://www.wykop.pl/ustawienia/czarne-listy/*
// @include     http://www.wykop.pl/ludzie/*
// @include     http://www.wykop.pl/mikroblog/*
// @include     http://www.wykop.pl/ustawienia/
// @include     http://www.wykop.pl/mikroblog/*
// @include     http://www.wykop.pl/wpis/*
// @include     http://www.wykop.pl/link/*
// @version     7.4.1
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

    if (typeof Object.assign != 'function') {
        (function () {
            Object.assign = function (target) {
                'use strict';
                if (target === undefined || target === null) {
                    throw new TypeError('Cannot convert undefined or null to object');
                }

                var output = Object(target);
                for (var index = 1; index < arguments.length; index++) {
                    var source = arguments[index];
                    if (source !== undefined && source !== null) {
                        for (var nextKey in source) {
                            if (source.hasOwnProperty(nextKey)) {
                                output[nextKey] = source[nextKey];
                            }
                        }
                    }
                }
                return output;
            };
        })();
    }

    if (typeof $ === 'undefined') {
        window.$ = window.jQuery;
    }
    var currentScriptVersion = '###';

    var debugMode = isSuperUser();
    var currentUser = getTrimmedText($('.logged-user a.ellipsis'));
    var ENTER_KEY_CODE = 13;
    var HIGHLIGHT_CLASS = 'type-light-warning'; // Słabo widoczne na nocnym, co robić?
    var BAD_HIGHLIGHT_CLASS = 'bad-highlight';

    function isSuperUser() {
        return window.debug || console.firebug || +localStorage.debug || location.hash === '#debug' || +sessionStorage.debug;
    }

    //region SmartStorage
    function SmartStorage(name, autoDump) {
        if (!this) {
            return new SmartStorage(name, autoDump);
        }
        if (autoDump === undefined) {
            autoDump = true;
        }
        this.name = name;
        this.dumpPending = false;
        this._storage = null;
        this.autoDump = autoDump;
    }

    SmartStorage.prototype.get = function get(key, defaultValue) {
        if (!this._storage) {
            this.load();
        }
        return Object.prototype.hasOwnProperty.call(this._storage, key) ? this._storage[key] : defaultValue;
    };
    SmartStorage.prototype.set = function set(key, value) {
        if (!this._storage) {
            this.load();
        }
        this._storage[key] = value;
        return this;
    };
    SmartStorage.prototype.scheduleDump = function scheduleDump() {
        if (this.autoDump && !this.dumpPending) {
            this.dumpPending = true;
            onNextFrame.call(this, this.dump);
        }
    };
    SmartStorage.prototype.dump = function dump() {
        this.dumpPending = false;
        localStorage['black_list/storage/' + this.name] = JSON.stringify(this._storage);
        this._storage = null;
    };
    SmartStorage.prototype.clear = function () {
        var prev = this._storage;
        this._storage = Object.create(null);
        return prev;
    };
    SmartStorage.prototype.load = function () {
        var lsKey = 'black_list/storage/' + this.name;
        var savedStorage = localStorage[lsKey];
        var storage = Object.create(null);
        storage = (savedStorage && JSON.parse(savedStorage)) || storage;
        this._storage = storage || Object.create(null);
        this.scheduleDump();
        return this;
    };
    //endregion

    var onNextFrame = (function () {
        var queue = [];
        var running = false;

        function process() {
            var el, func, thisArg, args, endTime = Date.now() + 10;
            do {
                el = queue.shift();
                func = el.func;
                thisArg = el.this;
                args = el.args;
                try {
                    func.apply(thisArg, args);
                } catch (e) {
                    requestAnimationFrame(function (el, e) {
                        console.error({el: el, e: e});
                        throw e;
                    }.bind(null, el, e));
                    break;
                }
            } while (queue.length && endTime > Date.now());
            if (queue.length === 0) {
                running = false;
                return;
            }
            requestAnimationFrame(process);
        }

        return function onNextFrameInternal(func) {
            assertIsFunction(func);
            var args = slice(arguments, 1);
            var p = {
                'func': func,
                'args': args,
                'this': this
            };
            queue.push(p);
            if (running === false) {
                running = true;
                requestAnimationFrame(process);
            }
        };
    }());

    //region Helpers

    var slice = Function.prototype.call.bind([].slice);
    var map = Function.prototype.call.bind([].map);
    var forEach = Function.prototype.call.bind([].forEach);
    var trim = Function.prototype.call.bind(''.trim);

    function getTimeBasedUniqueString(period) {
        var periodInSeconds = simplePeriodToSeconds(period);
        return currentScriptVersion + '/' + '/' + period + '/' + Math.floor((new Date) / (periodInSeconds * 1000));
    }

    function simplePeriodToSeconds(period) {
        var match = String(period).replace(',', '.').match(/^(\d*\.?\d*)([smhd])/i);
        if (match === null) {
            throw new TypeError(String(period) + ' is not valid period');
        }
        var amount = match[1];
        var unit = match[2];
        switch (unit) {
            case 's':
                return amount;
            case 'm':
                return amount * 60;
            case 'h':
                return amount * 60 * 60;
            case 'd':
                return amount * 60 * 60 * 24;
            default:
                throw new TypeError(String(period) + ' is not valid period');
        }
    }

    function commentEntry(message, entryId) {
        return $.ajax({
            url: 'http://www.wykop.pl/ajax2/wpis/CommentAdd/' +
            entryId + '/hash/' + wykop.params.hash + '/',
            type: 'POST',
            data: {
                '__token': wykop.params.hash,
                'body': message
            },
            success: function () {

            }
        });
    }

    function getTrackingData(cb) {
        cb = cb || alert.bind(window);
        var message = ['@Ginden:', currentUser];
        var table = {
            'Wersja skryptu': currentScriptVersion,
            'OS/CPU': navigator.oscpu || 'undefined',
            'Browser': navigator.userAgent,
            'Język': navigator.language,
            'Czas': formatDate('YYYY-MM-DD hh:mm:ss', new Date()),
            'Tryb nocny': !!(wykop.params.settings.night_mode),
            'Pozwala zablokowanym pisać': wykop.params.settings.allow_blacklisted,
            'Dostaje powiadomienia z czarnej listy': wykop.params.settings.blacklist_notifications,
            'Liczba zmian ustawień': localStorage['black_list/settings_changes'] | 0
        };
        var features = {
            'basic destructuring': 'var {a,b} = {a: 1, b:1}',
            'let': 'let a = 3; return a;',
            'const': 'const b = 3; return b;',
            'backquote': 'return `wow` === "wow";',
            Reflect: 'return typeof Reflect !== "undefined"',
            Symbol: 'return typeof Symbol !== "undefined"',
            'Symbol.iterator': 'return typeof Symbol.iterator !== "undefined"',
            'rest arguments': 'return function(...a){return a;};',
            'Proxy': 'return typeof Proxy === "function"',
            'crypto.subtle': 'return crypto.subtle',
            'Object.assign': 'return typeof Object.assign === "function";',
            'TextDecoder': 'return new TextDecoder()',
            'class declaration': 'class Polygon {}; return new Polygon();'
        };
        settings.list().forEach(function (setting) {
            var slug = setting.slug;
            var settingValue = settings[slug] === undefined ? null : settings[slug];
            if (setting.type !== 'button' && !settings.isDefaultValue(slug)) {
                table[setting.name + ' (' + slug + ')'] = settingValue;
            }
        });
        var supportedFeatures = [];
        var unsupportedFeatures = [];
        Object.keys(features).map(function (feature) {
            var val = false;
            try {
                val = Function('"use strict";\n' + features[feature])();
            } catch (ignore) {
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
        BlackList.get(function (blackData) {
            WhiteList.get(function (whiteData) {
                table['Zablokowane **nsfw**'] = blackData.tags.indexOf('#nsfw') !== -1;
                table['Zablokowany **islam**'] = blackData.tags.indexOf('#islam') !== -1;
                table['Zablokowany **randomanimeshit**'] = blackData.tags.indexOf('#randomanimeshit') !== -1;
                table['Zablokowana **polityka**'] = !(wykop.params.settings.show_politics);
                table['Liczba osób na czarnej liście'] = blackData.users.length;
                table['Liczba tagów na czarnej liście'] = blackData.tags.length;
                table['Liczba domen na czarnej liście'] = blackData.domains.length;
                table['Liczba obserwowanych użytkowników'] = whiteData.users.length;
                table['Liczba obserwowanych tagów'] = whiteData.tags.length;
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

    function template(code, values) {
        function escape(text) {
            return document.createElement('div').appendChild(document.createTextNode(text)).parentNode.innerHTML.replace(/"/g, '&quot;');
        }

        return code.replace(/!\{([a-z#\.\-]*)}/gi, function templater(group, value) {
            var path = value.split('.');
            var curr = values;
            var doEscape = false;
            if (value[0] === '#') {
                doEscape = true;
            }
            for (var i = 0; i < path.length; i++) {
                curr = curr[path[i]];
            }
            if (doEscape) {
                curr = escape(curr);
            }
            return curr;
        });
    }

    function getTrimmedText(el) {
        return typeof el === 'string' ? el.trim() : (el.jquery ? el.text().trim() : el.textContent.trim());
    }

    function timeAgo(timeInPast, timeNow) {
        timeInPast = new Date(timeInPast);
        timeNow = timeNow ? new Date(timeNow) : new Date();
        var timeDiff = Math.floor((timeNow - timeInPast) / 1000);
        if (timeDiff < 60) {
            return timeDiff + ' sek.';
        } else if (timeDiff < 60 * 60) {
            return Math.floor(timeDiff / 60) + ' min.';
        } else if (timeDiff < 24 * 60 * 60) {
            return Math.floor(timeDiff / (60 * 60)) + ' godz.';
        } else if (timeDiff < 30 * 24 * 60 * 60) {
            return Math.floor(timeDiff / (24 * 60 * 60)) + ' dni';
        } else if (timeDiff < 365 * 24 * 60 * 60) {
            return Math.floor(timeDiff / (30 * 24 * 60 * 60)) + ' mies.';
        }
        return Math.floor(timeDiff / (365 * 24 * 60 * 60)) + ' lat'
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
        date = date === undefined ? new Date() : date;
        return format
            .replace(/YYYY/g, ['0000', date.getFullYear()].join('').slice(-4))
            .replace(/MM/g, ['0000', date.getMonth() + 1].join('').slice(-2))
            .replace(/DD/g, ['0000', date.getDate()].join('').slice(-2))
            .replace(/hh/g, ['00', date.getHours()].join('').slice(-2))
            .replace(/mm/g, ['00', date.getMinutes()].join('').slice(-2))
            .replace(/ss/g, ['00', date.getSeconds()].join('').slice(-2));
    }

    function sortUsersList(a, b) {
        if (a.color === b.color) {
            return naturalSort(a.nick, b.nick);
        } else {
            return a.color < b.color ? 1 : -1;
        }
    }

    function doXpath(node, path, first) {
        var iterator = document.evaluate(path, node, null, XPathResult.ANY_TYPE, null);
        if (first) {
            return iterator.iterateNext();
        } else {
            var ret = [];
            var el;
            while (el = iterator.iterateNext()) ret.push(el);
            return ret;
        }
    }

    //endregion Helpers

    //region Lock
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
        configurable: false,
        enumerable: false,
        get: function () {
            return localStorage[this.slug];
        },
        set: function (val) {
            if (val == null) {
                delete localStorage[this.slug];
            } else {
                localStorage[this.slug] = val;
                return localStorage[this.slug];
            }
        }
    });
    //endregion

    // Region Texts
    var shortenedReasons = {
        'Propagowanie nienawiści lub przemocy, treści drastyczne': 'nienawiść, przemoc',
        'To jest multikonto': 'multikonto',
        'Treści o charakterze pornograficznym': 'porno',
        'Atakuje mnie lub narusza moje dobra osobiste': 'atakuje mnie',
        'Nieprawidłowe tagi': 'tagi',
        'Atakuje inne osoby': 'atakuje innych',
        'Naruszenie regulaminu - nieodpowiednie treści': 'nieodpowiednie treści'
    };

    var TEXT = {
        SHOW: 'pokazuj',
        HIDE: 'ukryj',
        HILIGHT_ICON_STAR: 'ikonka ' + String.fromCharCode(10026),
        HILIGHT_BOLD: 'pogrubienie',
        HILIGHT_COLOR: 'kolor',
        HILIGHT_WARNING_BACKGROUND: 'kolor ostrzeżenia',
        HILIGHT_BORDER_LEFT: 'pasek z boku',
        HILIGHT_BORDER_RAINBOW: 'tęczowy pasek z boku',
        BLOCK_TEXT: 'tekst',
        BLOCK_ICON: 'ikona kłódki',
        TRACKING_AGREE: 'Czy zgadzasz się na zbieranie danych o Twoim systemie,' +
        'przeglądarce, używanych ustawieniach, rozmiarach czarnej listy?\ ' +
        'Możesz to w każdej chwili zmienić w ustawieniach.' +
        'Zbierane dane możesz też podejrzeć tamże.'
    };

    var TEMPLATES = {
        MODERATED_LI: `<li class="report-li">
                        ❗<span class="report-state-icon moderated-item"></span> wymoderowano <a href="!{url}">twoją treść</a> z powodu "!{reason}" (<time title="!{date}">!{time-ago}</time>)
                    </li>`,
        REPORT_BUTTON: `<span class="dC" data-type="profile" data-id="!{user}">
            <a class="btnNotify button"><i class="fa fa-flag"></i></a>
        </span>`

    };

    var colorSortOrder = {
        1002: 100, // konto usunięte
        1001: 90, //  konto zbanowane
        2001: 80, //  sponosorwane
        5: 80, //  admin
        2: 70, //  bordo
        1: 60, //  pomarańcza
        0: 50,
        'null': 0,
        'undefined': 0
    };

    //endregion Texts

    var UserTracker = {
        entryId: 15954301,
        promptIfNecessary: function () {
            if (!localStorage[this.getTrackingKey()] && (localStorage['black_list/ALLOW_TRACKING'] + '') === 'undefined') {
                localStorage['black_list/tracking-wait'] = localStorage['black_list/tracking-wait'] || formatDate('YYYY-MM-DD', new Date());
                // Wait at least one day before asking for permission
                if (localStorage['black_list/tracking-wait'] !== formatDate('YYYY-MM-DD', new Date())) {
                    var val = confirm(TEXT.TRACKING_AGREE);
                    settings.ALLOW_TRACKING = !!val;
                }
            }
        },
        wasTrackedThisMonth: function () {
            return localStorage[this.getTrackingKey()];
        },
        getTrackingKey: function getTrackingKey() {
            return 'black_list/tracking_' + currentScriptVersion + '_' + simplePeriodToSeconds('28d');
        },
        sendData: function () {
            if (!localStorage[this.getTrackingKey()]) {
                var id = this.entryId;
                localStorage[this.getTrackingKey()] = formatDate('YYYY-MM', new Date());
                getTrackingData(function (message) {
                    commentEntry(message, id);
                });

            }
        }
    };

    function handlePlusHilight() {
        var hilightStyle = settings.PLUS_HILIGHT_STYLE;
        if (hilightStyle === TEXT.HILIGHT_COLOR) {
            var element = document.querySelector('#itemsStream') || document.body;
            var boundRemoveVoteGray = removeVoteGray.bind(null, element);
            var mutationObserver = new MutationObserver(boundRemoveVoteGray);
            mutationObserver.observe(element, {childList: true, attributes: false, subtree: true});
            onNextFrame(removeVoteGray, element);
        } else if (hilightStyle === TEXT.HILIGHT_BOLD || hilightStyle.indexOf('ikonka') === 0) {
            // We add CSS style so we have to do it only once
            WhiteList.get(function hilightPluses(data) {
                var isIcon = hilightStyle.indexOf('ikonka ') === 0;
                var icon = hilightStyle.slice('ikonka '.length);
                var users = data.users;
                var css = users.map(function (user) {
                        return '.voters-list a.link[href="http://www.wykop.pl/ludzie/' + user + '/"]' + (isIcon ? ':before' : '');
                    }).join(',\n') + '{ \n';
                if (hilightStyle === TEXT.HILIGHT_BOLD) {
                    css += 'font-weight: bold;'
                } else if (isIcon) {
                    css += 'content: "' + icon + ' ";';
                }
                css += '\n}';
                var style = document.createElement('style');
                style.innerHTML = css;
                document.querySelector('head').appendChild(style);
            });
        } else {
            console.log('???');
        }
    }

    //region WhiteList

    function WhiteList(init) {
        if (!this) {
            return new WhiteList(init);
        }
        if (settings.OBSERVE_MYSELF && currentUser) {
            init.users.push(currentUser);
        }
        this.users = init.users;
        this.tags = init.tags;
        this.usersSet = new Set(init.users);
        this.tagsSet = new Set(init.tags);
        return this;
    }

    WhiteList.flush = function flushWhiteListCache(cb) {
        cb = typeof cb === 'function' ? cb : console.log.bind(console);
        var entries = Object.keys(localStorage).filter(function (el) {
            return el.indexOf('white_list/date/') === 0;
        });
        entries.forEach(function (key) {
            delete localStorage[key];
        });
        cb('Removed ' + entries.length + ' white list cache entries');
    };

    WhiteList.parse = function parseWhiteList(callback) {
        assertIsFunction(callback);
        $.ajax({
            url: 'http://www.wykop.pl/moj/notatki-o-uzytkownikach/',
            dataType: 'html',
            success: function (data) {
                data = $(data);
                var users = map($('#observedUsers a span', data), getTrimmedText).filter(Boolean).filter(onlyUnique, {});
                var tags = map($('#observedUsers .tag a', data), getTrimmedText).filter(Boolean).filter(onlyUnique, {});
                callback({
                    users: users || [],
                    tags: tags || []
                });
            }
        });
    };

    WhiteList.get = function getWhiteList(callback) {
        var lock = new Lock('white list');
        assertIsFunction(callback);
        callback = callback || Function.prototype;
        if (localStorage['white_list/date/' + getTimeBasedUniqueString(settings.CACHE_REFRESH_TIME)]) {
            var data = JSON.parse(localStorage['white_list/date/' + getTimeBasedUniqueString(settings.CACHE_REFRESH_TIME)]);
            var whiteList = new WhiteList(data);
            onNextFrame(callback, whiteList);
        }
        else {
            if (lock.check()) {
                lock.aquire(3);
            } else {
                onNextFrame(WhiteList.get, callback);
                return;
            }
            WhiteList.parse(function fillWhiteList(data) {
                WhiteList.flush(noop);
                localStorage['white_list/date/' + getTimeBasedUniqueString(settings.CACHE_REFRESH_TIME)] = JSON.stringify(data);
                onNextFrame(callback, new WhiteList(data));
            });
        }
    };

    //endregion WhiteList

    //region BlackList

    function BlackList(init) {
        if (this instanceof BlackList === false) {
            return new BlackList(init);
        }
        this.users = init.users;
        this.tags = init.tags;
        this.domains = init.domains;
        this.entries = localStorage['black_list/entries'] ? JSON.parse(localStorage['black_list/entries']) : [];
        this.usersSet = new Set(init.users);
        this.tagsSet = new Set(init.tags);
        return this;
    }

    BlackList.prototype.toJSON = function () {
        return {
            users: this.users,
            tags: this.tags,
            domains: this.domains
        };
    };
    BlackList.get = function getBlackList(callback) {
        var lock = new Lock('black list');
        callback = callback || Function.prototype;
        if (localStorage['black_list/date/' + getTimeBasedUniqueString(settings.CACHE_REFRESH_TIME)]) {
            var data = JSON.parse(localStorage['black_list/date/' + getTimeBasedUniqueString(settings.CACHE_REFRESH_TIME)]);
            onNextFrame(callback, new BlackList(data));
        }
        else {
            if (lock.check()) {
                lock.aquire(3);
            } else {
                onNextFrame(BlackList.get, callback);
                return;
            }

            BlackList.parse(function fillBlackListData(data) {
                lock.release();
                BlackList.flush(noop);
                localStorage['black_list/date/' + getTimeBasedUniqueString(settings.CACHE_REFRESH_TIME)] = JSON.stringify(data);
                onNextFrame(callback, new BlackList(data));
            });
        }
    };
    BlackList.parse = function parseBlackList(callback) {
        $.ajax({
            url: 'http://www.wykop.pl/ustawienia/czarne-listy/',
            dataType: 'html',
            success: function (data) {
                data = $(data);
                var users = map($('div[data-type="users"] div.usercard a span', data), getTrimmedText).filter(Boolean).filter(onlyUnique, {});
                var tags = map($('div[data-type="hashtags"] .tagcard', data), getTrimmedText);
                var domains = map($('div[data-type="domains"] span.tag', data), getTrimmedText);
                onNextFrame(callback, {
                    users: users || [],
                    tags: tags || [],
                    domains: domains || []
                });
            }
        });
    };
    BlackList.flush = function flushBlackListCache(cb) {
        cb = typeof cb === 'function' ? cb : console.log.bind(console);
        var entries = Object.keys(localStorage).filter(function (el) {
            return el.indexOf('black_list/date/') === 0;
        });
        entries.forEach(function (key) {
            delete localStorage[key];
        });
        cb('Removed ' + entries.length + ' black list cache entries');
    };

    //endregion BlackList

    function handleCommentHilight() {
        var mutationObserver = new MutationObserver(highlightEntryComments);
        mutationObserver.observe(document.body, {childList: true, subtree: true});
        highlightEntryComments();
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
        WhiteList.get(function highlightObservedLinkVotes(data) {
            var users = data.usersSet;
            forEach(subtree.querySelectorAll('.usercard a'), function (el) {
                if (users.has(el.getAttribute('title'))) {
                    $(el.parentNode).addClass(HIGHLIGHT_CLASS);
                }
            });
        });
        BlackList.get(function highlightBlockedLinkVotes(data) {
            var users = data.usersSet;
            forEach(subtree.querySelectorAll('.usercard a'), function (el) {
                if (users.has(el.getAttribute('title'))) {
                    $(el.parentNode).addClass(BAD_HIGHLIGHT_CLASS);
                }
            });
        });
    }

    function highlightLinkComments(data) {
        var users = data.usersSet;
        var comments = document.querySelectorAll('div[data-type=comment]');
        var cancerUsers = new Set(settings.CANCER_USERS); // lista cancerów
        var contentClass;
        if (settings.LINK_COMMENT_HILIGHT_STYLE === TEXT.HILIGHT_WARNING_BACKGROUND) {
            contentClass = HIGHLIGHT_CLASS;
        } else if (settings.LINK_COMMENT_HILIGHT_STYLE === TEXT.HILIGHT_BORDER_LEFT) {
            contentClass = 'highlight-border-left';
        } else if (settings.LINK_COMMENT_HILIGHT_STYLE === TEXT.HILIGHT_BORDER_RAINBOW) {
            contentClass = 'highlight-border-rainbow';
        }
        onNextFrame(function next(i) {
            var el = comments[i], $el, author;
            if (!el) {
                return;
            }
            $el = $(el);
            author = getTrimmedText($el.find('a.showProfileSummary b'));
            if (users.has(author)) {
                $el.toggleClass(contentClass, true);
            } else if (cancerUsers.has(author)) {
                $el.toggleClass('deleted', true);
            }
            onNextFrame(next, i + 1);
        }, 0);
    }

    function removeUserFromCancerList(e) {
        var nick = getTrimmedText($(this).parent('li').children('a'));
        settings.CANCER_USERS = (settings.CANCER_USERS || []).filter(onlyUnique, {})
            .filter(Boolean).filter(function (el) {
                return el !== nick;
            });
        onNextFrame(listCancerUsers);
        e.preventDefault();
        return false;
    }

    function listCancerUsers($list, setting) {
        $list.html('');
        settings[setting.slug].filter(Boolean).forEach(function (cancerUser) {
            var $row = $('<li ></li>').append(
                $('<span ></span>').append(
                    $('<i class="fa fa-times" ></i>')
                ).click(removeUserFromCancerList),
                $('<a ></a>').text(cancerUser).attr('href', 'http://wykop.pl/ludzie/' + cancerUser + '/')
            );
            $list.append($row);
        });
    }

    function preventAccidentalTabClose() {
        var firstValues = new WeakMap();

        function isModified(el) {
            var savedValue = firstValues.get(el);
            if (el.name === "profile[note]" || savedValue === undefined || el.value === '') {
                return false;
            } else {
                return el.value !== savedValue;
            }
        }

        window.onbeforeunload = function (e) {
            if ([].some.call(document.querySelectorAll('textarea'), isModified)) {
                e.returnValue = 'yeah';
                return 'Are you sure';
            }
        };
        var saveValue = function saveValue(e) {
            if (firstValues.get(this) === undefined) {
                firstValues.set(this, this.value);
            }
        };
        $(document.body).on("click focus select", "textarea", saveValue);
        forEach(document.querySelectorAll('textarea'), function (el) {
            if (el.name === "profile[note]") {
                return;
            }
            saveValue.call(el);
        });
    }

    function getModerated(callback) {
        var lock = new Lock('moderated');
        callback = callback || Function.prototype;
        if (lock.check()) {
            lock.aquire(3);
            $.ajax({
                url: 'http://www.wykop.pl/naruszenia/moderated/',
                dataType: 'html',
                success: function (data) {
                    data = $(data);
                    var reports = $('#violationsList tbody tr', data);
                    var entries = map(reports, function (row, i) {
                        var $row = $(row);
                        var url = $row.find('.author a time').parents('a').attr('href');
                        var moderationDate = $($row.find('td')[1]).find('time').attr('datetime');
                        var reason = getTrimmedText($($row.find('td')[1]).find('p'));
                        return {
                            moderationDate: new Date(moderationDate),
                            url: url,
                            reason: reason
                        };
                    });
                    callback(entries);
                }
            });
        } else {
            onNextFrame(getModerated, callback);
        }
    }

    function getReports(callback) {
        var lock = new Lock('reports');
        callback = callback || Function.prototype;
        if (lock.check()) {
            lock.aquire(3);
        } else {
            onNextFrame(getReports, callback);
            return;
        }
        $.ajax({
            url: 'http://www.wykop.pl/naruszenia/moje/',
            dataType: 'html',
            success: function (data) {
                data = $(data);
                var storage = new SmartStorage('report');
                var entries = map($('#violationsList tbody tr', data), function (row, i) {
                    var $row = $(row);
                    var stateHtml = $row.children().first().html();
                    var solvedState = stateHtml.match('waiting') ? null : (stateHtml.match('accepted') ? true : false);
                    // Ugly, to be fixed later
                    var reportID = $row.children()[2].textContent.split('\n').map(trim).join('').slice(0, 5).trim().replace(':', '');
                    var reason = getTrimmedText($($row.children()[2]).find('span'));
                    var solvedDate = solvedState === null ? null : new Date($($row.children()[3]).find('time').attr('datetime'));
                    storage.set(reportID, storage.get(reportID, new Date()));
                    var firstSeen = new Date(storage.get(reportID));
                    if (solvedDate !== null && firstSeen > solvedDate) {
                        firstSeen = new Date(solvedDate);
                    }
                    return {
                        solved: solvedState,
                        reportID: reportID,
                        reason: shortenedReasons[reason] || reason.toLowerCase(),
                        solvedDate: solvedDate,
                        firstSeen: firstSeen
                    };
                });
                if (entries.length > 2) {
                    entries.reduceRight(function (next, current) {
                        if (current.solvedDate === null && Date.now() - current.firstSeen < 1000) {

                        }


                        return current;
                    });
                }
                onNextFrame(callback, entries);
            }
        });

    }

    function removeVoteGray(subtree) {
        WhiteList.get(function markObservedPlus(data) {
            var users = data.usersSet;
            var voters = $(subtree).find('.voters-list a.gray');
            forEach(voters, function (voter) {
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

    function hideTacticalComments() {
        var currentUserCall = ('@' + currentUser).toLowerCase();
        var tactics = ['taktyk', 'taktyczny', 'strategicznie', 'taktycznie', 'wołaj', 'wolaj', 'wołej', 'wołąj', 'chętnie poczytam'];
        var maxLength = Math.max.apply(null, tactics.map(function (e) {
            return e.length;
        }));

        function markElement(el) {
            if (el.tagName === 'DIV' && el.getAttribute('data-type') === 'entrycomment') {
                var textContent = map(el.querySelectorAll('div.text > p'), getTrimmedText).join('\n').toLowerCase();
                var owner = ('@' + $(el).parents('li.entry').find('.author a b').first().text()).toLowerCase();
                var q = (owner.length + maxLength + 10);
                if (textContent.match(new RegExp(currentUserCall)) || textContent.length > q) {
                    return;
                }
                tactics.some(function someStartsWith(text) {
                    var searchStrings = [
                        text,
                        owner + ': ' + text,
                        owner + ' ' + text,
                        owner + '  ' + text
                    ];
                    if (searchStrings.some(function (text) {
                            return textContent.startsWith(text);
                        })) {
                        el.setAttribute('class', el.getAttribute('class') + ' tactic-entry');
                        return true;
                    }
                });
            }

        }

        var func = function observerFunc(records) {
            records.forEach(function (record) {
                forEach(record.addedNodes, markElement);
            });
        };
        var mutationObserver = new MutationObserver(func);
        mutationObserver.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: false
        });

        forEach(document.querySelectorAll('div[data-type=entrycomment]'), markElement);
    }

    function assertIsFunction(fn) {
        if (typeof fn === 'function') {
            return;
        }
        console.log(fn, (new Error()).stack);
        throw new TypeError({}.toString.call(fn) + ' is not a function');
    }

    function clearHiddenEntries(cb) {
        cb = typeof cb === 'function' ? cb : noop;
        var p = JSON.parse(localStorage['black_list/entries'] || '[]').length;
        localStorage['black_list/entries'] = '[]';
        onNextFrame(cb, 'Usunięto ' + p + ' ukrytych wpisów z bazy');
        return false;
    }

    function sortBlackListEntries(entriesContainer) {
        var childs = slice(entriesContainer.children);
        var banned = 0;
        var storage = new SmartStorage('users');
        childs.map(function parseBlackListElements(el) {
            el.nick = getTrimmedText(el).toLowerCase();
            var aColor = el.querySelector('span[class*=color]') || null;
            var rawColor = (aColor && aColor.getAttribute('class').slice('color-'.length)) | 0;
            if (rawColor === 1002 || rawColor === 1001) {
                banned++;
            }
            el.color = colorSortOrder[rawColor] | 0;
            el.prevColor = storage.get(el.nick + '/color', el.color);
            el.prioritize = 0;
            if (el.prevColor !== el.color) {
                el.setAttribute('class', el.getAttribute('class') + ' ' + HIGHLIGHT_CLASS);
            }
            storage.set(el.nick + '/color', el.color);
            return el;
        }).sort(sortUsersList).forEach(function reappendElements(el) {
            entriesContainer.appendChild(el);
        });
        $(entriesContainer).prepend(
            $('<h2></h2>').text('Zbanowanych: ' + banned + '/' + childs.length + ' (' + (100 * banned / childs.length).toPrecision(2) + '%)')
        );
    }

    function find(arr, func, thisArg) {
        var ret = undefined;
        arr.some(function findFirst(el) {
            if (func.apply(thisArg, arguments)) {
                ret = el;
                return true;
            }
            return false;
        });
        return ret;
    }

    function highlightEntryComments() {
        WhiteList.get(function (whiteListed) {
            forEach(document.querySelectorAll('li > div[data-type="entrycomment"]'), function (el) {
                if (whiteListed.usersSet.has(getTrimmedText(el.querySelector('.author .showProfileSummary')))) {
                    var contentClass;
                    if (settings.ENTRY_COMMENT_HILIGHT_STYLE === TEXT.HILIGHT_WARNING_BACKGROUND) {
                        contentClass = HIGHLIGHT_CLASS;
                    } else if (settings.ENTRY_COMMENT_HILIGHT_STYLE === TEXT.HILIGHT_BORDER_LEFT) {
                        contentClass = 'highlight-border-left';
                    } else if (settings.ENTRY_COMMENT_HILIGHT_STYLE === TEXT.HILIGHT_BORDER_RAINBOW) {
                        contentClass = 'highlight-border-rainbow'
                    }
                    $(el).parents('.sub > li').toggleClass(contentClass, true);
                }
            });
        });
    }

    function removeEntries(blackLists) {
        var blockedUsers = blackLists.usersSet;
        var blockedTags = blackLists.tagsSet;
        var blockedEntries = new Set(blackLists.entries);
        onNextFrame(function hideEntries() {
            var entries = $('#itemsStream .entry').filter(function findFirst(i, el) {
                var $el = $(el);
                var author = getTrimmedText($('div[data-type="entry"] .author .showProfileSummary', $el));
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
        });
        onNextFrame(function hideLinks() {
            $('#itemsStream .link').filter(function (i, el) {
                var $el = $(el);
                var author = getTrimmedText($('div[data-type="link"] .fix-tagline a', $el).first()).slice(1);
                var tags = map($('div[data-type="link"] .fix-tagline .tag.affect.create', $el), function (el) {
                    return map(el.childNodes, getTrimmedText).join('');
                });
                var isBlockedAuthor = blockedUsers.has(author);
                if (isBlockedAuthor) {
                    isSuperUser() && $el.attr('data-black-list-reason', author);
                    return true;
                } else {
                    var blockedTag = find(tags, blockedTags.has.bind(blockedTags));
                    if (blockedTag) {
                        isSuperUser() && $el.attr('data-black-list-reason', '#' + blockedTag);
                        return true;
                    }
                }
                return false;
            }).toggleClass('ginden_black_list', true);
        });

        onNextFrame(function hideBlockedEntries() {
            forEach(document.querySelectorAll('#itemsStream .entry div[data-type="entry"]'), function (el) {
                var id = Number(el.getAttribute('data-id'));
                var $menu = $(el).find('ul.responsive-menu');
                var $li = $('<li ></li>');
                var $icon = $('<i class="fa- fa-eye"></i>');
                var $a = $('<a ></a>')
                    .attr({
                        'class': 'affect hide black-list-entry-hide-switch',
                        'data-id': id,
                        'href': '#',
                        'data-hidden': String(blockedEntries.has(id))
                    })
                    .text(' ' + (blockedEntries.has(id) ? TEXT.SHOW : TEXT.HIDE));

                if (blockedEntries.has(id)) {
                    $(el).parent('li.entry').toggleClass('ginden_black_list', true);
                }

                $menu.append($li.append($a.prepend($icon)));
            });
        });

        $("#itemsStream").on("click", "a.black-list-entry-hide-switch", function (e) {
            var $this = $(this);
            var id = Number($this.attr('data-id'));
            var hidden = $(this).attr('data-hidden') === 'true';
            var list = localStorage['black_list/entries'] ? JSON.parse(localStorage['black_list/entries']).filter(onlyUnique, {}) : [];

            if (hidden) {
                list = list.filter(function (el) {
                    return el !== id
                });
                $this.text(TEXT.HIDE);
                $this.attr('data-hidden', 'false');
            } else {
                list.push(id);
                $this.text(TEXT.SHOW);
                $this.attr('data-hidden', 'true');
            }
            localStorage['black_list/entries'] = JSON.stringify(list);
            $this.parents('div[data-type="entry"]').parent().toggleClass('ginden_black_list', !hidden);
            e.stopPropagation();
            e.preventDefault();
            return false;
        });

        setSwitch.call($input[0]);
    }

    function createBooleanHTMLSetting(setting, $table, $tr, $labelTd, $inputTd) {
        var id = 'my_wykop_black_list_' + setting.slug;
        var $input = $('<input />')
            .addClass()
            .attr({
                'class': 'chk-box',
                'type': 'checkbox',
                'id': id,
                'data-slug': setting.slug
            })
            .prop('checked', settings[setting.slug]);
        $label = $('<label ></label>')
            .attr({
                'class': 'inline',
                'for': id,
                'title': setting.description || ''
            })
            .text(setting.name);
        $labelTd.append($label);
        $inputTd.append($input);
        $table.append($tr);
    }

    function createOpenListHTMLSetting(setting, $fieldset) {
        var $list = $('<ul ></ul>');
        // TODO: pozwolić na więcej open_list
        $input = $('<input id="cancer_user_input" type="text" />');
        $label = $('<label ></label>').text(setting.description).attr('for', 'cancer_user_input');
        $input.on('keypress keydown keyup', function (e) {
            if (e.keyCode == ENTER_KEY_CODE) {
                e.stopPropagation();
                e.preventDefault();
                settings[setting.slug] = (settings[setting.slug] || []).concat(this.value.trim()).filter(onlyUnique, {}).filter(Boolean);
                this.value = '';
                onNextFrame(listCancerUsers, $list, setting);

                return false;
            } else {
                return true;
            }
        });
        listCancerUsers($list, setting);
        $fieldset.append($('<div/>').append($label, $input, $list));
    }

    function createButttonHTMLSetting(setting, $fieldset) {
        var id = 'my_wykop_black_list_' + setting.slug;
        var $input = $('<button class="submit">').text(setting.name).attr({
            'title': setting.description,
            'id': id
        }).click(setting.click);
        $fieldset.append($input);
    }

    function createSelectHTMLSetting(setting, $table, $tr, $labelTd, $inputTd) {
        var id = 'my_wykop_black_list_' + setting.slug;
        var $input = $('<select class="margin5_0" ></select>').attr('id', id).on('change', function () {
            settings[setting.slug] = $(this).val();
        });
        $input.append.apply($input, setting.values.map(function (val) {
            var ret = $('<option ></option>').text(val).val(val);
            if (val === settings[setting.slug]) {
                ret.attr('selected', 'selected');
            }
            return ret;
        }));

        $label = $('<label ></label>')
            .addClass('inline')
            .attr('for', id)
            .attr('title', setting.description || '')
            .text(setting.name);
        $labelTd.append($label);
        $inputTd.append($input);
        $table.append($tr);
    }

    function addSettingsToHTML() {
        function toggleSetting() {
            settings[this.getAttribute('data-slug')] = this.checked;
        }

        var $fieldset = $('<fieldset ></fieldset>');
        $fieldset.on('change', 'input[type="checkbox"]', toggleSetting);

        var $header = $('<h4 ></h4>').text('Czarnolistuj Mój Wypok');
        var $table = $('<table class="black-list-settings"></table>');
        $fieldset.append($header, $table);
        settings.list().forEach(function createSettings(setting) {
            if (setting.debug && !isSuperUser()) {
                return;
            }

            var $tr = $('<tr />');
            var $labelTd = $('<td class="label-td" />').appendTo($tr);
            var $inputTd = $('<td class="input-td" />').appendTo($tr);

            if (setting.type === 'boolean') {
                createBooleanHTMLSetting(setting, $table, $tr, $labelTd, $inputTd);
            } else if (setting.type === 'open_list') {
                createOpenListHTMLSetting(setting, $fieldset);
            } else if (setting.type === 'button') {
                createButttonHTMLSetting(setting, $fieldset);
            } else if (setting.type === 'select') {
                createSelectHTMLSetting(setting, $table, $tr, $labelTd, $inputTd);
            }
        });
        $('form.settings').prepend($fieldset);
    }

    function preventCancerOpen(e) {
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
    }

    function appendReportsBox() {
        var $block = $(`<div class="r-block">
            <h4>Zgłoszenia (<a href="http://www.wykop.pl/naruszenia/moje/">moje</a> \u2022 <a href="http://www.wykop.pl/naruszenia/moderated/">na mnie</a>)</h4>
            <div id="reports" class="objectsList" style="max-height: 30em; overflow-y: auto; padding-top: 4px;">
                <ul></ul>
            </div>`);
        var $ul = $block.find('ul');
        getReports(function (reports) {
            reports.forEach(function (el) {
                var reportLiTemplate = `<li class="report-li">
                    <span class="report-state-icon report-solved-state-!{solved}">!{icon}</span>
                    <span class="report-reason">!{reason}</span>
                    (<span class="report-id">!{id}</span>)`;


                var icon = el.solved === null ? '⌛' : (el.solved ? '✔' : '✘');
                if (el.solved !== null) {
                    reportLiTemplate += '; rozwiązano: <time title="!{solved-date}">!{solved-time-ago} temu</time>';
                }
                reportLiTemplate += '; zgłoszono przynajmniej: <time title="!{reported-date}">!{reported-time-ago} temu</time></li>';

                $ul.append($(template(reportLiTemplate, {
                    solved: String(el.solved),
                    icon: icon,
                    reason: el.reason,
                    'solved-date': formatDate('YYYY-MM-DD hh:mm:ss', el.solvedDate || new Date()),
                    'solved-time-ago': timeAgo(el.solvedDate || new Date()),
                    'reported-date': formatDate('YYYY-MM-DD hh:mm:ss', el.firstSeen),
                    'reported-time-ago': timeAgo(el.firstSeen),
                    'id': el.reportID
                })));
            });
            getModerated(function (moderated) {
                moderated.forEach(function (el) {
                    var html = template(TEMPLATES.MODERATED_LI, {
                        url: el.url,
                        reason: el.reason,
                        date: formatDate('YYYY-MM-DD hh:mm:ss', new Date(el.moderationDate)),
                        'time-ago': timeAgo(el.moderationDate)
                    });
                    var $li = $(html);
                    $ul.prepend($li);
                });
            });
        });
        $('#tagsConf').parent().before($block);
    }

    var saveFile = (function () {
        var a = document.createElement("a");
        a.setAttribute('style', 'display: none');
        return function (data, mimeType, fileName) {
            var blob = new Blob([data], {type: 'application/octet-stream'}),
                url = URL.createObjectURL(blob);
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            setTimeout(function () {
                a.click();
                document.body.removeChild(a);
                setTimeout(function () {
                    URL.revokeObjectURL(url);
                }, 1500);
            }, 500);
        };
    }());

    function addUserNotesExport(context) {
        var fileName = currentUser + '-user-notes-' + formatDate('YYYY-MM-DD-hh-mm');
        var $notesList = $('ul#notesList');
        if (context && typeof context === 'object' && !context.BUBBLING_PHASE) {
            $notesList = $('ul#notesList', context);
        } else {
            var lis = $notesList.children('li');
            WhiteList.get(function (whiteList) {
                forEach(lis, function (li) {
                    var $li = $(li);
                    if (whiteList.usersSet.has(getTrimmedText($li.find('a b')))) {
                        $li.addClass(HIGHLIGHT_CLASS);
                    }
                });
            });
            BlackList.get(function (blackList) {
                forEach(lis, function (li) {
                    var $li = $(li);
                    if (blackList.usersSet.has(getTrimmedText($li.find('a b')))) {
                        $li.addClass(BAD_HIGHLIGHT_CLASS);
                    }
                });
            });
            if (settings.BLACK_LIST_SORT) {
                parseNotes().sort(sortUsersList).forEach(function (el) {
                    $notesList[0].appendChild(el.domElement);
                })
            }
        }
        var buttons = [
            $('<button class="button">HTML</button>').click(exportToHTML),
            $('<button class="button">JSON</button>').click(exportToJSON),
            $('<button class="button">TXT</button>').click(exportToTxt)
        ];

        function parseNotes() {
            return map($notesList.children('li'), function (li) {
                var $li = $(li);
                return {
                    nick: $li.find('a b').text().trim(),
                    note: slice($li.find('p')[0].childNodes).filter(function (el) {
                        return el.nodeType === 3; // TEXT_NODE
                    }).map(function (el) {
                        return el.textContent;
                    }).join(' ').trim(),
                    domElement: li
                };
            });

        }


        function exportToHTML() {
            var entries = parseNotes().sort(sortUsersList);
            var doc = document.implementation.createHTMLDocument();
            $(doc.documentElement).html('<head><title></title></head><body><h2></h2><h3></h3><table></table></body>');
            var $nodes = $(doc.documentElement);
            var $table = $nodes.find('table');
            $nodes.find('title').text('Notatki o użytkownikach - ' + currentUser);
            $nodes.find('h2').text(currentUser);
            $nodes.find('h3').text(formatDate('YYYY-MM-DD hh:mm'));
            entries.forEach(function (el) {
                $table.append(
                    $('<tr></tr>').append(
                        $('<td></td>').append($('<b></b>').text(el.nick)),
                        $('<td></td>').text(el.note)
                    ), '\n'
                );
            });
            saveFile($nodes[0].outerHTML, 'text/html', fileName + '.html');
        }

        function exportToJSON() {
            var entries = parseNotes().sort(sortUsersList);
            saveFile(JSON.stringify({
                currentUser: currentUser,
                date: formatDate('YYYY-MM-DD hh:mm'),
                rawDate: new Date(),
                entries: entries
            }, null, 2), 'application/json', fileName + '.json');

        }

        function exportToTxt() {
            var entries = parseNotes().sort(sortUsersList);
            var text = 'Użytkownik: ' + currentUser + ';\nData: ' + formatDate('YYYY-MM-DD hh:mm') + '\n' + entries.map(function (el) {
                    return el.nick + ': ' + el.note;
                }).join('\n');
            saveFile(text, 'text/plain', fileName + '.txt');
        }

        buttons.forEach(function (el) {
            $(el).append(' ', $('<i class="fa fa-print"></i>'));
        });
        $notesList.before($('<div></div>').append(buttons));
        if (context && !context.BUBBLING_PHASE) {
            return parseNotes();
        }
    }

    //region settings

    var settings = (function () {

        function createSettingGetter(slug) {
            var lsKey = 'black_list/' + slug;
            return function settingGetter() {
                var slugs = this._slugs;
                var setting = slugs[slug];
                var type = setting.type;
                if (type === 'boolean') {
                    var matrix = {'true': true, 'false': false, 'undefined': setting.defaultValue};
                    return matrix[localStorage[lsKey]];
                } else if (type === 'open_list' && localStorage[lsKey]) {
                    try {
                        return JSON.parse(localStorage[lsKey]);
                    } catch (e) {
                        console.error({e: e, content: localStorage[lsKey]});
                        return slugs[slug].defaultValue;
                    }
                } else if (type === 'select') {
                    if (localStorage[lsKey] === undefined) {
                        return setting.values[setting.defaultValue];
                    } else {
                        return localStorage[lsKey];
                    }
                }
                return localStorage[lsKey] === undefined ? setting.defaultValue : localStorage[lsKey];
            };
        }

        function createSettingSetter(slug) {
            var lsKey = 'black_list/' + slug;
            return function settingSetter(val) {
                if (slug !== 'ENHANCED_BLACK_LIST') {
                    localStorage['black_list/settings_changes'] = (localStorage['black_list/settings_changes'] | 0) + 1;
                }
                var slugs = this._slugs;
                if (slugs[slug].type === 'open_list') {
                    if (val === undefined) {
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

        var pluginSettings = [
            {
                name: 'Włącz ulepszoną czarną listę',
                description: 'Włącza podstawową funkcjonalność dodatku',
                slug: 'ENHANCED_BLACK_LIST',
                type: 'boolean',
                defaultValue: true
            },
            {
                name: 'Stosuj ulepszoną czarną listę także do znalezisk',
                description: 'Ukrywa także znaleziska',
                slug: 'ENHANCED_BLACK_LIST_LINKS',
                type: 'boolean',
                defaultValue: true
            },
            {
                name: 'Zgłaszanie profili w czasie usuwania',
                description: 'Dodaje przycisk zgłoszenia na stronie usuniętego profilu',
                slug: 'REPORT_DELETED_ACCOUNTS',
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
                name: 'Podświetlaj komentarze obserwowanych w znaleziskach',
                description: 'Podświetlanie komentarzy obserwowanych',
                slug: 'HILIGHT_COMMENTS',
                type: 'boolean',
                defaultValue: false
            },
            {
                name: 'Podświetlaj komentarze obserwowanych we wpisach',
                description: 'Podświetlanie komentarzy obserwowanych',
                slug: 'HILIGHT_ENTRY_COMMENTS',
                type: 'boolean',
                defaultValue: false
            },
            {
                name: 'Blokuj przypadkowe usunięcie treści',
                description: 'Blokuj przypadkowe usunięcie treści',
                slug: 'PREVENT_ACCIDENTAL_REMOVE',
                type: 'boolean',
                defaultValue: true
            },
            {
                name: 'Ukrywaj wpisy z prośbą o wołanie',
                description: 'Ukrywa wpisy z prośbą o wołanie, chyba że są skierowane do innych osób',
                slug: 'HIDE_TACTICS',
                type: 'boolean',
                defaultValue: true
            },
            {
                name: 'Pokazuj powiadomienia z informacjami o aktualizacji',
                description: '',
                slug: 'SHOW_CHANGELOG',
                type: 'boolean',
                defaultValue: true
            },
            {
                name: 'Pokazuj boksy z informacjami o wymoderowanych',
                description: 'Bądź na bieżąco ze zbrodniami moderacyjnymi!',
                slug: 'SHOW_REPORT_BOXES',
                type: 'boolean',
                defaultValue: true
            },
            {
                name: 'Obserwuj samego siebie',
                description: 'Na potrzeby podświetlania itd.',
                slug: 'OBSERVE_MYSELF',
                type: 'boolean',
                defaultValue: true
            },
            {
                name: 'Pozwalaj na zbieranie danych o systemie operacyjnym, przeglądarce, wersji dodatku i rozmiarach czarnej listy',
                slug: 'ALLOW_TRACKING',
                type: 'boolean',
                defaultValue: false
            },
            {
                name: 'Styl blokady',
                description: 'Zmienia styl przycisku blokady',
                slug: 'BLOCK_BUTTON_STYLE',
                type: 'select',
                defaultValue: 1,
                values: [TEXT.BLOCK_TEXT, TEXT.BLOCK_ICON]
            },
            {
                name: 'Styl podświetlenia plusujących',
                description: 'Zmienia styl podświetlenia plusujących',
                slug: 'PLUS_HILIGHT_STYLE',
                type: 'select',
                defaultValue: 0,
                values: [TEXT.HILIGHT_COLOR, TEXT.HILIGHT_ICON_STAR, TEXT.HILIGHT_BOLD]
            },
            {
                name: 'Częstość odświeżania cache',
                description: 'Zmienia częstość odświeżania cache.',
                slug: 'CACHE_REFRESH_TIME',
                type: 'select',
                defaultValue: 1,
                values: ['48h', '24h', '12h', '6h', '4h', '2h', '1h', '30m', '5m']
            },
            {
                name: 'Styl podświetlenia komentarzy',
                description: 'Zmienia styl podświetlania komentarzy obserwowanych',
                slug: 'LINK_COMMENT_HILIGHT_STYLE',
                type: 'select',
                defaultValue: 0,
                values: [TEXT.HILIGHT_WARNING_BACKGROUND, TEXT.HILIGHT_BORDER_LEFT, TEXT.HILIGHT_BORDER_RAINBOW]
            },
            {
                name: 'Styl podświetlenia komentarzy wpisów',
                description: 'Zmienia styl podświetlania komentarzy obserwowanych',
                slug: 'ENTRY_COMMENT_HILIGHT_STYLE',
                type: 'select',
                defaultValue: 0,
                values: [TEXT.HILIGHT_WARNING_BACKGROUND, TEXT.HILIGHT_BORDER_LEFT, TEXT.HILIGHT_BORDER_RAINBOW]
            },
            {
                name: 'Obejrzyj ustawienia',
                slug: 'DEBUG_SHOW_SETTINGS',
                type: 'button',
                debug: true,
                click: function (e) {
                    var json = {};
                    pluginSettings.forEach(function (setting) {
                        json[setting.slug] = settings[setting.slug] === undefined ? null : settings[setting.slug];
                    });
                    alert(JSON.stringify(json, null, 1));
                    e.preventDefault();
                    return false;
                }
            },
            {
                name: 'Wyczyść listę ukrytych wpisów',
                description: 'Czyści listę usuniętych wpisów',
                slug: 'CLEAR_HIDDEN_ENTRIES',
                type: 'button',
                click: function () {
                    return clearHiddenEntries(alert)
                }
            },
            {
                name: 'Wyczyść cache',
                description: 'Czyści cache czarnej i białej listy, domyślnie co 24h',
                slug: 'CLEAR_CACHE',
                type: 'button',
                click: function (e) {
                    var a = [];
                    BlackList.flush([].push.bind(a));
                    WhiteList.flush([].push.bind(a));
                    alert('Cache wyczyszczone. Wiadomości: \n' + a.join('\n'));
                    e.stopPropagation();
                    e.preventDefault();
                    return false;
                }
            },
            {
                name: 'Pokaż dane, które można wysłać',
                description: 'Pokazuje listę ustawień',
                slug: 'SHOW_TRACK_DATA',
                type: 'button',
                click: function (e) {
                    getTrackingData();
                    e.stopPropagation();
                    e.preventDefault();
                    return false;
                }
            },
            {
                name: 'Rakotwórczy użytkownicy:',
                description: 'Blokuje rozwijanie wpisów autorstwa rakotwórczych użytkowników',
                slug: 'CANCER_USERS',
                type: 'open_list',
                defaultValue: []
            }
        ];

        var settings = Object.create(null);

        Object.defineProperties(settings, {
            '_slugs': {
                enumerable: false,
                configurable: false,
                writable: false,
                value: Object.create(null)
            },
            getValue: {
                enumerable: false,
                configurable: false,
                writable: false,
                value: function getValue(code) {
                    return this[code];
                }
            },
            setValue: {
                enumerable: false,
                configurable: false,
                writable: false,
                value: function setValue(code, val) {
                    return this[code] = val;
                }
            },
            getSetting: {
                enumerable: false,
                configurable: false,
                writable: false,
                value: function getSetting(code) {
                    return this._slugs[code];
                }
            },
            list: {
                enumerable: false,
                configurable: false,
                writable: false,
                value: function list() {
                    return pluginSettings;
                }
            },
            isDefaultValue: {
                enumerable: false,
                configurable: false,
                writable: false,
                value: function isDefaultValue(code) {
                    return localStorage['black_list/' + code] === undefined;
                }
            }
        });

        pluginSettings.forEach(function defineSetting(el) {
            settings._slugs[el.slug] = el; // Szybki dostęp do list ustawień.
            Object.defineProperty(settings, el.slug, {
                enumerable: true,
                configurable: false,
                get: createSettingGetter(el.slug),
                set: createSettingSetter(el.slug)
            });
        });
        Object.freeze(pluginSettings);
        Object.freeze(settings);
        return settings;
    })();
    // endregion Settings

    if (debugMode) {
        window.onerror = function (e) {
            if (e && !e.logged) {
                console.log({Error: e, stack: e.stack});
                e.logged = true;
                throw e;
            }
        };
    }

    var $input = $('<input type="checkbox" id="black_list_toggle" name="black_list_toggle" />');
    var $label = $('<label for="black_list_toggle" ></label>');
    var blockButtonStyle = settings.BLOCK_BUTTON_STYLE;
    if (blockButtonStyle === TEXT.BLOCK_ICON) {
        $label.addClass('button');
    }

    function setSwitch() {
        var that = this;
        settings.ENHANCED_BLACK_LIST = that.checked;
        $(document.body).toggleClass('black_list_on', that.checked);
        if (blockButtonStyle === TEXT.BLOCK_TEXT) {
            onNextFrame(function modifyText() {
                $label.text((that.checked ? 'wyłącz' : String.fromCharCode(160) + 'włącz') + ' #czarnolisto' + (that.checked ? ' (' + document.querySelectorAll('.ginden_black_list').length + ' zablokowanych)' : ''));
            });
        } else if (blockButtonStyle === TEXT.BLOCK_ICON) {
            onNextFrame(function modifyIcon() {
                if (that.checked) {
                    $label.html('<i class="fa fa-unlock" ></i> (' + document.querySelectorAll('.ginden_black_list').length + ')');
                } else {
                    $label.html('<i class="fa fa-lock" ></i>');
                }
            });
        }
    }

    $input.change(setSwitch);
    $input.prop('checked', !!settings.ENHANCED_BLACK_LIST);
    setSwitch.call($input[0]);
    var style = document.createElement('style');
    var addonCSS = function () {/*

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
     .icomoon {
     font-family: icomoon;
     }
     body:not(.night) .highlight-border-left {
     border-left: 3px solid black;
     }
     body.night .highlight-border-left {
     border-left: 3px solid pink;
     }
     body.night .highlight-border-left {
     border-left: 3px solid pink;
     }
     .highlight-border-rainbow {
     border-style: solid;
     border-image: url('https://upload.wikimedia.org/wikipedia/commons/6/68/Gay_flag.svg') 0 0 0 3 round;
     }

     table.black-list-settings > tbody > tr:nth-of-type(odd) {
     background-color: rgba(100, 100, 100, 0.1);
     }
     .label-td {
     padding:0;
     line-height: 2em;
     vertical-align: middle;
     }
     .label-td label {
     display: block;
     }
     body:not(.night) .bad-highlight {
     background-color: rgba(0,0,0,0.1);
     }
     body.night .bad-highlight {
     background-color: rgba(255,70,70,0.1);
     }
     span.report-solved-state-true {
     color: green;
     }
     span.report-solved-state-false {
     color: red;
     }
     .tactic-entry {
     display: none;
     }
     */
    }.toString();
    style.innerHTML = addonCSS.slice(addonCSS.indexOf('/*') + 2, addonCSS.lastIndexOf('*/'));
    document.head.appendChild(style);
    var $blackListToggleCont = $('<li id="black_list_toggle_cont">').append($input, $label);

    if (window.wykop) {
        window.wykop.plugins = window.wykop.plugins || {};
        window.wykop.plugins.Ginden = window.wykop.plugins.Ginden || {};
        window.wykop.plugins.Ginden.bus = window.wykop.plugins.Ginden.bus || {};
        window.wykop.plugins.Ginden.bus.onNextFrame = onNextFrame;
        window.wykop.plugins.Ginden.MojWykopBlackList = {
            parseBlackList: BlackList.parse,
            getBlackList: BlackList.get,
            removeEntries: removeEntries,
            getWhiteList: WhiteList.get,
            flushBlackListCache: BlackList.flush,
            flushWhiteListCache: WhiteList.flush,
            getTrackingData: getTrackingData,
            SmartStorage: SmartStorage,
            settings: settings,
            main: main
        };
    }

    var router = {
        'mywykop\/(?!usernotes)(.*)': function (action, method) {
            $('.bspace ul').last().append($blackListToggleCont);
            BlackList.get(removeEntries);
            if (settings.SHOW_REPORT_BOXES) {
                appendReportsBox();
            }
        },
        'tag/.*': function (action, method) {
            $('.fix-b-border > ul').last().append(
                $blackListToggleCont
            );
            BlackList.get(removeEntries);
        },
        'profile/.*': function (action, method) {
            var $blackListToggleCont = $('<span id="black_list_toggle_cont">').append($input, $label);
            $('h4.space').last().append(
                $blackListToggleCont
            );
            BlackList.get(removeEntries);
        },
        'stream/(index|hot|active)': function (action, method) {
            $('.bspace ul').last().append($blackListToggleCont);
            BlackList.get(removeEntries);
        },
        'settings/blacklists': function () {
            if (settings.BLACK_LIST_SORT) {
                sortBlackListEntries(document.querySelector('div.space[data-type="users"]'));
            }
        },
        'error/404': function () {
            if (settings.REPORT_DELETED_ACCOUNTS && location.pathname.match(/\/ludzie\/.*\//)) {
                var user = (location.pathname.match(/\/ludzie\/(.*)\//) || [])[1];
                $('h4.bspace + p > a.button').after(
                    $(template(TEMPLATES.REPORT_BUTTON, {user: user}))
                );
            }
        },
        'settings/index': addSettingsToHTML,
        'mywykop/usernotes': addUserNotesExport,
        'link/.*': function () {
            if (settings.HILIGHT_COMMENTS) {
                WhiteList.get(highlightLinkComments);
            }
            if (settings.HILIGHT_VOTES && document.querySelector('#votesContainer')) {
                var mutationObserver = new MutationObserver(highlightDigs.bind(null, document.querySelector('#votesContainer')));
                mutationObserver.observe(document.querySelector('#votesContainer'), {childList: true, subtree: true});
                highlightDigs(document.querySelector('#votesContainer'));
            }
        }
    };
    if (window.wykop && window.wykop.params) {
        var wykopParams = window.wykop.params;
        var path = wykopParams.action + '/' + wykopParams.method;
        Object.keys(router).forEach(function (route) {
            if (path.match(new RegExp(route))) {
                onNextFrame(router[route], wykopParams.action, wykopParams.method);
            }
        });
        if (settings.HILIGHT_PLUS && document.querySelector('div[data-type="entry"]')) {
            handlePlusHilight()
        }
        if (settings.HILIGHT_ENTRY_COMMENTS && document.querySelector('div[data-type="entry"]')) {
            handleCommentHilight()
        }
        if (settings.PREVENT_ACCIDENTAL_REMOVE && typeof WeakMap === 'function') {
            preventAccidentalTabClose();
        }
        if (settings.HIDE_TACTICS && document.querySelector('li.entry')) {
            hideTacticalComments();
        }


        if (settings.CANCER_USERS.length > 0) {
            document.addEventListener('click', preventCancerOpen, true);
        }

        if (settings.ALLOW_TRACKING) {
            if (!UserTracker.wasTrackedThisMonth()) {
                UserTracker.sendData();
            }
        } else {
            UserTracker.promptIfNecessary();
        }
    }
}

var script = document.createElement("script");
var scriptVersion = typeof GM_info !== 'undefined' ? GM_info.script.version : '7.1';

script.textContent = "try { (" + main.toString().replace('###', scriptVersion) + ")(); } catch(e) {console.error({Error: e, stack: e.stack}); throw e;}";
document.body.appendChild(script);
