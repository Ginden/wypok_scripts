// ==UserScript==
// @name ABW Przycisk
// @namespace abw_przycisk
// @description Przycisk do ABW
// @include http://*.wykop.pl/*
// @version 4.0.0
// @grant GM_info
// @downloadURL https://ginden.github.io/wypok_scripts/abw.user.js
// @license CC BY-SA 3.0
// ==/UserScript==
var load$UI = document.createElement('script');
load$UI.setAttribute('src',
    'http://ajax.googleapis.com/ajax/libs/jqueryui/1.9.2/jquery-ui.js');
load$UI.setAttribute('id', 'jquery-ui');
document.body.appendChild(load$UI);
var fix_fucked_JSON = document.createElement('script');
fix_fucked_JSON.innerHTML = '(' + (function (global) {
        global.JSON.parse = (function (old) {
            return (function parse() {
                var args = Array.prototype.slice.call(
                    arguments, 0);
                if (args[0].indexOf('for(;;);') === 0) {
                    args[0] = args[0].slice(8);
                }
                return old.apply(JSON, args);
            })
                .bind(global.JSON)
        })(global.JSON.parse);
    })
        .toString() + ')(window)';
// MACIEJ
// ZABIJ SIÊ
document.body.appendChild(fix_fucked_JSON);

function main() {
    var ourStyle = [
        "#abw_grupa a{",
        "background-image:url('http://wykop.ginden.pl/abw/aCuKTnV.php') !important;",
        "background-repeat:no-repeat;",
        "background-position: center;",
        'background-size: 100% auto;',
        "}",
        "#abw_grupa:hover a { ",
        "background-image: url('http://i.imgur.com/ghRv6kv.png') !important;",
        "background-repeat:no-repeat !important;",
        "}",
        ".abw_button {",
        "color: red !important;",
        "}",
        '.abw_button i {',
        'opacity: .3',
        '}',
        '#report-comment {width:100%; height: 100%}',
        "div.raport_abw:hover{opacity:1}"
    ].join('\n');

    function fullBind(func, thisArg, args) {
        return Function.prototype.bind.apply(func, [thisArg].concat(args));
    }

    function matchHeuretics(obj) {
        "use strict";
        var description = obj.description;
        var title = obj.title;
        var tags = obj.tags;
        var rawTags = obj.rawTags;

    }


    function waitUntil$UI(func) {
        var bindedFunction;
        var i = 0;
        return function waitingFunction() {
            bindedFunction = bindedFunction || fullBind(func, this,
                    arguments);
            if (window.$ && window.$.ui) {
                bindedFunction();
            } else {
                if (document.querySelector('script#jquery-ui')) {
                    document.querySelector('script#jquery-ui')
                        .addEventListener('load', bindedFunction)
                } else {
                    setTimeout(waitingFunction, i += 10);
                }
            }
            return false;
        }
    }

    function commentEntry(message, entryId) {
        return $.ajax({
            url:  'http://www.wykop.pl/ajax2/wpis/CommentAdd/' +
                  entryId + '/hash/' + Wykop.token + '/',
            type: 'POST',
            data: {
                '__token': Wykop.token,
                'body':    message
            }
        });
    }

    function addEntry(message, channel) {
        var url = this.getEntryAddURL(channel);
        return $.ajax(
            url, {
                type: 'POST',
                data: {
                    '__token': Wykop.token,
                    'body':    message
                }
            }
        );
    }

    function getEntryAddURL(channel) {
        var ret = 'http://www.wykop.pl/ajax2/wpis/dodaj/hash/' + this.token + '/';
        if (channel) {
            ret += 'channel/' + channel + '/';
        }
        return ret;
    }

    var Wykop = {
        currentAction:           wykop.params.action,
        token:                   wykop.params.hash,
        getCurrentUser:          function () {
            var _user;
            return function () {
                if (_user) {
                    return _user;
                }
                var ret = {};
                var currUserDOM = $('.logged-user a.ellipsis').first();
                try {
                    ret.color = (function (UserNode) {
                        var classList = UserNode.attr('class').split(/\s+/);
                        var userColor = classList.filter(function (el) {
                            return !!el.match('color-');
                        });
                        return (userColor[0].replace('color-', ''));
                    })(currUserDOM);
                    ret.name = currUserDOM.text().trim();
                } catch (e) {
                    // not logged user
                    console.warn(e);
                    ret = {
                        'name':  null,
                        'color': 0
                    };
                }
                return _user = ret;
            };
        }(),
        getCurrentUserLastEntry: function (cb) {
            cb = cb || function () {
                };
            return $.ajax({
                method: 'GET',
                url:    '/ludzie/wpisy/' + Wykop.getCurrentUser().name +
                        '/'
            }).done(function (html) {
                try {
                    var ret = {
                        name: 'LastEntry'
                    };
                    var entries = $('#itemsStream li', html);
                    var firstEntry = entries.first();
                    var entryId = firstEntry.find('.ownComment:first').attr('data-id');
                    var nodeText = firstEntry.text();
                    ret.id = entryId;
                    ret.text = nodeText;
                } catch (e) {
                    alert(e);
                    setTimeout(cb, 0, e);
                }
                Wykop.getCurrentUser().lastEntry = ret;
                setTimeout(cb, 0, null, ret);
                return ret;
            });
        },
        getEntryAddURL:          getEntryAddURL,
        addEntry:                addEntry,
        commentEntry:            commentEntry
    };


    var UI = {
        alert: function (message, title) {
            $("<div />")
                .text(message)
                .dialog({
                    buttons:   {
                        "OK": function () {
                            $(this).dialog("close");
                        }
                    },
                    close:     function (event, ui) {
                        $(this).remove();
                    },
                    resizable: false,
                    title:     title,
                    modal:     true
                });
        }
    };

    var GROUP = {
        ID:                'agencjabezpieczenstwawykopu',
        retrieveUsersList: function (cb) {
            cb = cb || function () {
                };
            return $.ajax(
                'http://wykop.koziolek.biz/spamlista/abw/', {
                    dataType: 'jsonp'
                })
                .success(function (data) {
                    GROUP.usersList = data;
                    cb(null, data);
                }).fail(cb);
        },
        getURL:            function () {
            return 'http://www.wykop.pl/mikroblog/kanal/' + this.ID +
                   '/';
        },
                           get usersList() {
                               "use strict";
                               if (this._users) {
                                   return this._users;
                               } else {
                                   throw new TypeError('UserList retrieved before ');
                               }
                           },
                           set usersList(val) {
                               "use strict";
                               this._users = val;
                           }
    };
    var MESSAGES = {
        FIRST_SUCCESS:        'Request wys\u0142any poprawnie.',
        SPAM_LIST_HEADER:     [
                                  '[Spamlista](http://ginden.pl/scripts/abw.html)',
                                  '([wypisz/zapisz siê](http://www.wykop.pl/dodatki/pokaz/267/))',
                                  '[dodatek Gindena ###](http://ginden.pl/scripts/abw.html#przycisk)'
                              ].join(' '),
        TOTAL_SUCCES:         'Wszystko wys\u0142ane poprawnie!',
        GROUP_MESSAGE_HEADER: '**PRZYCZYNA**'
    };
    $.extend(UI);

    function NavIcon(url, id) {
        var contDiv = $('<li />').attr('id', id);
        var icon = $('<a />').attr('href', url);
        return contDiv.append(icon);
    }

    function chunkArray(arr, size) {
        var chunks = [];
        Array.prototype.forEach.call(arr, function (el, i) {
            "use strict";
            this[Math.floor(i / size)] = this[Math.floor(i / size)] || [];
            this[Math.floor(i / size)].push(el);
        }, chunks);
        return chunks;
    }

    function markdownLink(URL, desc) {
        return ['[', desc, '](', URL, ')'].join('');
    }

    function ReportDialog(text) {
        var ret = $('<div />').attr({
            id:    'dialog-zglosfest',
            title: 'ABW'
        });
        var $textarea = $('<textarea />')
            .attr('id', 'report-comment')
            .val(text);
        ret.append($textarea);
        return ret;
    }

    function addGroupEntry(message, channel, useSpamList) {
        "use strict";
        Wykop.addEntry(message, channel)
            .done(function () {
                Wykop.getCurrentUserLastEntry(function () {
                    var lastEntry = Wykop.getCurrentUser().lastEntry;
                    GROUP.retrieveUsersList()
                        .done(function (usersList) {
                            addSpamlist(lastEntry, useSpamList ? usersList : []);
                        });

                });
            });
        function addSpamlist(entry, usersList) {
            var howManyUsers = (function (number) {
                number += 1;
                return 10 *
                       (Math.pow(number, 2) - 2 * number + 2);
            })(Number(Wykop
                .getCurrentUser()
                .color));
            var spamListedUsers = usersList.map(function (el) {
                return '@' + el;
            });
            var chunks = chunkArray(spamListedUsers, howManyUsers);
            var messages = chunks.map(function (chunk, i) {
                return (i === 0 ? MESSAGES.SPAM_LIST_HEADER + '\n' : '') + chunk.join(' ');
            });
            (function q(i, end) {
                if (!messages[i]) {
                    return end();
                }
                Wykop.commentEntry(messages[i], entry.id).done(q.bind(null, i + 1, end));
            }(0, $.alert.bind(null, MESSAGES.TOTAL_SUCCES)));
        }
    }

    function ABW_report() {
        var title = $(this).data('title');
        var URL = $(this).data('id');
        var tekst = MESSAGES.GROUP_MESSAGE_HEADER + '\n' + markdownLink(URL, title) + '\n';
        var reportDialog = new ReportDialog(tekst);
        $(document.body).append(reportDialog);
        reportDialog.dialog({
            create:    function (event, ui) {
                $('textarea', this).val(tekst.replace('\u2022', ''));
            },
            autoOpen:  true,
            resizable: false,
            height:    500,
            width:     800,
            modal:     true,
            buttons:   {
                'zg\u0142o\u015B':               function () {
                    var reportText = $('textarea', this)
                        .val();
                    addGroupEntry(reportText, GROUP.ID,
                        true);
                    $(this)
                        .dialog("close");
                    reportDialog.empty()
                        .remove();
                },
                'zg\u0142o\u015B bez spamlisty': function () {
                    var reportText = $('textarea', this)
                        .val();
                    addGroupEntry(reportText, GROUP.ID,
                        false);
                    $(this)
                        .dialog("close");
                    reportDialog.empty()
                        .remove();
                },

                "publicznie": function () {
                    var reportText = $('textarea', this)
                        .val();
                    addGroupEntry(reportText, false, false);
                    $(this)
                        .dialog("close");
                    reportDialog.empty()
                        .remove();
                },
                "Anuluj":     function () {
                    $(this)
                        .dialog("close");
                    reportDialog.empty()
                        .remove();
                }
            },
            close:     function (event, ui) {
                reportDialog.empty()
                    .remove();
            }
        });
        return false;
    }

    try {

        (function mainFunc() {
            var $UI_theme = $('<link rel="stylesheet" type="text/css" />');
            if (window.nightmode) {
                $UI_theme.attr('href',
                    'http://ajax.googleapis.com/ajax/libs/jqueryui/1.10.2/themes/dark-hive/jquery-ui.css'
                );
            } else {
                $UI_theme.attr('href',
                    'http://ajax.googleapis.com/ajax/libs/jqueryui/1.10.2/themes/smoothness/jquery-ui.css'
                );
            }
            $(document.head).append($UI_theme);

            var HASH = '03e58bfe41a357529d95ca1bc1f5d458';

            function getBoolConfiguration(name, def) {
                var ret = localStorage[HASH + '_' + name];
                if (ret === undefined) {
                    return setBoolConfiguration(name, def);
                }
                return !!JSON.parse(ret);
            }

            function setBoolConfiguration(name, val) {
                console.log('I set CONF.' + name + ' = ' + !!val);
                return localStorage[HASH + '_' + name] = !!val;

            }

            var CONFIGURATION = {
                ICON:    getBoolConfiguration('ICON', true),
                BUTTONS: getBoolConfiguration('BUTTONS', true),
                NAV:     getBoolConfiguration('NAV', false),
                SUGGEST: getBoolConfiguration('SUGGEST', true)
            };
            $(document.head).append(
                $('<style />').html(ourStyle)
            );

            function ReportButton(title, URL) {
                URL = URL || (location.origin + location.pathname);
                return $('<a />')
                    .attr('class', 'button abw_button')
                    .data('id', URL)
                    .data('title', title)
                    .attr('href', '#')
                    .append($('<i class="fa fa-flag" />'))
                    .click(waitUntil$UI(ABW_report));
            }

            function createInputsFromConfig(conf) {
                var ret = $('<form />');
                var inputs = [
                    ['Ikona ABW', 'ICON'],
                    ['Przyciski zg³aszania', 'BUTTONS'],
                    ['Link na belce', 'NAV'],
                    ['Heuretystyczne podœwietlanie naruszeñ', 'SUGGEST']
                ];
                var row;
                var table = $('<table />');
                for (var i = 0; i < inputs.length; i++) {
                    row = $('<tr/>');
                    row.append(
                        $('<td />').append(
                            inputs[i][0]
                        ),
                        $('<td />').append(
                            $('<input type="checkbox">')
                                .attr('name', inputs[i][1])
                                .prop('checked', conf[inputs[i][1]])
                        )
                    );
                    table.append(row);
                }
                ret.append(table);
                return ret;
            }

            function setConfigFromForm($form) {
                var source = $('input', $form);
                source.each(function (index) {
                    var $this = $(this);
                    setBoolConfiguration($this.attr('name'),
                        $this.prop('checked'));
                });
            }

            function ConfigPanel() {
                var dialog = $('<div />');
                $(document.body).append(dialog);
                dialog.css('display', 'none');
                dialog.append(createInputsFromConfig(CONFIGURATION));
                dialog.dialog({
                    autoOpen: false,
                    height:   300,
                    width:    350,
                    modal:    true,
                    buttons:  {
                        'zapisz i zamknij': function () {
                            dialog.dialog('close');
                        }
                    },
                    close:    function () {
                        setConfigFromForm($('form', dialog));
                        dialog.css('display', 'none')
                    }
                });
                return function () {
                    dialog.css('display', 'block');
                    dialog.dialog('open');
                }

            }

            function ConfigButton($where) {
                var $container = $where.clone();
                var $button = $container.children('a');
                $button.attr({href: '#'});
                $button.children('span').text('abw');
                $button.on('click', new ConfigPanel());
                $where.after($container);
            }

            if (Wykop.currentAction === 'settings') {
                waitUntil$UI(function waitTilUi() {
                    if ($.ui) {
                        new ConfigButton($('a[href="http://www.wykop.pl/ustawienia/czarne-listy/"]').parent());
                    }
                })();
            }
            if (CONFIGURATION.ICON) {
                $('#nav ul.clearfix .m-user').first().before(new NavIcon(GROUP.getURL(), 'abw_grupa'));
            }
            if (CONFIGURATION.NAV) {
                var toAdd = $('<li />').append(
                    $('<a>')
                        .attr({
                            'class': 'tip fleft cfff tab fbold',
                            'title': 'Agencja Bezpieczeñstwa Wykopu',
                            'href':  GROUP.getURL()
                        })
                        .text('ABW')
                );
                if (document.URL === GROUP.getURL()) {
                    toAdd.addClass('active');
                }
                $('#nav .mainnav').append(toAdd);
                toAdd = null;
            }
            if (CONFIGURATION.BUTTONS) {
                var reportButton;
                if (Wykop.currentAction === 'index' || Wykop.currentAction === 'upcoming') {
                    var LinksList = $('#itemsStream li');
                    $.each(LinksList, function (id, element) {
                        if ($('.diggbox', element).text().match(/wykop|cofnij/)) {
                            var title = $('h2', element).text().trim();
                            var URL = $('.fa-comments-o', element).parent().attr('href');
                            $('.diggbox', element).append(new ReportButton(title, URL));
                        }
                    });
                } else if (Wykop.currentAction === 'link') {
                    reportButton = new ReportButton($('h2').text().trim());
                    $('.diggbox').append(reportButton);
                } else if (Wykop.currentAction === 'profile') {
                    reportButton = new ReportButton($('.user-profile').attr('data-id').trim());
                    $('.user-profile .m-reset-position .button').parent().append(reportButton);
                }
            }
            if (CONFIGURATION.SUGGEST) {
                if (Wykop.currentAction === 'index' || Wykop.currentAction === 'upcoming') {

                }
            }
        })();
    } catch (e) {
        alert(e);
    }
}


var script = document.createElement("script");
var scriptVersion = typeof GM_info !== 'undefined' ? GM_info.script.version : '4.0';
script.textContent = "(" + main.toString().replace('###', scriptVersion) + ")();";
document.body.appendChild(script);

