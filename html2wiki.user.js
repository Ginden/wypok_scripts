// ==UserScript==
// @name        Wypok to Wiki
// @namespace   neuropa_wypok_2_wiki
// @include     http://www.wykop.pl/*
// @version     1.0
// @grant       none
// @downloadURL https://ginden.github.io/wypok_scripts/html2wiki.user.js
// @license     MIT
// ==/UserScript==





var script = document.createElement("script");
script.textContent = "(" + main.toString() + ")();";
document.body.appendChild(script);
function main(){
    var elements;
    var markedWm = new WeakSet();
    var $el = $('<li><a href="#" class="affect hide html2wiki"><i class="fa fa-wrench"></i> html2wiki</a></li>');

    var onNextFrame = window.wykop && wykop.plugins && wykop.plugins.Ginden && wykop.plugins.Ginden.bus && wykop.plugins.Ginden.bus.onNextFrame || function(fn){
        var args = [].slice.call(arguments,1);
        requestAnimationFrame(function(){
            return fn.apply(this, args);
        });
    };
    $(document.body).on('click', 'ul.responsive-menu .html2wiki', handleClick);

    updateElements();


    function updateElements() {
        elements =  [].slice.call(document.querySelectorAll('div[data-type="comment"], div[data-type="entry"], div[data-type="entrycomment"]'));
        elements.filter(function(el) {
            return !markedWm.has(el);
        }).forEach(function(el) {
            markedWm.add(el);
            var $menu = $(el.querySelector('.responsive-menu'));
            $menu.append($el.clone(true));
        });
    }

    function doNotLinkify(url) {
        return 'http://donotlink.com/'+escape(url);
    }

    function parseElement(el) {
        var arr = [].map.call(el.childNodes, function(childNode){
            if (childNode.nodeType === Node.TEXT_NODE) {
                return childNode.textContent.replace(/\n/g, '');
            } else if (childNode.tagName === 'BR' && childNode.previousSibling && childNode.previousSibling.getAttribute && childNode.previousSibling.tagName === 'BR')
                return '';
            else if (childNode.tagName === 'BR') {
                return '\n';
            } else if (childNode.tagName === 'STRONG') {
                return "<strong>" + parseElement(childNode) + "</strong>";
            } else if (childNode.tagName === 'EM') {
                return "<i>" + parseElement(childNode) + '</i>';
            } else if (childNode.getAttribute('class') === 'showSpoiler') {
                return '';
            } else if (childNode.tagName === 'A') {
                return '[' + doNotLinkify(childNode.getAttribute('href')) + ' ' + parseElement(childNode) + ']';
            } else if (childNode.tagName === 'CITE') {
                return '<blockquote>' + parseElement(childNode) + '</blockquote>';
            } else if (childNode.tagName === 'CODE' && childNode.previousSibling && childNode.previousSibling.getAttribute && childNode.previousSibling.getAttribute('class') === 'showSpoiler') {
                return '<span class="wykop-spoiler">' + parseElement(childNode) + '</span>';
            } else if (childNode.tagName === 'CODE') {
                return '<code>' + parseElement(childNode) + '</code>';
            } else {
                console.log(childNode, el, el.textContent);
                alert(childNode);
                throw childNode;
            }
        });
        return arr.join('').split('\n').map(function(el) {
            var ret = el.trim();
            if (el[0]==='#') {
                ret = '&nbsp;' + ret;
            }
            return ret;
        }).filter(function(el,i, arr){
            if(i===0) {
                return true;
            }
            var prev = arr[i-1];
            return !(prev === '' && el === '')
        }).join('\n');
    }

    function handleClick(e) {
        var $parent = $(e.target).parents('div[data-type]');
        var author = $parent.find('.author .showProfileSummary b').text().trim();
        var url = $parent.find('.ellipsis time[datetime]').parents('a').attr('href');
        var html = $parent.find('.text p')[0];

        var ret = {
            author: author,
            url: url,
            parsed: parseElement(html),
            html: html.innerHTML
        };
        var authorLink = doNotLinkify('http://wykop.pl/ludzie/'+author+'/');
        var pre = document.createElement('textarea');
        pre.value = 'Autor: ['+authorLink+' '+ author+']; ['+doNotLinkify(url)+' Oryginał]: <br><div class="wykop-imported">\n'+ret.parsed+'\n</div>';

        $parent.find('.text p').first().html('').append(pre);

        e.preventDefault();
        return false;
    }


}
