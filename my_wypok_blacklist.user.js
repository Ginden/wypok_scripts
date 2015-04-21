// ==UserScript==
// @name        Czarnolistuj Mój Wykop
// @namespace   my_wykop_blacklists
// @include     http://www.wykop.pl/moj/*
// @version     1.2.0
// @grant       none
// @downloadURL https://ginden.github.io/wypok_scripts/my_wypok_blacklist.user.js
// @license CC BY-SA 3.0
// ==/UserScript==


function main() {

    var currentDate = (new Date()).toDateString();

    function parseBlackList(callback) {
        $.ajax({
            url: 'http://www.wykop.pl/ustawienia/czarne-listy/',
            dataType: 'html',
            success: function(data) {
                data = $(data);
                var users = $('div[data-type="users"] a[title="Przejdź do profilu użytkownika"]', data).text().split('\n').map($.trim).filter(Boolean);
                var tags = [].map.call($('div[data-type="hashtags"] .tagcard', data), $).map(function(el){ return el.text().trim()});
                callback({
                    users: users || [],
                    tags: tags || []
                });

            }
        });
    }

    function getBlackList(callback) {
        callback = callback || Function.prototype;
        if (localStorage['black_list_'+currentDate]) {
            try {
                callback(JSON.parse(localStorage['black_list' + currentDate]));
            } catch(e){console.error(e);}
        }
        else {
            parseBlackList(function(data){
                Object.keys(localStorage).filter(function(el) {
                    return el.indexOf('black_list') === 0;
                }).forEach(function(key){
                    delete localStorage[key];
                });
                localStorage['black_list_'+currentDate] = JSON.stringify(data);
                callback(data);
            });
        }
    }



    function removeEntries(blackLists) {
        var entries = $('#itemsStream .entry').filter(function(i,el) {
            el = $(el);
            var author = $('div[data-type="entry"] .author .showProfileSummary', el).text().trim();
            var text = $('div[data-type="entry"] .text', el).text();
            var hasBlackListedTag = false;
            blackLists.tags.forEach(function(el) {
                if (text.indexOf(el) !== -1)
                    hasBlackListedTag = true;
            });
            if (hasBlackListedTag || blackLists.users.indexOf(author) >= 0)
                return true;
            return false;
        }).addClass('dnone').addClass('ginden_blacklist');

    }
    var blackList = getBlackList(removeEntries);


}

function addToSite(callback) {
    "use strict";
    var script = document.createElement("script");
    script.textContent = "(" + callback.toString() + ")();";
    document.body.appendChild(script);
}

addToSite(main);
