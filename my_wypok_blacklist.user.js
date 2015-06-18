// ==UserScript==
// @name        Czarnolistuj Mój Wykop
// @namespace   my_wykop_blacklists
// @include     http://www.wykop.pl/moj/*
// @include     http://www.wykop.pl/tag/*
// @include     http://www.wykop.pl/ustawienia/czarne-listy/
// @version     1.3.0
// @grant       none
// @downloadURL https://ginden.github.io/wypok_scripts/blacklist.user.js
// @license CC BY-SA 3.0
// ==/UserScript==


function main() {

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
                    tags:  tags || []
                });

            }
        });
    }

    function getBlackList(callback) {

        callback = callback || Function.prototype;
        if (localStorage['black_list_' + currentDate]) {
            callback(JSON.parse(localStorage['black_list_' + currentDate]));
        }
        else {
            parseBlackList(function (data) {
                Object.keys(localStorage).filter(function (el) {
                    return el.indexOf('black_list') === 0;
                }).forEach(function (key) {
                    delete localStorage[key];
                });
                localStorage['black_list_' + currentDate] = JSON.stringify(data);
                callback(data);
            });
        }
    }


    function removeEntries(blackLists) {
        var entries = $('#itemsStream .entry').filter(function (i, el) {
            el = $(el);
            var author = $('div[data-type="entry"] .author .showProfileSummary', el).text().trim();
            var text = $('div[data-type="entry"] .text', el).text();
            var hasBlackListedTag = false;
            blackLists.tags.some(function (el) {
                if (text.indexOf(el) !== -1) {
                    hasBlackListedTag = true;

                }
            });
            if (hasBlackListedTag || blackLists.users.indexOf(author) >= 0) {
                return true;
            }
            return false;
        }).toggleClass('ginden_black_list', true);

    }



    var $input = $('<input type="checkbox" id="black_list_toggle" name="black_list_toggle" />');
    var $label = $('<label for="black_list_toggle" />');
    function setSwitch() {
        localStorage.black_list_on = this.checked;
        $(document.body).toggleClass('black_list_on', this.checked);
        $label.text((this.checked ? 'wyłącz' : String.fromCharCode(160)+'włącz')+' #czarnolisto');
    }
    $input.change(setSwitch);
    $input.prop('checked', localStorage.black_list_on ? JSON.parse(localStorage.black_list_on) : true);
    setSwitch.call($input[0]);
    var style = document.createElement('style');
    style.innerHTML = ['body.black_list_on .ginden_black_list {display: none; }',
                       '#black_list_toggle {display: none}',
                       '#black_list_toggle_cont {padding: 10px;}'
    ].join('\n');


    document.head.appendChild(style);
    if (window.wykop && window.wykop.params && window.wykop.params.action === 'mywykop') {
        $('.bspace ul').last().append($('<li id="black_list_toggle_cont">').append($input, $label));
        getBlackList(removeEntries);
    } else if (window.wykop && window.wykop.params && window.wykop.params.action === 'tag') {
        getBlackList(removeEntries);
        $('.fix-b-border > ul').last().append(
            $('<li id="black_list_toggle_cont">').append($input, $label)
        );
    } else if (window.wykop && wykop.params && wykop.params.action === "settings" && wykop.params.method === "blacklists") {
        var p = document.querySelector('div.space[data-type="users"]');
        var childs = [].slice.call(p.children);
        var colorSortOrder = {
            1002: 100, //konto usunięte
            1001: 90, // konto zbanowane
            2001: 80, // sponosorwane
            5: 80, // admin
            2: 70, //bordo
            1: 60, // pomarańcza
            0: 50,
            null: 0
        };
        childs.filter(function(el){
            el.nick = el.textContent.toLowerCase().trim();
            var aColor = el.querySelector('span[class*=color]') || null;
            el.color = colorSortOrder[(aColor && aColor.getAttribute('class').slice('color-'.length))]|0;
            el.prevColor = (localStorage['black_list_user_color_'+el.nick] || el.color)|0;
            el.prioritize = 0;
            if (el.prevColor !== el.color && (el.color === 1002 || el.color === 1001)) {
                el.prioritize = 1;
                el.setAttribute(el.getAttribute('class')+' type-light-warning');
            }
            localStorage['black_list_user_color_'+el.nick] = el.color;
            return el;
        }).sort(function(a,b) {
            return (a.prioritize > b.prioritize) ? 1 : (a.color === b.color) ? (a.nick > b.nick ? 1 : -1) : (a.color < b.color ? 1 : -1);
        }).forEach(function(el) {
            p.appendChild(el);
        });
    }


    if (window.wykop) {
        window.wykop.plugins = window.wykop.plugins || {};
        window.wykop.plugins.Ginden = window.wykop.plugins.Ginden || {};
        window.wykop.plugins.Ginden.MojWykopBlackList = {
            setSwitch: function(state){
                $input.prop('checked', !!state);
            },
            parseBlackList: parseBlackList,
            getBlackList: getBlackList,
            removeEntries: removeEntries
        };
    }

}


var script = document.createElement("script");
script.textContent = "(" + main.toString() + ")();";
document.body.appendChild(script);
